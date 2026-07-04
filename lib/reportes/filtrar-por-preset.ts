import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { fechaYmdColombia } from '@/lib/kpis-operativos/calcular-kpis-operativos';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

/**
 * Sprint 3C · Reportes — presets de período e indicadores del reporte.
 *
 * Responde la pregunta real de recepción: "¿qué llegó este mes?".
 * Todo se calcula en frontend sobre los radicados ya en memoria
 * (cero lecturas nuevas). Los períodos se cortan por día calendario
 * colombiano, reutilizando fechaYmdColombia — los mismos cortes de los
 * KPIs operativos, para que reporte y tablero nunca se contradigan.
 *
 * Funciones puras: sin React, sin Firestore. `ahora` inyectable.
 */

export type PresetReporte = 'HOY' | 'ESTA_SEMANA' | 'ESTE_MES' | 'MES_PASADO' | 'TODO';

export const ETIQUETA_PRESET: Record<PresetReporte, string> = {
  HOY:         'Hoy',
  ESTA_SEMANA: 'Esta semana',
  ESTE_MES:    'Este mes',
  MES_PASADO:  'Mes pasado',
  TODO:        'Histórico completo',
};

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);
const ESTADOS_ASIGNADOS = new Set<string>(['ASIGNADO', 'EN_REVISION', 'EN_PROCESO']);
const ESTADOS_DEVUELTOS = new Set<string>(['DEVUELTO', 'PRORROGA']);

function esActivo(r: VentanillaRadicado): boolean {
  return !ESTADOS_RESUELTOS.has(r.estadoActual);
}

/** Suma días a una fecha YMD sin ambigüedad de zona (aritmética a mediodía UTC). */
function sumarDiasYmd(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Rango [desde, hasta] en YMD colombiano para cada preset; null = sin
 * corte (histórico completo). Semana: lunes a hoy. Mes: día 1 a hoy.
 */
export function rangoDePreset(
  preset: PresetReporte,
  ahora: Date = new Date(),
): { desde: string; hasta: string } | null {
  const hoy = fechaYmdColombia(ahora);
  if (!hoy) return null;

  switch (preset) {
    case 'TODO':
      return null;
    case 'HOY':
      return { desde: hoy, hasta: hoy };
    case 'ESTA_SEMANA': {
      // getUTCDay sobre el mediodía del YMD colombiano: 0=domingo.
      const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay();
      const desdeLunes = sumarDiasYmd(hoy, -((dia + 6) % 7));
      return { desde: desdeLunes, hasta: hoy };
    }
    case 'ESTE_MES':
      return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
    case 'MES_PASADO': {
      const primeroDeEsteMes = `${hoy.slice(0, 7)}-01`;
      const ultimoDelPasado = sumarDiasYmd(primeroDeEsteMes, -1);
      return { desde: `${ultimoDelPasado.slice(0, 7)}-01`, hasta: ultimoDelPasado };
    }
  }
}

/** Subconjunto del período (por fecha de radicación) y dependencia. */
export function filtrarPorPreset(
  radicados: VentanillaRadicado[],
  preset: PresetReporte,
  dependencia: TenantId | 'TODAS' = 'TODAS',
  ahora: Date = new Date(),
): VentanillaRadicado[] {
  const rango = rangoDePreset(preset, ahora);

  return radicados.filter((r) => {
    if (dependencia !== 'TODAS' && r.clasificacion?.oficinaDestino !== dependencia) {
      return false;
    }
    if (!rango) return true;
    if (!r.control?.fechaRadicado) return false;
    const ymd = fechaYmdColombia(r.control.fechaRadicado);
    // YMD compara bien lexicográficamente.
    return ymd >= rango.desde && ymd <= rango.hasta;
  });
}

export interface IndicadoresReporte {
  total:              number;
  radicadas:          number;
  asignadas:          number;
  porVencer:          number;
  vencidas:           number;
  prioridadMipg:      number;
  devueltasProrroga:  number;
  resueltos:          number;
  aTiempo:            number;
  conDatoCumplimiento: number;
  /** null = sin datos suficientes para el porcentaje. */
  pctCumplimiento:    number | null;
}

/** Los mismos indicadores de la vista Reportes, sobre un subconjunto. */
export function indicadoresDeReporte(
  radicados: VentanillaRadicado[],
  ahora: Date = new Date(),
): IndicadoresReporte {
  const acc: IndicadoresReporte = {
    total: radicados.length,
    radicadas: 0, asignadas: 0, porVencer: 0, vencidas: 0,
    prioridadMipg: 0, devueltasProrroga: 0,
    resueltos: 0, aTiempo: 0, conDatoCumplimiento: 0,
    pctCumplimiento: null,
  };

  for (const r of radicados) {
    if (r.estadoActual === 'PENDIENTE')            acc.radicadas += 1;
    if (ESTADOS_ASIGNADOS.has(r.estadoActual))     acc.asignadas += 1;
    if (ESTADOS_DEVUELTOS.has(r.estadoActual))     acc.devueltasProrroga += 1;
    if (ESTADOS_RESUELTOS.has(r.estadoActual))     acc.resueltos += 1;
    if (r.prioridad === 'ROJO' && esActivo(r))     acc.prioridadMipg += 1;

    if (esActivo(r) && r.termino?.fechaVencimiento) {
      const d = diasRestantesHabiles(r.termino.fechaVencimiento, ahora);
      if (d < 0) acc.vencidas += 1;
      else if (d <= 2) acc.porVencer += 1;
    }

    if (r.cumplioTermino !== undefined && r.cumplioTermino !== null) {
      acc.conDatoCumplimiento += 1;
      if (r.cumplioTermino === true) acc.aTiempo += 1;
    }
  }

  acc.pctCumplimiento = acc.conDatoCumplimiento > 0
    ? Math.round((acc.aTiempo / acc.conDatoCumplimiento) * 100)
    : null;

  return acc;
}

export interface FilaResumenDependencia {
  oficina:   TenantId;
  total:     number;
  pendientes: number;
  enTramite: number;
  resueltos: number;
  vencidas:  number;
}

/** Corte por dependencia del subconjunto, ordenado por volumen. */
export function resumenPorDependencia(
  radicados: VentanillaRadicado[],
  ahora: Date = new Date(),
): FilaResumenDependencia[] {
  const porOficina = new Map<TenantId, FilaResumenDependencia>();

  for (const r of radicados) {
    const oficina = r.clasificacion?.oficinaDestino ?? 'VENTANILLA_UNICA';
    const fila = porOficina.get(oficina) ?? {
      oficina, total: 0, pendientes: 0, enTramite: 0, resueltos: 0, vencidas: 0,
    };
    fila.total += 1;
    if (r.estadoActual === 'PENDIENTE')        fila.pendientes += 1;
    if (ESTADOS_ASIGNADOS.has(r.estadoActual)) fila.enTramite += 1;
    if (ESTADOS_RESUELTOS.has(r.estadoActual)) fila.resueltos += 1;
    if (esActivo(r) && r.termino?.fechaVencimiento
        && diasRestantesHabiles(r.termino.fechaVencimiento, ahora) < 0) {
      fila.vencidas += 1;
    }
    porOficina.set(oficina, fila);
  }

  return [...porOficina.values()].sort((a, b) => b.total - a.total);
}
