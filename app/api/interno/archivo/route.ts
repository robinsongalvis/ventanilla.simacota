/**
 * GET /api/interno/archivo?path=...
 *
 * Sprint Seguridad P1-01 (H-01): la descarga de adjuntos internos exige:
 *
 *   1. Sesión interna activa (validada también por el middleware).
 *   2. Path estructuralmente válido y dentro de prefijos permitidos.
 *   3. Que el archivo pertenezca al radicado indicado en el path.
 *   4. Que el usuario tenga permiso institucional sobre ese radicado:
 *        - ADMIN / RECEPCIONISTA / CONTROL_INTERNO → global.
 *        - FUNCIONARIO / JEFE_DEPENDENCIA → solo su dependencia.
 *
 * Cuando alguna de estas condiciones falla, se responde con un mensaje
 * humano y un código HTTP estándar — nunca se filtran detalles internos
 * (bucket, ruta completa, stack traces, UID).
 */

import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import {
  aRadicadoParaDescarga,
  aSalidaParaDescarga,
  autorizarDescargaArchivo,
  autorizarDescargaDocumentoExpediente,
  autorizarDescargaSalida,
  parsearPathArchivo,
  parsearPathDocumentoExpediente,
  type ExpedienteParaDescarga,
  type ResultadoAutorizacion,
} from '@/lib/seguridad/autorizar-descarga-archivo';
import type { VersionDocumentoExpedienteDoc } from '@/lib/server/expedientes-documentos-tipos';
import { registrarDescargaAuditoria } from '@/lib/seguridad/auditoria-descargas';
import { getClientIp } from '@/lib/ai/rate-limit';
import { logError } from '@/lib/logger';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { SalidaOficial } from '@/src/types/salida';

export const runtime = 'nodejs';

const SIGNED_URL_EXPIRES_MS = 15 * 60 * 1000;

/** `expedientes/{expedienteId}/{documentoId}/{vNNNN}/{archivo}` — 4 segmentos tras el prefijo, distinto del resto. */
function esPathDocumentoExpediente(path: string): boolean {
  return path.startsWith('expedientes/');
}

function denegado(status: 400 | 401 | 403 | 404 | 500, mensaje: string): NextResponse {
  return NextResponse.json({ error: mensaje }, { status });
}

