import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/ai/rate-limit';
import { verificarMagicBytes } from '@/lib/seguridad/magic-bytes';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import {
  calcularFechaVencimiento,
  TIPOS_PQRSD_CIUDADANO,
  TIPOS_SOLICITUD,
  type TipoSolicitudId,
} from '@/lib/tiempos-radicado';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildConfirmacionRadicacionHtml,
  buildConfirmacionRadicacionSubject,
} from '@/lib/email/templates/confirmacion-radicacion';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import { registrarTrazabilidadNotificacion } from '@/lib/trazabilidad/notificacion';
import { logError } from '@/lib/logger';
import {
  generarTokenConsulta,
  hashTokenConsulta,
} from '@/lib/seguridad/consulta-publica-radicado';
import { validarReglasRadicacion } from '@/lib/seguridad/reglas-radicacion';
import type { Prioridad, TenantId, TipoPresentacionPqrsd, ZonaGeografica } from '@/src/types/radicado';
import type {
  AnalisisIA,
  ArchivoRadicado,
  CanalRespuesta,
  MedioRecepcion,
  TipoDocumento,
  VentanillaRadicado,
} from '@/src/types/ventanilla';


export const runtime = 'nodejs';

const MAX_FILES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // XLSX
]);
const CANALES_RESPUESTA = new Set<CanalRespuesta>([
  'CORREO',
  'PRESENCIAL',
  'TELEFONO',
  'DIRECCION_FISICA',
]);
const TIPOS_PRESENTACION = new Set<TipoPresentacionPqrsd>(['IDENTIFICADA', 'ANONIMA', 'RESERVADA']);
const CANAL_RADICADO = 'WEB';
const MEDIO_RECEPCION: MedioRecepcion = 'WEB';
const TENANT_RECEPCION: TenantId = 'VENTANILLA_UNICA';
const ZONA_DEFAULT: ZonaGeografica = 'CASCO_URBANO';
const RATE_LIMIT = { maxRequests: 8, windowMs: 60_000 };

interface ErrorResponse {
  exito: false;
  error: string;
  errores: string[];
}

function badRequest(error: string, errores: string[] = [error]): NextResponse<ErrorResponse> {
  return NextResponse.json({ exito: false, error, errores }, { status: 400 });
}

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip') || 'unknown';
}

function isTipoSolicitud(value: string): value is TipoSolicitudId {
  return value in TIPOS_SOLICITUD && TIPOS_PQRSD_CIUDADANO.includes(value as TipoSolicitudId);
}

function isCanalRespuesta(value: string): value is CanalRespuesta {
  return CANALES_RESPUESTA.has(value as CanalRespuesta);
}

function isTipoPresentacion(value: string): value is TipoPresentacionPqrsd {
  return TIPOS_PRESENTACION.has(value as TipoPresentacionPqrsd);
}

function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_.\- ]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'archivo';
}

function validarCampos({
  nombre,
  email,
  telefono,
  direccion,
  descripcion,
  tipoPresentacion,
  canalRespuesta,
}: {
  nombre: string;
  email: string;
  telefono: string;
  direccion: string;
  descripcion: string;
  tipoPresentacion: TipoPresentacionPqrsd;
  canalRespuesta: CanalRespuesta;
}): string[] {
  const errores: string[] = [];
  const esAnonimo = tipoPresentacion === 'ANONIMA';

  if (!esAnonimo && nombre.length < 3) {
    errores.push('Registra el nombre completo o razón social del solicitante.');
  }

  if (descripcion.length < 20) {
    errores.push('Describe la solicitud con al menos 20 caracteres.');
  }

  if (canalRespuesta === 'CORREO' && !email) {
    errores.push('El correo electrónico es obligatorio para recibir respuesta por correo.');
  }

  if (canalRespuesta === 'CORREO' && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errores.push('El correo electrónico no tiene un formato válido.');
  }

  if (canalRespuesta === 'TELEFONO' && !telefono) {
    errores.push('El teléfono es obligatorio cuando el canal de respuesta es telefónico.');
  }

  if (canalRespuesta === 'DIRECCION_FISICA' && !direccion) {
    errores.push('La dirección física es obligatoria para notificación por correspondencia.');
  }

  return errores;
}

