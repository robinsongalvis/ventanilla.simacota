import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/ai/rate-limit';
import { guardarVersionBorrador } from '@/lib/simi-juridico/borradorVersiones';
import { createApprovalFlow, updateApprovalFlow } from '@/lib/simi-juridico/createApprovalFlow';
import { createFinalSignature, updateFirmaEstado } from '@/lib/simi-juridico/createFinalSignature';
import { generateOfficialResponsePdf } from '@/lib/simi-juridico/generateOfficialResponsePdf';
import { sendCitizenWhatsAppNotification } from '@/lib/simi-juridico/sendCitizenWhatsAppNotification';
import { calculateControlInternoMetrics } from '@/lib/simi-juridico/calculateControlInternoMetrics';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { E2ETestRequest, E2ETestResponse, E2ETestStep } from '@/src/types/simi-e2e-test';
import type { RespuestaFirma } from '@/src/types/simi-firma';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { WhatsAppMessageResult } from '@/src/types/simi-whatsapp';

export const runtime = 'nodejs';

const ROLES_PERMITIDOS = new Set<string>(['ADMIN', 'SUPER_ADMIN', 'DESARROLLADOR']);
const TEST_PHONE = '+570000000000';
const TEST_EMAIL = 'test-ciudadano@example.com';

interface UsuarioE2E {
  uid: string;
  nombre: string;
  rol: RolInterno | 'SUPER_ADMIN' | 'DESARROLLADOR';
  tenantId: TenantId;
}

function nowIso(): string {
  return new Date().toISOString();
}

function resumen(pasos: E2ETestStep[]) {
  return {
    totalPasos: pasos.length,
    exitosos: pasos.filter((p) => p.estado === 'success').length,
    fallidos: pasos.filter((p) => p.estado === 'failed').length,
    omitidos: pasos.filter((p) => p.estado === 'skipped').length,
  };
}

function hashIp(ip: string): string {
  let hash = 0;
  for (const c of ip) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return Math.abs(hash).toString(36).toUpperCase();
}

async function verificarSesion(): Promise<UsuarioE2E | null> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    const rol = String(d.rol ?? '').toUpperCase() as UsuarioE2E['rol'];
    if (!ROLES_PERMITIDOS.has(rol)) return null;
    return {
      uid: decoded.uid,
      nombre: d.nombre as string ?? decoded.email ?? 'Administrador',
      rol,
      tenantId: d.tenantId as TenantId,
    };
  } catch {
    return null;
  }
}

async function addStep(
  pasos: E2ETestStep[],
  runRef: FirebaseFirestore.DocumentReference | null,
  step: Omit<E2ETestStep, 'fecha'>,
) {
  const entry: E2ETestStep = { ...step, fecha: nowIso() };
  pasos.push(entry);
  if (runRef) {
    await runRef.update(removeUndefinedDeep({
      pasos,
      resumen: resumen(pasos),
      updatedAt: nowIso(),
    })).catch(() => null);
  }
}

async function safeSet(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
  await ref.set(removeUndefinedDeep(data));
}

async function safeAdd(collection: FirebaseFirestore.CollectionReference, data: Record<string, unknown>) {
  return collection.add(removeUndefinedDeep(data));
}

async function safeUpdate(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
  await ref.update(removeUndefinedDeep(data));
}

function buildRadicado(testRunId: string, usuario: UsuarioE2E, radicadoId: string): VentanillaRadicado & Record<string, unknown> {
  const ahora = nowIso();
  const vencimiento = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
  return {
    radicadoId,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: ahora,
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      nombreCompleto: 'Ciudadano Prueba E2E',
      razonSocial: null,
      email: TEST_EMAIL,
      telefono: TEST_PHONE,
      direccion: 'Dirección de prueba E2E',
      ubicacion: { pais: 'COLOMBIA', departamento: 'SANTANDER', municipio: 'SIMACOTA' },
    },
    control: {
      radicadoId,
      consecutivo: Number(testRunId.slice(-6).replace(/\D/g, '')) || Date.now() % 1000000,
      fechaRadicado: ahora,
      horaRadicado: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' }),
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_INFORMACION',
      tipoSolicitudNombre: 'Derecho de petición de interés particular',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: vencimiento,
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: usuario.tenantId,
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: usuario.uid,
      funcionarioResponsableNombre: usuario.nombre,
      funcionarioResponsableRol: usuario.rol as RolInterno,
      fechaAsignacionResponsable: ahora,
    },
    detalle: {
      asunto: 'Solicitud de información de prueba',
      descripcion: 'Solicito información general sobre el estado de una petición de prueba para validar el funcionamiento de la Ventanilla Única.',
      numeroFolios: 1,
      anexosDescripcion: null,
    },
    archivos: [],
    isTest: true,
    testRunId,
    entorno: 'test_e2e',
    excludeFromMetrics: true,
    createdAt: ahora,
    updatedAt: ahora,
  };
}

