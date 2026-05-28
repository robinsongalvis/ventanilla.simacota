import type { VentanillaRadicado, AuditoriaOverride } from '@/src/types/ventanilla';
import { calcularRiesgoVencimiento, type AnalisisRiesgoRadicado } from './riesgo-vencimiento';
import { calcularSaturacionDependencias, type AnalisisSaturacionDependencia } from './saturacion';
import { calcularTendenciasSemanticas, type AnalisisTendenciaTag } from './tendencias';
import { calcularRiesgoTerritorial, type AnalisisTerritorialZona } from './zonas';

export interface ReporteInteligenciaMunicipal {
  timestamp: string;
  totalRadicadosActivos: number;
  criticosCount: number;
  mediosCount: number;
  bajosCount: number;
  saturadosCount: number; // dependencias con nivel ALTO o CRITICO
  analisisRiesgoDetallado: AnalisisRiesgoRadicado[];
  saturacionDependencias: AnalisisSaturacionDependencia[];
  tendenciasTags: AnalisisTendenciaTag[];
  riesgoTerritorial: AnalisisTerritorialZona[];
}

const ESTADOS_ACTIVOS = new Set(['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'POR_VENCER', 'VENCIDO', 'PRORROGA']);

function estaActivo(r: VentanillaRadicado): boolean {
  return ESTADOS_ACTIVOS.has(r.estadoActual);
}

/**
 * Orquestador principal de la Inteligencia Predictiva Municipal.
 * Procesa todos los radicados del stream de forma determinística y pura.
 */
export function orquestarReportePredictivo(
  todosLosRadicados: VentanillaRadicado[],
  overridesAuditoria: Array<{ clasificacionOriginal?: string | null }> = []
): ReporteInteligenciaMunicipal {
  const activos = todosLosRadicados.filter(estaActivo);
  const totalActivos = activos.length;

  // 1. Cómputo de riesgos individuales
  const analisisRiesgoDetallado = activos.map((r) =>
    calcularRiesgoVencimiento(r, todosLosRadicados)
  );

  let criticosCount = 0;
  let mediosCount = 0;
  let bajosCount = 0;

  analisisRiesgoDetallado.forEach((a) => {
    if (a.categoriaRiesgo === 'CRITICO') criticosCount++;
    else if (a.categoriaRiesgo === 'MEDIO') mediosCount++;
    else bajosCount++;
  });

  // 2. Cómputo de saturación de secretarías
  const saturacionDependencias = calcularSaturacionDependencias(todosLosRadicados, overridesAuditoria);
  const saturadosCount = saturacionDependencias.filter(
    (s) => s.nivelSaturacion === 'CRITICO' || s.nivelSaturacion === 'ALTO'
  ).length;

  // 3. Cómputo de derivas y tendencias semánticas
  const tendenciasTags = calcularTendenciasSemanticas(todosLosRadicados);

  // 4. Cómputo de riesgo territorial por zonas
  const riesgoTerritorial = calcularRiesgoTerritorial(todosLosRadicados);

  return {
    timestamp: new Date().toISOString(),
    totalRadicadosActivos: totalActivos,
    criticosCount,
    mediosCount,
    bajosCount,
    saturadosCount,
    analisisRiesgoDetallado: analisisRiesgoDetallado.sort(
      (a, b) => b.probabilidadVencimiento - a.probabilidadVencimiento
    ),
    saturacionDependencias: saturacionDependencias.sort((a, b) => b.indiceSaturacion - a.indiceSaturacion),
    tendenciasTags,
    riesgoTerritorial,
  };
}