function validarArchivos(files: File[]): string[] {
  const errores: string[] = [];

  if (files.length > MAX_FILES) {
    errores.push(`Solo se permiten hasta ${MAX_FILES} archivos adjuntos.`);
  }

  files.forEach((file) => {
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      errores.push(`El archivo ${file.name} debe ser PDF, JPG, PNG, DOCX o XLSX.`);
    }

    if (file.size > MAX_FILE_SIZE) {
      errores.push(`El archivo ${file.name} supera el tamaño máximo de 5 MB.`);
    }
  });

  return errores;
}

async function generarRadicadoInstitucionalAdmin(fecha: Date): Promise<{
  radicadoId: string;
  consecutivo: number;
}> {
  const db = getFirebaseAdminDb();
  const year = fecha.getFullYear();
  const counterRef = db.doc(`counters/radicados-${year}`);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(counterRef);
    const ultimo = Number(snap.data()?.ultimo ?? 0);
    const consecutivo = ultimo + 1;

    transaction.set(counterRef, {
      anio: year,
      ultimo: consecutivo,
      actualizadoEn: fecha.toISOString(),
      canal: CANAL_RADICADO,
    }, { merge: true });

    return {
      consecutivo,
      radicadoId: `1-${CANAL_RADICADO}-${year}-${String(consecutivo).padStart(8, '0')}`,
    };
  });
}

