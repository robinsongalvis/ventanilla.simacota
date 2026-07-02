import type { FiltroMIPG } from '@/lib/store/ventanillaStore';
import type { FiltroKpiOperativo } from '@/lib/kpis-operativos/filtrar-por-kpi-operativo';
import type { TenantId } from '@/src/types/radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';

/**
 * Panel Operativo Nivel 3A — resumen legible de los filtros activos de
 * la bandeja.
 *
 * El dashboard combina 5 dimensiones de filtro dispersas (3 en el store,
 * 2 en estado local). Cuando varias están activas la lista muestra la
 * intersección, y sin un indicador visible el usuario no entiende por
 * qué ve "1 resultado" con "8 TODOS". Este helper reúne todas en una
 * lista de chips legibles, cada uno con la clave de la dimensión que lo
 * originó — para que la UI pueda quitar filtros individualmente.
 *
 * Función pura: sin acceso a store, sin React. Recibe el estado, devuelve
 * la descripción.
 */

export type DimensionFiltro =
  | 'MIPG'
  | 'OPERATIVO'
  | 'TENANT'
  | 'DATOS_INCOMPLETOS'
  | 'BUSQUEDA';

export interface ChipFiltroActivo {
  dimension: DimensionFiltro;
  label:     string;
}

export interface EstadoFiltros {
  filtroMIPG:          FiltroMIPG;
  filtroOperativo:     FiltroKpiOperativo;
  tenantFiltro:        TenantId | 'TODOS';
  soloDatosIncompletos: boolean;
  busqueda:            string;
}

/** Etiqueta humana de cada FiltroMIPG (excepto TODOS, que no filtra). */
const LABEL_MIPG: Record<Exclude<FiltroMIPG, 'TODOS'>, string> = {
  RADICADAS:              'Radicadas',
  PRIORIDAD_MIPG:         'Prioridad MIPG',
  ASIGNADAS:              'Asignadas',
  EN_TERMINO:             'En término',
  POR_VENCER:             'Por vencer',
  VENCIDAS:               'Vencidas',
  CORREOS_FALLIDOS:       'Correos fallidos',
  DEVUELTAS_PRORROGA:     'Devueltas / Prórroga',
  RESUELTOS_FUERA_TERMINO:'Resueltos fuera de término',
};

/** Etiqueta humana de cada filtro operativo (excepto NINGUNO). */
const LABEL_OPERATIVO: Record<Exclude<FiltroKpiOperativo, 'NINGUNO'>, string> = {
  HOY:            'Hoy',
  SIN_ASIGNAR:    'Sin asignar',
  SIN_SELLAR:     'Sin sellar',
  CORREO_FALLIDO: 'Correo fallido',
  RESUELTOS_HOY:  'Resueltos hoy',
};

/**
 * Devuelve la lista de chips de filtros activos, en orden estable
 * (MIPG → operativo → tenant → datos incompletos → búsqueda). Vacío si
 * no hay ninguno activo.
 */
export function resumirFiltrosActivos(estado: EstadoFiltros): ChipFiltroActivo[] {
  const chips: ChipFiltroActivo[] = [];

  if (estado.filtroMIPG !== 'TODOS') {
    chips.push({ dimension: 'MIPG', label: LABEL_MIPG[estado.filtroMIPG] });
  }

  if (estado.filtroOperativo !== 'NINGUNO') {
    chips.push({ dimension: 'OPERATIVO', label: LABEL_OPERATIVO[estado.filtroOperativo] });
  }

  if (estado.tenantFiltro !== 'TODOS') {
    chips.push({
      dimension: 'TENANT',
      label: NOMBRES_TENANT[estado.tenantFiltro] ?? estado.tenantFiltro,
    });
  }

  if (estado.soloDatosIncompletos) {
    chips.push({ dimension: 'DATOS_INCOMPLETOS', label: 'Datos incompletos' });
  }

  const q = estado.busqueda.trim();
  if (q.length > 0) {
    chips.push({ dimension: 'BUSQUEDA', label: `"${q}"` });
  }

  return chips;
}

/** True si hay al menos un filtro activo (la barra debe mostrarse). */
export function hayFiltrosActivos(estado: EstadoFiltros): boolean {
  return resumirFiltrosActivos(estado).length > 0;
}
