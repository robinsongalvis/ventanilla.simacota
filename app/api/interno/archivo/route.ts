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

import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import {
  aRadicadoParaDescarga,
  autorizarDescargaArchivo,
  parsearPathArchivo,
} from '@/lib/seguridad/autorizar-descarga-archivo';
import { logError } from '@/lib/logger';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

const SIGNED_URL_EXPIRES_MS = 15 * 60 * 1000;

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

  // 2. Path estructuralmente válido (parseo y validación temprana).
  const path = new URL(request.url).searchParams.get('path');
  const parsed = parsearPathArchivo(path);
  if (!parsed || !path) {
    return denegado(400, 'La ruta del archivo no es válida.');
  }

  // 3. Cargar el radicado al que pertenece el archivo según el path.
  let radicado: VentanillaRadicado | null = null;
  try {
    const snap = await getFirebaseAdminDb()
      .doc(`ventanilla_radicados/${parsed.radicadoId}`)
      .get();
    radicado = snap.exists ? (snap.data() as VentanillaRadicado) : null;
  } catch (err) {
    logError({
      radicadoId: parsed.radicadoId,
      modulo: 'interno/archivo/leer-radicado',
      error: err,
    });
    return denegado(500, 'No fue posible generar la descarga. Intente nuevamente.');
  }

  // 4. Decisión de autorización (pertenencia + rol + dependencia).
  const decision = autorizarDescargaArchivo({
    path,
    usuario,
    radicado: aRadicadoParaDescarga(radicado),
  });

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
