/**
 * GET /api/simi/control-interno — Dashboard de Control Interno con métricas MIPG.
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { calculateControlInternoMetrics } from '@/lib/simi-juridico/calculateControlInternoMetrics';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

const ROLES_CI = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA']);

export async function GET(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const decoded  = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap     = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    const d        = snap.data()!;
    if (d.activo === false || d.archivado === true) return NextResponse.json({ error: 'Usuario inactivo.' }, { status: 403 });
    const rol      = d.rol as RolInterno;
    const tenantId = d.tenantId as TenantId;

    if (!ROLES_CI.has(rol)) {
      return NextResponse.json({ error: 'Sin permiso para ver el dashboard de Control Interno.' }, { status: 403 });
    }

    const url   = new URL(request.url);
    const desde = url.searchParams.get('desde') ?? undefined;
    const hasta = url.searchParams.get('hasta') ?? undefined;

    const metricas = await calculateControlInternoMetrics({
      tenantId: rol === 'ADMIN' ? 'TODOS' : tenantId,
      esAdmin:  rol === 'ADMIN',
      desde,
      hasta,
    });

    return NextResponse.json({ ok: true, metricas });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
