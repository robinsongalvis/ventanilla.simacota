/**
 * GET /api/interno/control/panorama
 *
 * Devuelve el panorama profesional de Control Interno:
 *   - KPIs con semáforo
 *   - Desempeño por dependencia
 *   - Resumen de niveles de riesgo
 *
 * Query params:
 *   - desde (YYYY-MM-DD)  — opcional
 *   - hasta (YYYY-MM-DD)  — opcional
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../_auth';
import {
  contarHallazgosAbiertosPorTenant,
  contarPlanesAbiertosPorTenant,
  listarRadicadosParaControl,
} from '@/lib/control-interno/server/datos';
import {
  calcularDesempenoPorDependencia,
  calcularPanorama,
} from '@/lib/control-interno/panorama';
import { evaluarRiesgoMasivo, resumirNiveles } from '@/lib/control-interno/riesgos';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

function rangoDefault(): { desde: string; hasta: string } {
  const hoy = new Date();
  const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return {
    desde: ini.toISOString().slice(0, 10),
    hasta: hoy.toISOString().slice(0, 10),
  };
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const def = rangoDefault();
  const desde = url.searchParams.get('desde') ?? def.desde;
  const hasta = url.searchParams.get('hasta') ?? def.hasta;

  try {
    const [radicados, hallazgosPorTenant, planesPorTenant] = await Promise.all([
      listarRadicadosParaControl({ desde, hasta }),
      contarHallazgosAbiertosPorTenant(),
      contarPlanesAbiertosPorTenant(),
    ]);

    let hallazgosAbiertos = 0;
    for (const v of hallazgosPorTenant.values()) hallazgosAbiertos += v;
    let planesAbiertos = 0;
    for (const v of planesPorTenant.values()) planesAbiertos += v;

    const evaluaciones = evaluarRiesgoMasivo(radicados);
    const resumen = resumirNiveles(evaluaciones);

    const panorama = calcularPanorama({
      radicados,
      desde,
      hasta,
      hallazgosAbiertos,
      planesAbiertos,
      hallazgosPorTenant,
      planesPorTenant,
    });

    const dependencias = calcularDesempenoPorDependencia({
      radicados,
      desde,
      hasta,
      hallazgosPorTenant,
      planesPorTenant,
    });

    return NextResponse.json({
      ok: true,
      panorama,
      dependencias,
      resumenRiesgo: resumen,
    });
  } catch (err) {
    // PT-2/D5 (24-ago-2026): antes este catch devolvía 500 sin dejar UN solo
    // rastro y filtraba err.message crudo al cliente — si Control Interno fallaba en producción, no había ni una
    // línea para diagnosticar (y el error atrapado tampoco llega a Sentry
    // por onRequestError). logError registra estructurado Y reporta a
    // Sentry cuando el DSN esté vivo; el cliente recibe mensaje genérico.
    logError({ radicadoId: '', modulo: 'control-interno/panorama', error: err });
    return NextResponse.json(
      { error: 'No fue posible calcular el panorama.' },
      { status: 500 },
    );
  }
}
