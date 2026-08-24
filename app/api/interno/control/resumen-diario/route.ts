/**
 * GET /api/interno/control/resumen-diario
 *
 * Devuelve recomendaciones del día + contadores básicos para alimentar el
 * bloque "Qué debo revisar hoy" del panel de Resumen.
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../_auth';
import {
  contarHallazgosAbiertosPorTenant,
  contarPlanesAbiertosPorTenant,
  listarHallazgos,
  listarPlanes,
  listarRadicadosParaControl,
} from '@/lib/control-interno/server/datos';
import { generarAlertas } from '@/lib/control-interno/alertas';
import { calcularDesempenoPorDependencia } from '@/lib/control-interno/panorama';
import { generarRecomendacionesDia } from '@/lib/control-interno/recomendaciones';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  try {
    const [radicados, hallazgos, planes, hallazgosPorTenant, planesPorTenant] = await Promise.all([
      listarRadicadosParaControl(),
      listarHallazgos({ limite: 500 }),
      listarPlanes({ limite: 500 }),
      contarHallazgosAbiertosPorTenant(),
      contarPlanesAbiertosPorTenant(),
    ]);

    const alertas = generarAlertas(radicados);
    const dependencias = calcularDesempenoPorDependencia({
      radicados,
      desde: 'inicio',
      hasta: 'hoy',
      hallazgosPorTenant,
      planesPorTenant,
    });
    const recomendaciones = generarRecomendacionesDia({
      alertas, hallazgos, planes, dependencias,
    });

    return NextResponse.json({
      ok: true,
      recomendaciones,
      contadores: {
        alertasAbiertas: alertas.filter((a) => a.estado === 'ABIERTA').length,
        hallazgosAbiertos: hallazgos.filter((h) => h.estado !== 'CERRADO').length,
        planesAbiertos: planes.filter((p) => p.estado === 'PENDIENTE' || p.estado === 'EN_EJECUCION').length,
        planesVencidos: planes.filter((p) => p.estado === 'VENCIDO').length,
        dependenciasEnRiesgo: dependencias.filter((d) => d.nivelRiesgo === 'ALTO' || d.nivelRiesgo === 'CRITICO').length,
      },
    });
  } catch (err) {
    // PT-2/D5 (24-ago-2026): antes este catch devolvía 500 sin dejar UN solo
    // rastro y filtraba err.message crudo al cliente — si Control Interno fallaba en producción, no había ni una
    // línea para diagnosticar (y el error atrapado tampoco llega a Sentry
    // por onRequestError). logError registra estructurado Y reporta a
    // Sentry cuando el DSN esté vivo; el cliente recibe mensaje genérico.
    logError({ radicadoId: '', modulo: 'control-interno/resumen-diario', error: err });
    return NextResponse.json(
      { error: 'No se pudo cargar el resumen del día.' },
      { status: 500 },
    );
  }
}