export async function GET(request: Request): Promise<NextResponse> {
  // 1. Sesión interna activa (middleware ya verifica; reforzamos en handler).
  let usuario;
  try {
    usuario = await requireActiveInternalUser();
  } catch (err) {
    if (err instanceof InternalAuthError) {
      const mensaje = err.status === 403
        ? 'Su usuario no tiene acceso al panel interno.'
        : 'Debe iniciar sesión nuevamente.';
      return denegado(err.status, mensaje);
    }
    return denegado(401, 'Debe iniciar sesión nuevamente.');
  }

  const path = new URL(request.url).searchParams.get('path');

  // Documentos de expediente (D7, Bloque A) — forma de path distinta (4
  // segmentos) y, a diferencia del resto, exige validar el HASH del
  // binario antes de entregarlo (INV-3): vive en su propio flujo, sin
  // tocar el de radicados/salidas de abajo.
  if (path && esPathDocumentoExpediente(path)) {
    return manejarDescargaDocumentoExpediente(request, usuario, path);
  }

  // 2. Path estructuralmente válido (parseo y validación temprana).
  const parsed = parsearPathArchivo(path);
  if (!parsed || !path) {
    return denegado(400, 'La ruta del archivo no es válida.');
  }

  // 3-4. Cargar el documento dueño según el prefijo y decidir la
  // autorización (pertenencia anti-IDOR + rol + dependencia). Los
  // oficios de salida (Fase B) pertenecen a `ventanilla_salidas`; todo
  // lo demás sigue girando alrededor del radicado.
  let decision: ResultadoAutorizacion;
  try {
    if (parsed.prefijo === 'salidas') {
      const snap = await getFirebaseAdminDb()
        .doc(`ventanilla_salidas/${parsed.radicadoId}`)
        .get();
      const salida = snap.exists ? (snap.data() as SalidaOficial) : null;
      decision = autorizarDescargaSalida({
        path,
        usuario,
        salida: aSalidaParaDescarga(salida),
      });
    } else {
      const snap = await getFirebaseAdminDb()
        .doc(`ventanilla_radicados/${parsed.radicadoId}`)
        .get();
      const radicado = snap.exists ? (snap.data() as VentanillaRadicado) : null;
      decision = autorizarDescargaArchivo({
        path,
        usuario,
        radicado: aRadicadoParaDescarga(radicado),
      });
    }
  } catch (err) {
    logError({
      radicadoId: parsed.radicadoId,
      modulo: 'interno/archivo/leer-documento',
      error: err,
    });
    return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
  }

  if (!decision.ok) {
    // Auditoría de denegación: información mínima de seguridad, sin path completo.
    console.warn('[ventanilla:audit]', JSON.stringify({
      evento:     'ARCHIVO_DESCARGA_DENEGADA',
      radicadoId: parsed.radicadoId,
      motivo:     decision.motivo,
      actorRol:   usuario.rol,
      actorTenant: usuario.tenantId,
      prefijo:    parsed.prefijo,
      timestamp:  new Date().toISOString(),
    }));
    // H-N04: auditoría persistente en Firestore (fire-and-forget).
    await registrarDescargaAuditoria({
      evento:        'ARCHIVO_DESCARGA_DENEGADA',
      radicadoId:    parsed.radicadoId,
      archivoNombre: (path.split('/').pop() ?? '').slice(0, 200),
      tipoArchivo:   null,
      motivo:        decision.motivo,
      actorUid:      usuario.uid,
      actorNombre:   usuario.nombre,
      actorRol:      usuario.rol,
      actorTenant:   usuario.tenantId,
      // IP normalizada a una sola dirección (getClientIp) en vez del header
      // `x-forwarded-for` crudo, que puede ser multivalor. registrarDescargaAuditoria
      // la hashea (HMAC-SHA256) antes de persistir; nunca se guarda en claro.
      ip:            getClientIp(request),
      userAgent:     request.headers.get('user-agent'),
    });
    return denegado(decision.status, decision.mensaje);
  }

  // 5. Generar URL firmada (corta).
  try {
    const bucket = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucket) {
      logError({
        radicadoId: parsed.radicadoId,
        modulo: 'interno/archivo/config',
        error: new Error('FIREBASE_STORAGE_BUCKET no configurado.'),
      });
      return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
    }

    const [signedUrl] = await getFirebaseAdminStorage()
      .bucket(bucket)
      .file(path)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + SIGNED_URL_EXPIRES_MS,
      });

    // Auditoría de descarga autorizada (no es un error → solo consola estructurada).
    console.info('[ventanilla:audit]', JSON.stringify({
      evento:     'ARCHIVO_DESCARGA_AUTORIZADA',
      radicadoId: decision.radicadoId,
      tipo:       decision.tipoArchivo,
      actorRol:   usuario.rol,
      actorTenant: usuario.tenantId,
      timestamp:  new Date().toISOString(),
    }));
    // H-N04: auditoría persistente en Firestore (fire-and-forget).
    await registrarDescargaAuditoria({
      evento:        'ARCHIVO_DESCARGA_AUTORIZADA',
      radicadoId:    decision.radicadoId,
      archivoNombre: (path.split('/').pop() ?? '').slice(0, 200),
      tipoArchivo:   decision.tipoArchivo,
      actorUid:      usuario.uid,
      actorNombre:   usuario.nombre,
      actorRol:      usuario.rol,
      actorTenant:   usuario.tenantId,
      // Ver nota en la rama de denegación: IP normalizada; el hash lo aplica
      // registrarDescargaAuditoria internamente.
      ip:            getClientIp(request),
      userAgent:     request.headers.get('user-agent'),
    });

    return NextResponse.redirect(signedUrl, { status: 302 });
  } catch (err) {
    logError({
      radicadoId: parsed.radicadoId,
      modulo: 'interno/archivo/firmar',
      error: err,
    });
    return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
  }
}

