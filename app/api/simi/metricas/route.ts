/**
 * GET /api/simi/metricas — métricas de calidad del módulo SIMI jurídico
 */

import { NextResponse }        from 'next/server';
import { calculateQualityMetrics } from '@/lib/simi-juridico/calculateQualityMetrics';
import type { RolInterno }     from '@/lib/hooks/useAuth';
import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';

export const runtime = 'nodejs';

const ROLES_CON_ACCESO = new Set<RolInterno>(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA']);

export async function GET(): Promise<NextResponse> {
  const autenticacion = await autenticarUsuarioInterno();
  if (!autenticacion.ok) return autenticacion.respuesta;
  const usuario = autenticacion.usuario;

  if (!ROLES_CON_ACCESO.has(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permiso para ver métricas.' }, { status: 403 });
  }

  try {
    const metricas = await calculateQualityMetrics(usuario.tenantId);
    return NextResponse.json({ ok: true, metricas });
  } catch (err) {
    console.error('[api]', err);
    return NextResponse.json({ error: 'Ocurrió un error interno. Intente de nuevo.' }, { status: 500 });
  }
}
