/**
 * GET /api/simi/juridico/aprobaciones
 * Cola de aprobaciones con filtros.
 *
 * Accesible para: ADMIN, JEFE_DEPENDENCIA, CONTROL_INTERNO
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { ApprovalFlow, ApprovalStatus } from '@/src/types/simi-approval';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

const ROLES_PERMITIDOS = new Set<RolInterno>(['ADMIN', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO']);

async function verificarSesion() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    return {
      uid:      decoded.uid,
      rol:      d.rol as RolInterno,
      tenantId: d.tenantId as TenantId,
    };
  } catch { return null; }
}

export async function GET(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!ROLES_PERMITIDOS.has(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permiso para ver aprobaciones.' }, { status: 403 });
  }

  const url    = new URL(request.url);
  const estado = url.searchParams.get('estado') as ApprovalStatus | null;
  const riesgo = url.searchParams.get('riesgo') ?? null;
  const limite = Math.min(Number(url.searchParams.get('limite') ?? '30'), 100);

  try {
    const db = getFirebaseAdminDb();

    /* ADMIN ve todos los tenants; Jefe/Control solo ven el suyo */
    let q = db.collection('simi_aprobaciones_respuesta')
      .orderBy('createdAt', 'desc')
      .limit(limite);

    if (usuario.rol !== 'ADMIN') {
      q = db.collection('simi_aprobaciones_respuesta')
        .where('tenantId', '==', usuario.tenantId)
        .orderBy('createdAt', 'desc')
        .limit(limite);
    }

    const snap = await q.get();
    let aprobaciones = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalFlow & { id: string }));

    /* Filtros en memoria (evitar índices compuestos de Firestore) */
    if (estado)  aprobaciones = aprobaciones.filter((a) => a.estado === estado);
    if (riesgo)  aprobaciones = aprobaciones.filter((a) => a.nivelRiesgo === riesgo);

    /* Estadísticas rápidas */
    const stats = {
      total:             aprobaciones.length,
      pendientesJefe:    aprobaciones.filter((a) => a.estado === 'pendiente_revision_jefe').length,
      pendientesJuridica: aprobaciones.filter((a) => a.estado === 'pendiente_revision_juridica').length,
      devueltos:         aprobaciones.filter((a) => a.estado === 'devuelto_para_ajustes').length,
      aprobados:         aprobaciones.filter((a) => ['aprobado_por_jefe','aprobado_por_juridica','listo_para_envio'].includes(a.estado)).length,
      riesgoAlto:        aprobaciones.filter((a) => a.nivelRiesgo === 'alto').length,
    };

    return NextResponse.json({ ok: true, aprobaciones, stats });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
