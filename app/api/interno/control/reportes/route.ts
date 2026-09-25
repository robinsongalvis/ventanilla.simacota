/**
 * GET /api/interno/control/reportes?formato=xlsx
 *
 * Exporta el Reporte Control Interno (Excel institucional).
 * Queda evento en control_interno_eventos.
 */

import { NextResponse } from 'next/server';
import { autorizarAuditor } from '../_auth';
import {
  contarHallazgosAbiertosPorTenant,
  contarPlanesAbiertosPorTenant,
  listarHallazgos,
  listarPlanes,
  listarRadicadosParaControl,
  registrarEvento,
} from '@/lib/control-interno/server/datos';
import { generarAlertas } from '@/lib/control-interno/alertas';
import {
  calcularDesempenoPorDependencia,
  calcularPanorama,
} from '@/lib/control-interno/panorama';
import { evaluarRiesgoMasivo } from '@/lib/control-interno/riesgos';
import { generarReporteExcelControlInterno } from '@/lib/control-interno/server/reporte-excel';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await autorizarAuditor();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const desde = url.searchParams.get('desde') ?? '';
  const hasta = url.searchParams.get('hasta') ?? '';

  try {
    const [radicados, hallazgos, planes, hallazgosPorTenant, planesPorTenant] = await Promise.all([
      listarRadicadosParaControl({ desde: desde || undefined, hasta: hasta || undefined }),
      listarHallazgos({ limite: 500 }),
      listarPlanes({ limite: 500 }),
      contarHallazgosAbiertosPorTenant(),
      contarPlanesAbiertosPorTenant(),
    ]);

    const hallazgosAbiertos = hallazgos.filter((h) => h.estado !== 'CERRADO').length;
    const planesAbiertos = planes.filter((p) => p.estado === 'PENDIENTE' || p.estado === 'EN_EJECUCION' || p.estado === 'VENCIDO').length;

    const panorama = calcularPanorama({
      radicados, desde: desde || 'inicio', hasta: hasta || 'hoy',
      hallazgosAbiertos, planesAbiertos, hallazgosPorTenant, planesPorTenant,
    });
    const dependencias = calcularDesempenoPorDependencia({
      radicados, desde: desde || 'inicio', hasta: hasta || 'hoy',
      hallazgosPorTenant, planesPorTenant,
    });
    const alertas = generarAlertas(radicados);
    const evaluaciones = evaluarRiesgoMasivo(radicados).filter((e) => e.nivel !== 'BAJO');

    const buffer = await generarReporteExcelControlInterno({
      periodo: panorama.periodo,
      kpis: panorama.kpis,
      alertas,
      evaluaciones,
      hallazgos,
      planes,
      dependencias,
    });

    await registrarEvento({
      tipo:        'CONTROL_INTERNO_REPORTE_EXPORTADO',
      fecha:       new Date().toISOString(),
      actorUid:    auth.data.user.uid,
      actorNombre: auth.data.user.nombre,
      actorRol:    auth.data.user.rol,
      metadata:    { formato: 'xlsx', radicados: radicados.length, hallazgos: hallazgos.length, planes: planes.length },
    });

    const fileName = `control-interno-${new Date().toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    // PT-2/D5 (24-ago-2026): antes este catch devolvía 500 sin dejar UN solo
    // rastro y filtraba err.message crudo al cliente — si Control Interno fallaba en producción, no había ni una
    // línea para diagnosticar (y el error atrapado tampoco llega a Sentry
    // por onRequestError). logError registra estructurado Y reporta a
    // Sentry cuando el DSN esté vivo; el cliente recibe mensaje genérico.
    logError({ radicadoId: '', modulo: 'control-interno/reportes', error: err });
    return NextResponse.json(
      { error: 'No fue posible generar el reporte.' },
      { status: 500 },
    );
  }
}