/* ══════════════════════════════════════════════════════════════
   Documentos de expediente (D7, Bloque A·A2) — flujo separado:
   autoriza por TENANT del expediente (anti-IDOR) y, a diferencia del
   resto de este endpoint, valida el HASH del binario (INV-3) ANTES de
   entregarlo — por eso descarga los bytes y los sirve directamente en
   vez de emitir una URL firmada (que nunca pasaría por este servidor
   para poder hashearla).
══════════════════════════════════════════════════════════════ */
async function manejarDescargaDocumentoExpediente(
  request: Request,
  usuario: Awaited<ReturnType<typeof requireActiveInternalUser>>,
  path: string,
): Promise<NextResponse> {
  const parsed = parsearPathDocumentoExpediente(path);
  if (!parsed) {
    return denegado(400, 'La ruta del archivo no es válida.');
  }

  let decision: ResultadoAutorizacion;
  try {
    const snap = await getFirebaseAdminDb().doc(`expedientes/${parsed.expedienteId}`).get();
    const expediente = snap.exists ? (snap.data() as { tenantId?: string }) : null;
    const expedienteParaDescarga: ExpedienteParaDescarga | null = expediente?.tenantId
      ? { tenantId: expediente.tenantId }
      : null;
    decision = autorizarDescargaDocumentoExpediente({ path, usuario, expediente: expedienteParaDescarga });
  } catch (err) {
    logError({ radicadoId: parsed.expedienteId, modulo: 'interno/archivo/leer-expediente', error: err });
    return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
  }

  if (!decision.ok) {
    console.warn('[ventanilla:audit]', JSON.stringify({
      evento: 'ARCHIVO_DESCARGA_DENEGADA',
      radicadoId: parsed.expedienteId,
      motivo: decision.motivo,
      actorRol: usuario.rol,
      actorTenant: usuario.tenantId,
      prefijo: 'expedientes',
      timestamp: new Date().toISOString(),
    }));
    await registrarDescargaAuditoria({
      evento: 'ARCHIVO_DESCARGA_DENEGADA',
      radicadoId: parsed.expedienteId,
      archivoNombre: parsed.nombre.slice(0, 200),
      tipoArchivo: null,
      motivo: decision.motivo,
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      actorRol: usuario.rol,
      actorTenant: usuario.tenantId,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });
    return denegado(decision.status, decision.mensaje);
  }

  // INV-3: valida el hash del binario contra el doc de versión ANTES de
  // entregar un solo byte. Si no coincide (corrupción, manipulación de
  // Storage por fuera de esta vía), 500 + log, y NUNCA se entrega.
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      logError({ radicadoId: parsed.expedienteId, modulo: 'interno/archivo/config', error: new Error('FIREBASE_STORAGE_BUCKET no configurado.') });
      return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
    }

    const versionRef = getFirebaseAdminDb().doc(
      `expedientes/${parsed.expedienteId}/documentos/${parsed.documentoId}/versiones/${parsed.idVersion}`,
    );
    const versionSnap = await versionRef.get();
    if (!versionSnap.exists) {
      return denegado(404, 'Archivo no encontrado.');
    }
    const version = versionSnap.data() as VersionDocumentoExpedienteDoc;

    const [bytes] = await getFirebaseAdminStorage().bucket(bucketName).file(path).download();
    const hashCalculado = createHash('sha256').update(bytes).digest('hex');

    if (hashCalculado !== version.hashSha256) {
      logError({
        radicadoId: parsed.expedienteId,
        modulo: 'interno/archivo/hash-mismatch',
        error: new Error(`Hash no coincide para ${path}: esperado ${version.hashSha256}, calculado ${hashCalculado}.`),
      });
      return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
    }

    console.info('[ventanilla:audit]', JSON.stringify({
      evento: 'ARCHIVO_DESCARGA_AUTORIZADA',
      radicadoId: decision.radicadoId,
      tipo: decision.tipoArchivo,
      actorRol: usuario.rol,
      actorTenant: usuario.tenantId,
      timestamp: new Date().toISOString(),
    }));
    await registrarDescargaAuditoria({
      evento: 'ARCHIVO_DESCARGA_AUTORIZADA',
      radicadoId: decision.radicadoId,
      archivoNombre: parsed.nombre.slice(0, 200),
      tipoArchivo: decision.tipoArchivo,
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      actorRol: usuario.rol,
      actorTenant: usuario.tenantId,
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
    });

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': version.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${parsed.nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    logError({ radicadoId: parsed.expedienteId, modulo: 'interno/archivo/servir-expediente', error: err });
    return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
  }
}
