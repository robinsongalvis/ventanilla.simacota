/**
 * GET /api/simi/metricas — métricas de calidad del módulo SIMI jurídico
 */

import { NextResponse }        from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { calculateQualityMetrics } from '@/lib/simi-juridico/calculateQualityMetrics';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

const ROLES_CON_ACCESO = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA']);

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap    = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    const d       = snap.data()!;
    if (d.activo === false || d.archivado === true) return NextResponse.json({ error: 'Usuario inactivo.' }, { status: 403 });
    const rol     = d.rol as RolInterno;
    const tenantId = d.tenantId as TenantId;

    if (!ROLES_CON_ACCESO.has(rol)) {
      return NextResponse.json({ error: 'Sin permiso para ver métricas.' }, { status: 403 });
    }

    const metricas = await calculateQualityMetrics(tenantId);
    return NextResponse.json({ ok: true, metricas });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
