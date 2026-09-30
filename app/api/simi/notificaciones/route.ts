/**
 * GET /api/simi/notificaciones  — obtener notificaciones del usuario
 * PATCH /api/simi/notificaciones — marcar como leídas
 */

import { NextResponse }        from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import type { InternalUserSession } from '@/lib/server/internal-auth';

export const runtime = 'nodejs';

// Los documentos y el JSON entrante son fronteras no confiables: se comprueba
// cada campo antes de conceder acceso, sin aceptar un cast como autorización.
function esDestinatario(usuario: InternalUserSession, documento: Record<string, unknown>): boolean {
  return documento.tenantId === usuario.tenantId
    && documento.destinatarioRol === usuario.rol
    && (documento.destinatarioUid === undefined || documento.destinatarioUid === usuario.uid);
}

function idsValidos(body: unknown): body is { ids: string[] } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  if (Object.keys(body).length !== 1 || !('ids' in body)) return false;
  return Array.isArray(body.ids)
    && body.ids.length > 0 && body.ids.length <= 100
    && body.ids.every((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id))
    && new Set(body.ids).size === body.ids.length;
}

class NotificacionAccessError extends Error {
  constructor(message: string, readonly status: 403 | 404) {
    super(message);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  const url   = new URL(request.url);
  const soloNoLeidas = url.searchParams.get('noLeidas') === 'true';

  try {
    const db = getFirebaseAdminDb();
    let q = db.collection('simi_notificaciones')
      .where('tenantId', '==', usuario.tenantId)
      .where('destinatarioRol', '==', usuario.rol)
      .orderBy('createdAt', 'desc')
      .limit(30);

    if (soloNoLeidas) {
      q = db.collection('simi_notificaciones')
        .where('tenantId', '==', usuario.tenantId)
        .where('destinatarioRol', '==', usuario.rol)
        .where('leida', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(20);
    }

    const snap = await q.get();
    const notifs = snap.docs
      .filter((d) => esDestinatario(usuario, d.data()))
      .map((d) => ({ ...d.data(), id: d.id }));
    const sinLeer = notifs.filter((n: Record<string, unknown>) => !n.leida).length;

    return NextResponse.json({ ok: true, notificaciones: notifs, sinLeer });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  if (!idsValidos(body)) {
    return NextResponse.json({ error: 'Se requieren entre 1 y 100 IDs de notificación válidos, únicos y sin campos adicionales.' }, { status: 400 });
  }

  try {
    const db = getFirebaseAdminDb();
    const refs = body.ids.map((id) => db.collection('simi_notificaciones').doc(id));
    await db.runTransaction(async (transaction) => {
      const documentos = await transaction.getAll(...refs);
      for (const documento of documentos) {
        if (!documento.exists) {
          throw new NotificacionAccessError('Una de las notificaciones no existe.', 404);
        }
        if (!esDestinatario(usuario, documento.data() ?? {})) {
          throw new NotificacionAccessError('Sin permiso para marcar una de las notificaciones.', 403);
        }
      }
      // Todas las lecturas y permisos se resuelven antes de la primera escritura.
      // Firestore revalida las lecturas si el destinatario cambia concurrentemente.
      for (const ref of refs) transaction.update(ref, { leida: true });
    });
    return NextResponse.json({ ok: true, marcadas: body.ids.length });
  } catch (error) {
    if (error instanceof NotificacionAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[api/notificaciones]', error);
    return NextResponse.json({ error: 'No fue posible marcar las notificaciones. Intente de nuevo.' }, { status: 500 });
  }
}