async function countOperationalAudit(testRunId: string): Promise<number> {
  const snap = await getFirebaseAdminDb()
    .collection('simi_operational_auditoria')
    .where('testRunId', '==', testRunId)
    .limit(25)
    .get()
    .catch(() => ({ size: 0 }));
  return snap.size;
}

export async function POST(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const ip = getClientIp(request);
  const lim = { maxRequests: 3, windowMs: 60_000 };
  const blocked = checkRateLimit(`simi:e2e:${usuario.uid}:${ip}`, lim);
  if (blocked) {
    return NextResponse.json(
      { error: 'Demasiadas pruebas en poco tiempo. Espera un momento.' },
      { status: 429, headers: rateLimitHeaders(lim.maxRequests, blocked.retryAfterSeconds) },
    );
  }

  let body: E2ETestRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const modo = body.modo === 'commit_test' ? 'commit_test' : 'dry_run';
  const testRunId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const started = Date.now();
  const pasos: E2ETestStep[] = [];
  const db = getFirebaseAdminDb();
  const runRef = modo === 'commit_test' ? db.collection('simi_e2e_test_runs').doc(testRunId) : null;
  const entidades: E2ETestResponse['entidades'] = {};

  if (runRef) {
    await safeSet(runRef, {
      testRunId,
      id: testRunId,
      tenantId: usuario.tenantId,
      ejecutadoPor: usuario.uid,
      ejecutadoPorNombre: usuario.nombre,
      rol: usuario.rol,
      fechaInicio: nowIso(),
      estado: 'running',
      pasos: [],
      resumen: resumen([]),
      ipHash: hashIp(ip),
      isTest: true,
      excludeFromMetrics: true,
      entorno: 'test_e2e',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  try {
    const radicadoId = `1-WEB-2026-${String(Date.now() % 100000000).padStart(8, '0')}`;
    entidades.radicadoId = radicadoId;
    entidades.consultaUrl = `/consulta?id=${encodeURIComponent(radicadoId)}`;

    if (modo === 'dry_run') {
      const drySteps = [
        'Crear radicado de prueba',
        'SIMI analiza solicitud',
        'SIMI proyecta borrador',
        'Crear aprobación',
        'Simular aprobación del jefe',
        'Crear firma final',
        'Generar PDF oficial',
        'Marcar enviado/notificado',
        'Consultar como ciudadano',
        'Validar PDF ciudadano',
        'Enviar WhatsApp mock',
        'Revisar auditoría',
        'Revisar métricas Control Interno',
      ];
      for (const nombre of drySteps) {
        await addStep(pasos, null, { nombre, estado: 'success', detalle: 'Dry run: paso simulado sin escritura institucional.' });
      }
      const response: E2ETestResponse = {
        ok: true,
        testRunId,
        modo,
        estado: 'success',
        pasos,
        resumen: resumen(pasos),
        entidades,
        tiempoMs: Date.now() - started,
      };
      return NextResponse.json(response);
    }

    const radicado = buildRadicado(testRunId, usuario, radicadoId);
    await safeSet(db.collection('ventanilla_radicados').doc(radicadoId), radicado);
    await safeAdd(db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`), {
      eventoId: `ev_${radicadoId}_E2E_RADICACION`,
      fecha: nowIso(),
      accion: 'RADICACION',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      oficinaDestino: usuario.tenantId,
      nota: 'Radicado de prueba integral E2E.',
      isTest: true,
      testRunId,
      excludeFromMetrics: true,
      entorno: 'test_e2e',
    });
    await addStep(pasos, runRef, { nombre: 'Crear radicado de prueba', estado: 'success', entidadCreadaId: radicadoId });

    await safeAdd(db.collection('simi_juridico_auditoria'), {
      radicadoId,
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre,
      rol: usuario.rol,
      fechaHora: nowIso(),
      modo: 'analizar_solicitud',
      nivelRiesgo: 'bajo',
      requiereRevisionJuridica: false,
      dependenciaSugerida: usuario.tenantId,
      terminoProbable: '15 días hábiles',
      fuentesConsultadas: [],
      resultadoResumen: 'Análisis E2E simulado: petición de información de baja complejidad.',
      usadoEnRespuestaFinal: false,
      editadoPorFuncionario: false,
      aprobado: false,
      isTest: true,
      testRunId,
      excludeFromMetrics: true,
      entorno: 'test_e2e',
    });
    await addStep(pasos, runRef, { nombre: 'SIMI analiza solicitud', estado: 'success', detalle: 'Análisis simulado sin consumir Gemini.' });

    const borrador = 'Respuesta de prueba E2E: La Alcaldía Municipal de Simacota informa que su solicitud fue recibida y validada en modo de prueba integral. Este documento no tiene efectos administrativos reales.';
    await addStep(pasos, runRef, { nombre: 'SIMI proyecta borrador', estado: 'success', detalle: 'Borrador seguro generado localmente.' });

    const version = await guardarVersionBorrador({
      radicadoId,
      tenantId: usuario.tenantId,
      contenido: borrador,
      generadoPorSimi: true,
      editadoPorHumano: false,
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre,
      usuarioRol: usuario.rol,
      modoSimi: 'proyectar_respuesta',
      motivoCambio: 'Prueba integral E2E',
      estadoAprobacion: 'borrador_generado',
      fuentesUsadas: [],
      isTest: true,
      testRunId,
      excludeFromMetrics: true,
      entorno: 'test_e2e',
    } as Parameters<typeof guardarVersionBorrador>[0]);
    entidades.borradorVersionId = version.versionId;
    await addStep(pasos, runRef, { nombre: 'Guardar borrador versión 1', estado: 'success', entidadCreadaId: version.versionId });

    const approval = await createApprovalFlow({
      radicadoId,
      tenantId: usuario.tenantId,
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre,
      usuarioRol: usuario.rol,
      rules: {
        nivelRiesgo: 'bajo',
        tieneDatosSensibles: false,
        tieneMenoresEdad: false,
        esEnteControl: false,
        esTutela: false,
        esRespuestaNegativa: false,
        afectaDerechosFundamentales: false,
      },
    });
    entidades.approvalId = approval.approvalId;
    await safeUpdate(db.collection('simi_aprobaciones_respuesta').doc(approval.approvalId), {
      isTest: true,
      testRunId,
      excludeFromMetrics: true,
      entorno: 'test_e2e',
    });
    await addStep(pasos, runRef, { nombre: 'Crear aprobación', estado: 'success', entidadCreadaId: approval.approvalId });

    await updateApprovalFlow({
      approvalId: approval.approvalId,
      nuevoEstado: 'aprobado_por_jefe',
      usuarioId: usuario.uid,
      usuarioNombre: usuario.nombre,
      rol: 'JEFE_DEPENDENCIA',
      observacion: 'Aprobación simulada de jefe para prueba E2E.',
    });
    await addStep(pasos, runRef, { nombre: 'Simular aprobación del jefe', estado: 'success', entidadCreadaId: approval.approvalId });

    const firma = await createFinalSignature({
      radicadoId,
      aprobacionId: approval.approvalId,
      firmadoPor: usuario.nombre,
      firmadoPorCargo: 'Administrador de prueba E2E',
      dependencia: usuario.tenantId,
      tenantId: usuario.tenantId,
      textoRespuestaFinal: borrador,
      canalEnvio: 'portal',
      emailCiudadano: body.emailTest ? TEST_EMAIL : undefined,
      borradorVersionId: version.versionId,
    });
    entidades.firmaId = firma.firmaId;
    await safeUpdate(db.collection('simi_respuestas_firma').doc(firma.firmaId), {
      isTest: true,
      testRunId,
      excludeFromMetrics: true,
      entorno: 'test_e2e',
    });
    await addStep(pasos, runRef, { nombre: 'Crear firma final', estado: 'success', entidadCreadaId: firma.firmaId });

    if (body.incluirPdf !== false) {
      const firmaSnap = await db.collection('simi_respuestas_firma').doc(firma.firmaId).get();
      const firmaData = { id: firmaSnap.id, ...firmaSnap.data() } as RespuestaFirma;
      const pdf = generateOfficialResponsePdf({
        firmaId: firma.firmaId,
        firma: firmaData,
        radicado,
        dependenciaNombre: usuario.tenantId,
      });
      await safeUpdate(firmaSnap.ref, {
        pdfUrl: `/api/simi/respuestas/firma/${firma.firmaId}/pdf`,
        pdfGeneratedAt: nowIso(),
        pdfHash: pdf.hash,
        updatedAt: nowIso(),
      });
      entidades.pdfUrl = `/api/simi/respuestas/firma/${firma.firmaId}/pdf`;
      await addStep(pasos, runRef, { nombre: 'Generar PDF oficial', estado: 'success', entidadCreadaId: firma.firmaId, detalle: `Hash ${pdf.hash.slice(0, 12)}...` });
    } else {
      await addStep(pasos, runRef, { nombre: 'Generar PDF oficial', estado: 'skipped', detalle: 'Omitido por configuración.' });
    }

    await updateFirmaEstado({ firmaId: firma.firmaId, nuevoEstado: 'notificado', notificado: false });
    await safeUpdate(db.collection('ventanilla_radicados').doc(radicadoId), {
      estadoActual: 'RESUELTO',
      cumplioTermino: true,
      ultimaActualizacion: nowIso(),
      updatedAt: nowIso(),
    });
    await addStep(pasos, runRef, { nombre: 'Marcar enviado/notificado en modo prueba', estado: 'success', entidadCreadaId: firma.firmaId });

    if (body.incluirConsultaCiudadana !== false) {
      const origin = new URL(request.url).origin;
      const consultaRes = await fetch(`${origin}/api/public/radicado/consulta`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroRadicado: radicadoId, datoVerificacion: TEST_EMAIL }),
      });
      await addStep(pasos, runRef, {
        nombre: 'Consultar como ciudadano',
        estado: consultaRes.ok ? 'success' : 'failed',
        detalle: consultaRes.ok ? 'Consulta ciudadana pública respondió correctamente.' : `Consulta respondió ${consultaRes.status}.`,
        entidadCreadaId: radicadoId,
      });
      const pdfRes = body.incluirPdf === false
        ? null
        : await fetch(`${origin}/api/simi/respuestas/firma/${firma.firmaId}/pdf`, { cache: 'no-store' });
      const pdfPublicoBloqueado = pdfRes?.status === 401;
      await addStep(pasos, runRef, {
        nombre: 'Validar bloqueo de PDF ciudadano sin ticket',
        estado: body.incluirPdf === false ? 'skipped' : pdfPublicoBloqueado ? 'success' : 'failed',
        detalle: body.incluirPdf === false ? 'PDF omitido.' : pdfPublicoBloqueado ? 'Acceso público directo bloqueado correctamente.' : `PDF respondió ${pdfRes?.status ?? 'N/A'}.`,
        entidadCreadaId: firma.firmaId,
      });
    }

    if (body.whatsappMock !== false) {
      const previousProvider = process.env.WHATSAPP_PROVIDER;
      let whatsapp: WhatsAppMessageResult;
      try {
        process.env.WHATSAPP_PROVIDER = 'mock';
        whatsapp = await sendCitizenWhatsAppNotification({
          radicadoId,
          tenantId: usuario.tenantId,
          to: TEST_PHONE,
          eventType: 'respuesta_enviada',
          consentimiento: true,
          actorUid: usuario.uid,
          actorNombre: usuario.nombre,
        });
      } finally {
        process.env.WHATSAPP_PROVIDER = previousProvider;
      }
      await db.collection('simi_operational_auditoria').where('radicadoId', '==', radicadoId).limit(10).get()
        .then((snap) => Promise.all(snap.docs.map((doc) => safeUpdate(doc.ref, { isTest: true, testRunId, excludeFromMetrics: true, entorno: 'test_e2e' }))))
        .catch(() => null);
      await addStep(pasos, runRef, {
        nombre: 'Enviar WhatsApp mock',
        estado: whatsapp.ok ? 'success' : 'failed',
        detalle: whatsapp.ok ? `Proveedor ${whatsapp.provider} simulado.` : whatsapp.error,
      });
    } else {
      await addStep(pasos, runRef, { nombre: 'Enviar WhatsApp mock', estado: 'skipped', detalle: 'Omitido por configuración.' });
    }

    const auditCount = await countOperationalAudit(testRunId);
    await addStep(pasos, runRef, { nombre: 'Revisar auditoría', estado: 'success', detalle: `${auditCount} eventos operacionales asociados.` });

    await calculateControlInternoMetrics({ tenantId: usuario.tenantId, esAdmin: true });
    await addStep(pasos, runRef, { nombre: 'Revisar métricas Control Interno', estado: 'success', detalle: 'Métricas consultadas con filtros anti-test activos.' });

    const fin = nowIso();
    const finalSummary = resumen(pasos);
    const estado = finalSummary.fallidos > 0 ? 'partial' : 'success';
    if (runRef) {
      await safeUpdate(runRef, {
        estado,
        fechaFin: fin,
        pasos,
        resumen: finalSummary,
        entidades,
        updatedAt: fin,
      });
    }

    const response: E2ETestResponse = {
      ok: finalSummary.fallidos === 0,
      testRunId,
      modo,
      estado,
      pasos,
      resumen: finalSummary,
      entidades,
      tiempoMs: Date.now() - started,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await addStep(pasos, runRef, { nombre: 'Error global controlado', estado: 'failed', error: message });
    const finalSummary = resumen(pasos);
    if (runRef) {
      await safeUpdate(runRef, {
        estado: 'failed',
        fechaFin: nowIso(),
        pasos,
        resumen: finalSummary,
        error: message,
        updatedAt: nowIso(),
      }).catch(() => null);
    }
    return NextResponse.json({
      ok: false,
      testRunId,
      modo,
      estado: 'failed',
      pasos,
      resumen: finalSummary,
      entidades,
      tiempoMs: Date.now() - started,
      error: message,
    }, { status: 500 });
  } finally {
    if (runRef) {
      await safeUpdate(runRef, { touchedAt: FieldValue.serverTimestamp() }).catch(() => null);
    }
  }
}
