/**
 * PATCH /api/simi/normograma/[id] — actualizar estado de un documento
 * DELETE /api/simi/normograma/[id] — eliminar (solo ADMIN)
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

async function verificarAdmin() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    const rol = d.rol as RolInterno;
    if (rol !== 'ADMIN') return null;
    return { uid: decoded.uid, nombre: d.nombre as string ?? '', tenantId: d.tenantId as TenantId };
  } catch { return null; }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const admin = await verificarAdmin();
  if (!admin) return NextResponse.json({ error: 'Solo el ADMIN puede modificar documentos normativos.' }, { status: 403 });

  const url = new URL(request.url);
  const coleccion = url.searchParams.get('coleccion') ?? 'normatividad_nacional';

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  const ahora = new Date().toISOString();
  const update: Record<string, unknown> = { ...body, updatedAt: ahora };

  // Si se valida internamente, registrar quién lo hizo
  if (body.estado === 'interna_validada') {
    update.validado_por     = admin.uid;
    update.fecha_validacion = ahora;
  }

  try {
    await getFirebaseAdminDb().collection(coleccion).doc(id).update(update);
    return NextResponse.json({ ok: true, mensaje: 'Documento actualizado.' });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const url = new URL(_request.url);
  const coleccion = url.searchParams.get('coleccion') ?? 'normatividad_nacional';

  const admin = await verificarAdmin();
  if (!admin) return NextResponse.json({ error: 'Solo el ADMIN puede eliminar documentos.' }, { status: 403 });

  try {
    await getFirebaseAdminDb().collection(coleccion).doc(id).delete();
    return NextResponse.json({ ok: true, mensaje: 'Documento eliminado.' });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
