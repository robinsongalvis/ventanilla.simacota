/**
 * GET /api/simi/control-interno — Dashboard de Control Interno con métricas MIPG.
 */

import { NextResponse }        from 'next/server';
import { calculateControlInternoMetrics } from '@/lib/simi-juridico/calculateControlInternoMetrics';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';

export const runtime = 'nodejs';

const ROLES_CI = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA']);

export async function GET(request: Request): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  if (!ROLES_CI.has(usuario.rol)) {
    return NextResponse.json(
      { error: 'Sin permiso para ver el dashboard de Control Interno.' },
      { status: 403 },
    );
  }

  try {
    const url   = new URL(request.url);
    const desde = url.searchParams.get('desde') ?? undefined;
    const hasta = url.searchParams.get('hasta') ?? undefined;

    const metricas = await calculateControlInternoMetrics({
      tenantId: usuario.rol === 'ADMIN' ? 'TODOS' : usuario.tenantId,
      esAdmin:  usuario.rol === 'ADMIN',
      desde,
      hasta,
    });

    return NextResponse.json({ ok: true, metricas });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
