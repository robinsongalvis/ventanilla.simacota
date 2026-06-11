/**
 * POST /api/simi/respuestas/firma — Crear firma final de respuesta.
 * Requiere aprobación humana previa. Registra la versión exacta enviada.
 */

import { NextResponse }         from 'next/server';
import { cookies }              from 'next/headers';
import { SESSION_COOKIE_NAME }  from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { createFinalSignature } from '@/lib/simi-juridico/createFinalSignature';
import type { RolInterno }      from '@/lib/hooks/useAuth';
import type { TenantId }        from '@/src/types/radicado';
import type { CanalEnvio }      from '@/src/types/simi-firma';

export const runtime = 'nodejs';

const PUEDE_FIRMAR = new Set<RolInterno>(['ADMIN', 'JEFE_DEPENDENCIA']);

async function verificarSesion() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, false);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    return {
      uid:      decoded.uid,
      nombre:   d.nombre as string ?? '',
      cargo:    d.cargo  as string ?? '',
      rol:      d.rol    as RolInterno,
      tenantId: d.tenantId as TenantId,
    };
  } catch { return null; }
}

export async function POST(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!PUEDE_FIRMAR.has(usuario.rol)) {
    return NextResponse.json({ error: 'Su rol no tiene permiso para firmar respuestas.' }, { status: 403 });
  }

  let body: {
    radicadoId:           string;
    aprobacionId:         string;
    textoRespuestaFinal?: string;
    canalEnvio?:          CanalEnvio;
    emailCiudadano?:      string;
    borradorVersionId?:   string;
    dependencia?:         string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  if (!body.radicadoId || !body.aprobacionId) {
    return NextResponse.json({ error: 'Campos requeridos: radicadoId, aprobacionId.' }, { status: 400 });
  }

  try {
    const result = await createFinalSignature({
      radicadoId:          body.radicadoId,
      aprobacionId:        body.aprobacionId,
      firmadoPor:          usuario.nombre,
      firmadoPorCargo:     usuario.cargo || undefined,
      dependencia:         body.dependencia ?? usuario.tenantId,
      tenantId:            usuario.tenantId,
      textoRespuestaFinal: body.textoRespuestaFinal,
      canalEnvio:          body.canalEnvio,
      emailCiudadano:      body.emailCiudadano,
      borradorVersionId:   body.borradorVersionId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
