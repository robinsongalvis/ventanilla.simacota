import type { FiltroMIPG } from '@/lib/store/ventanillaStore';

/**
 * Panel Operativo Nivel 2 — mapping celda de la matriz → filtro MIPG.
 *
 * Cada chip de estado en la fila de una dependencia corresponde 1:1 a
 * un filtro MIPG de la bandeja, con criterios idénticos:
 *
 *   pendientes → RADICADAS   (estadoActual === 'PENDIENTE')
 *   enProceso  → ASIGNADAS   (ASIGNADO | EN_REVISION | EN_PROCESO)
 *   porVencer  → POR_VENCER  (activo y 0–2 días hábiles)
 *   vencidos   → VENCIDAS    (activo y días < 0)
 *
 * Esto garantiza que el número del chip coincide exactamente con la
 * cantidad de filas que la bandeja muestra al hacer clic — el contador
 * de useCargaDependencias y aplicarFiltroMIPG usan los mismos criterios.
 */

export type CeldaDependencia = 'pendientes' | 'enProceso' | 'porVencer' | 'vencidos';

const MAPA_CELDA_FILTRO: Record<CeldaDependencia, FiltroMIPG> = {
  pendientes: 'RADICADAS',
  enProceso:  'ASIGNADAS',
  porVencer:  'POR_VENCER',
  vencidos:   'VENCIDAS',
};

export function filtroMipgParaCelda(celda: CeldaDependencia): FiltroMIPG {
  return MAPA_CELDA_FILTRO[celda];
}
