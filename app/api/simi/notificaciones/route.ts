/**
 * GET /api/simi/notificaciones  — obtener notificaciones del usuario
 * PATCH /api/simi/notificaciones — marcar como leídas
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { marcarLeida }         from '@/lib/simi-juridico/createNotification';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

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
    return { uid: decoded.uid, rol: d.rol as RolInterno, tenantId: d.tenantId as TenantId };
  } catch { return null; }
}

export async function GET(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

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
    const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const sinLeer = notifs.filter((n: Record<string, unknown>) => !n.leida).length;

    return NextResponse.json({ ok: true, notificaciones: notifs, sinLeer });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { ids } = await request.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Se requiere array de ids.' }, { status: 400 });
  }

  await Promise.all(ids.map(marcarLeida));
  return NextResponse.json({ ok: true, marcadas: ids.length });
}
