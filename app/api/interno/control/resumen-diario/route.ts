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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo cargar el resumen del día.' },
      { status: 500 },
    );
  }
}
