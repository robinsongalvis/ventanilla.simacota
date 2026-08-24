/**
 * GET /api/interno/control/alertas
 *
 * Deriva las alertas activas a partir de los radicados (en vivo, sin persistir).
 * Filtros opcionales: tenantId, nivel.
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../_auth';
import { listarRadicadosParaControl } from '@/lib/control-interno/server/datos';
import { generarAlertas, resumirAlertasPorNivel } from '@/lib/control-interno/alertas';
import type { TenantId } from '@/src/types/radicado';
import type { NivelRiesgo } from '@/src/types/control-interno';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const NIVELES: NivelRiesgo[] = ['BAJO', 'MEDIO', 'ALTO', 'CRITICO'];

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const tenant = url.searchParams.get('tenantId') as TenantId | null;
  const nivel = url.searchParams.get('nivel') as NivelRiesgo | null;

  try {
    const radicados = await listarRadicadosParaControl();
    let alertas = generarAlertas(radicados);

    if (tenant) alertas = alertas.filter((a) => a.tenantId === tenant);
    if (nivel && NIVELES.includes(nivel)) {
      alertas = alertas.filter((a) => a.nivel === nivel);
    }

    alertas.sort((a, b) => {
      const orden = (n: NivelRiesgo) => NIVELES.indexOf(n);
      return orden(b.nivel) - orden(a.nivel);
    });

    return NextResponse.json({
      ok: true,
      total: alertas.length,
      resumen: resumirAlertasPorNivel(alertas),
      alertas: alertas.slice(0, 500),
    });
  } catch (err) {
    // PT-2/D5 (24-ago-2026): antes este catch devolvía 500 sin dejar UN solo
    // rastro y filtraba err.message crudo al cliente — si Control Interno fallaba en producción, no había ni una
    // línea para diagnosticar (y el error atrapado tampoco llega a Sentry
    // por onRequestError). logError registra estructurado Y reporta a
    // Sentry cuando el DSN esté vivo; el cliente recibe mensaje genérico.
    logError({ radicadoId: '', modulo: 'control-interno/alertas', error: err });
    return NextResponse.json(
      { error: 'No fue posible generar las alertas.' },
      { status: 500 },
    );
  }
}