async function subirArchivoAdmin(file: File, radicadoId: string, orden: number): Promise<ArchivoRadicado> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('FIREBASE_STORAGE_BUCKET no configurado.');
  }

  const filename = `${Date.now()}_${orden}_${sanitizeFilename(file.name)}`;
  const path = `radicados/${radicadoId}/${filename}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await getFirebaseAdminStorage()
    .bucket(bucketName)
    .file(path)
    .save(buffer, {
      resumable: false,
      metadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

  return {
    nombre: file.name,
    url: '',
    path,
    tipo: file.type || 'application/octet-stream',
    tamanioKB: Math.max(1, Math.round(file.size / 1024)),
    orden,
  };
}

function parseAnalisisIa(value: string): AnalisisIA | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as Partial<AnalisisIA>;
    if (
      typeof parsed.resumenEjecutivo === 'string'
      && Array.isArray(parsed.etiquetasSemanticas)
      && typeof parsed.dependenciaSugerida === 'string'
      && typeof parsed.confianzaClasificacion === 'number'
    ) {
      return {
        resumenEjecutivo: parsed.resumenEjecutivo,
        etiquetasSemanticas: parsed.etiquetasSemanticas.filter((item): item is string => typeof item === 'string'),
        dependenciaSugerida: parsed.dependenciaSugerida as TenantId,
        confianzaClasificacion: parsed.confianzaClasificacion,
        fechaAnalisis: typeof parsed.fechaAnalisis === 'string' ? parsed.fechaAnalisis : new Date().toISOString(),
        promptVersion: typeof parsed.promptVersion === 'string' ? parsed.promptVersion : undefined,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limited = checkRateLimit(`radicacion:${ip}`, RATE_LIMIT);
    if (limited) {
      return NextResponse.json({
        exito: false,
        error: 'Has realizado varias solicitudes en poco tiempo. Espera un momento e intenta nuevamente.',
        errores: ['Has realizado varias solicitudes en poco tiempo. Espera un momento e intenta nuevamente.'],
      }, {
        status: 429,
        headers: {
          'Retry-After': String(limited.retryAfterSeconds),
          'X-RateLimit-Limit': String(RATE_LIMIT.maxRequests),
        },
      });
    }

    const formData = await request.formData();
    const tipoSolicitudIdRaw = getText(formData, 'tipoSolicitudId');
    const tipoPresentacionRaw = getText(formData, 'tipoPresentacion') || 'IDENTIFICADA';
    const canalRespuestaRaw = getText(formData, 'canalRespuesta') || 'CORREO';

    if (!isTipoSolicitud(tipoSolicitudIdRaw)) {
      return badRequest('Tipo de solicitud no válido.');
    }

    if (!isTipoPresentacion(tipoPresentacionRaw)) {
      return badRequest('Tipo de presentación no válido.');
    }

    if (!isCanalRespuesta(canalRespuestaRaw)) {
      return badRequest('Canal de respuesta no válido.');
    }

    const nombre = getText(formData, 'nombre');
    const email = getText(formData, 'email').toLowerCase();
    const telefono = getText(formData, 'telefono').replace(/\s/g, '');
    const direccion = getText(formData, 'direccion');
    const descripcion = getText(formData, 'descripcion');
    const analisisIa = parseAnalisisIa(getText(formData, 'analisisIa'));
    const files = formData.getAll('archivos').filter((value): value is File => value instanceof File && value.size > 0);

    // Sprint 1.5 — reglas de negocio delegadas a lib/seguridad/reglas-radicacion.
    // El flujo público ciudadano normalmente no marca noAportaCorreo, pero
    // validamos defensivamente por si llega vía integraciones o formularios
    // internos que reutilicen este endpoint.
    const noAportaCorreo = getText(formData, 'noAportaCorreo') === 'true';
    const errorReglas = validarReglasRadicacion({
      noAportaCorreo,
      canalRespuesta: canalRespuestaRaw,
    });

    const errores = [
      ...validarCampos({
        nombre,
        email,
        telefono,
        direccion,
        descripcion,
        tipoPresentacion: tipoPresentacionRaw,
        canalRespuesta: canalRespuestaRaw,
      }),
      ...(errorReglas ? [errorReglas] : []),
      ...validarArchivos(files),
    ];

    if (errores.length > 0) {
      return badRequest('La solicitud tiene datos pendientes por corregir.', errores);
    }

    // H-08: verificar firma binaria / estructura del buffer real.
    // El Content-Type y la extensión son falsificables; PDF/JPG/PNG se validan
    // por firma, DOCX/XLSX por presencia de [Content_Types].xml + carpeta
    // esperada y ausencia de vbaProject.bin (macro disfrazada).
    const erroresMagicBytes: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      if (!verificarMagicBytes(buffer, file.type)) {
        erroresMagicBytes.push(
          `El archivo ${file.name} no tiene una firma válida para su tipo declarado.`,
        );
      }
    }
    if (erroresMagicBytes.length > 0) {
      return badRequest('La solicitud tiene datos pendientes por corregir.', erroresMagicBytes);
    }

    const ahora = new Date();
    const { radicadoId, consecutivo } = await generarRadicadoInstitucionalAdmin(ahora);
    const termino = calcularFechaVencimiento(ahora, tipoSolicitudIdRaw);
    const archivos = await Promise.all(files.map((file, index) => subirArchivoAdmin(file, radicadoId, index + 1)));
    const tipoSolicitud = TIPOS_SOLICITUD[tipoSolicitudIdRaw];
    const esAnonimo = tipoPresentacionRaw === 'ANONIMA';
    const identidadReservada = tipoPresentacionRaw === 'RESERVADA';
    const solicitanteNombre = esAnonimo ? 'Anónimo / Reservado' : nombre;
    const consultaToken = !email ? generarTokenConsulta() : undefined;
    const asunto = `${tipoSolicitud.nombre}: ${descripcion.slice(0, 90)}${descripcion.length > 90 ? '...' : ''}`;

    const radicado: VentanillaRadicado = removeUndefinedDeep({
      radicadoId,
      estadoActual: 'PENDIENTE',
      ultimaActualizacion: ahora.toISOString(),
      prioridad: tipoSolicitud.prioridadSugerida as Prioridad,
      cumplioTermino: null,
      esAnonimo,
      tipoPresentacion: tipoPresentacionRaw,
      identidadReservada,
      ...(consultaToken ? { consultaTokenHash: hashTokenConsulta(consultaToken) } : {}),
      canalRespuesta: canalRespuestaRaw,
      solicitante: {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'OTRO' as TipoDocumento,
        numeroDocumento: '',
        nombreCompleto: solicitanteNombre,
        razonSocial: null,
        email: esAnonimo ? null : email || null,
        telefono: esAnonimo ? null : telefono || null,
        direccion: esAnonimo ? null : direccion || null,
        ubicacion: {
          pais: 'Colombia',
          departamento: 'Santander',
          municipio: 'Simacota',
        },
      },
      control: {
        radicadoId,
        consecutivo,
        fechaRadicado: ahora.toISOString(),
        horaRadicado: ahora.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        medioRecepcion: MEDIO_RECEPCION,
        origen: 'WEB',
      },
      termino: {
        tipoSolicitudId: tipoSolicitud.id,
        tipoSolicitudNombre: tipoSolicitud.nombre,
        diasRespuesta: termino.diasRespuesta,
        unidad: termino.unidad,
        fechaVencimiento: termino.fechaVencimiento,
        prorrogasAplicadas: 0,
      },
      clasificacion: {
        oficinaDestino: TENANT_RECEPCION,
        zonaGeografica: ZONA_DEFAULT,
      },
      detalle: {
        asunto,
        descripcion,
        numeroFolios: archivos.length,
        anexosDescripcion: archivos.length > 0 ? `${archivos.length} archivo(s) adjunto(s)` : null,
      },
      archivos,
      analisisIa,
    });

    const db = getFirebaseAdminDb();
    await db.doc(`ventanilla_radicados/${radicadoId}`).set(radicado);
    await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).add(removeUndefinedDeep({
      eventoId: `ev_${radicadoId}_RADICACION`,
      fecha: ahora.toISOString(),
      accion: 'RADICACION',
      actorUid: 'portal-ciudadano',
      actorNombre: 'Portal ciudadano',
      oficinaDestino: TENANT_RECEPCION,
      nota: `Radicado creado desde el portal ciudadano. Canal de respuesta: ${canalRespuestaRaw}.`,
      metadata: {
        tipoSolicitudId: tipoSolicitud.id,
        tipoPresentacion: tipoPresentacionRaw,
        esAnonimo,
        identidadReservada,
        archivos: archivos.length,
      },
    }));

    // Sprint 1.5 — evento operativo cuando el ciudadano marcó noAportaCorreo
    // en el endpoint público. Hoy solo entra por esa casilla; el shape del
    // metadata es igual al del flujo interno para uniformidad de reportes.
    // No se muestra en la línea de tiempo pública.
    if (noAportaCorreo) {
      await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).add(removeUndefinedDeep({
        eventoId: `ev_${radicadoId}_DATOS_NO_APORTADOS`,
        fecha: ahora.toISOString(),
        accion: 'DATOS_NO_APORTADOS_MARCADOS',
        actorUid: 'portal-ciudadano',
        actorNombre: 'Portal ciudadano',
        oficinaDestino: TENANT_RECEPCION,
        nota: 'El solicitante no aportó: correo.',
        metadata: {
          documento: false,
          correo:    true,
          telefono:  false,
          direccion: false,
        },
      }));
    }

    // ── Email de confirmación al ciudadano (síncrono, no bloqueante) ──
    // Se espera al envío SMTP antes de responder para garantizar trazabilidad
    // real y compatibilidad con Vercel serverless (las promesas pendientes se
    // matan al retornar la función). El radicado ya quedó persistido — un
    // fallo SMTP nunca lo revierte; solo se registra en trazabilidad y se
    // levanta el flag `alertaNotificacionFallida`.
    let emailEnviado = false;
    let emailError: string | undefined;
    const debeEnviar = debeNotificarCiudadano({
      esAnonimo,
      tipoPresentacion: tipoPresentacionRaw,
      solicitante: { email: esAnonimo ? null : email || null },
    });

    if (debeEnviar) {
      const destinatario = email;
      try {
        await enviarEmail({
          to:      destinatario,
          subject: buildConfirmacionRadicacionSubject(radicadoId),
          html:    buildConfirmacionRadicacionHtml({
            radicadoId,
            ciudadanoNombre:  solicitanteNombre,
            tipoSolicitud:    tipoSolicitud.nombre,
            fechaRadicado:    ahora.toISOString(),
            fechaVencimiento: termino.fechaVencimiento,
            canalRespuesta:   canalRespuestaRaw,
            descripcionCorta: descripcion.slice(0, 120),
          }),
        });
        emailEnviado = true;
        await registrarTrazabilidadNotificacion({
          radicadoId,
          tipoNotificacion: 'RADICACION',
          destinatario,
          estado:           'ENVIADA',
        });
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
        logError({
          radicadoId,
          modulo: 'radicacion/email-confirmacion',
          error:  err,
        });
        await registrarTrazabilidadNotificacion({
          radicadoId,
          tipoNotificacion: 'RADICACION',
          destinatario,
          estado:           'FALLIDA',
          error:            emailError,
        });
      }
    }

    return NextResponse.json({
      exito: true,
      radicadoId,
      errores: [],
      archivosSubidos: archivos.length,
      archivosFallidos: 0,
      fechaRadicado: ahora.toISOString(),
      fechaVencimiento: termino.fechaVencimiento,
      dependenciaReceptora: TENANT_RECEPCION,
      emailEnviado,
      ...(consultaToken ? { consultaToken } : {}),
      ...(emailError ? { emailError } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible crear el radicado.';
    console.error('[api/radicacion] Error creando radicado:', message);
    return NextResponse.json({
      exito: false,
      error: 'No fue posible radicar la solicitud. Intenta nuevamente o comunícate con la Alcaldía.',
      errores: ['No fue posible radicar la solicitud. Intenta nuevamente o comunícate con la Alcaldía.'],
    }, { status: 500 });
  }
}
