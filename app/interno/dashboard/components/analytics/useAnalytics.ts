/**
 * useAnalytics.ts — Centro de Inteligencia Operativa Municipal
 *
 * Hook puro: recibe el array de VentanillaRadicado del stream existente
 * y devuelve todas las métricas analíticas calculadas en cliente.
 *
 * NO realiza llamadas a Firestore. Reutiliza el stream de useVentanillaRadicados.
 * Incluye severityScore para alimentar la IA predictiva futura (Fase 3).
 */

import { useMemo } from 'react';
import type { VentanillaRadicado }    from '@/src/types/ventanilla';
import type { TenantId, ZonaGeografica } from '@/src/types/radicado';
import { diasRestantesHabiles }        from '@/lib/tiempos-radicado';
import { NOMBRES_TENANT }              from '@/src/types/reglas-negocio';

/* ══════════════════════════════════════════════════════════════
   TIPOS EXPORTADOS
══════════════════════════════════════════════════════════════ */

/** Ventana de tiempo para filtrar la analítica */
export type PeriodoAnalytics = 30 | 60 | 90 | 'TODO';

/** KPIs globales del municipio en el período seleccionado */
export interface MetricasGlobales {
  totalPeriodo:          number;
  resueltos:             number;
  tasaResolucion:        number;   // % (0–100)
  promedioRespuestaDias: number;   // días hábiles promedio solo resueltos
  vencidosActivos:       number;
  porVencerHoy:          number;   // vence en ≤ 2 días hábiles
  dependenciaMayorCarga: { id: TenantId; nombre: string; total: number } | null;
  zonaMayorVolumen:      { zona: ZonaGeografica; total: number } | null;
}

/** Métricas por dependencia para el ranking */
export interface MetricaPorDependencia {
  tenantId:   TenantId;
  nombre:     string;
  recibidos:  number;
  resueltos:  number;
  vencidos:   number;
  promDias:   number;    // promedio de días hábiles en radicados resueltos
  pctCarga:   number;    // % del total global
}

/** Alerta predictiva con severidad calculada */
export interface AlertaPredictiva {
  /** Nivel de urgencia para color y prioridad en el panel */
  nivel:           'CRITICO' | 'URGENTE' | 'ATENCION';
  radicado:        VentanillaRadicado;
  diasRestantes:   number;   // negativo = días vencido
  diasSinMovimiento: number; // desde la última entrada en trazabilidad
  /**
   * severityScore — alimenta la IA predictiva (Fase 3)
   *
   * Fórmula:
   *   vencido         → +5 por cada día vencido
   *   sin movimiento  → +3 por cada día sin actividad
   *   prioridad ROJO  → +2
   *
   * Cuanto mayor el score, más urgente la intervención.
   */
  severityScore:   number;
}

/** Top tipos de solicitud por frecuencia */
export interface TipoFrecuente {
  nombre:  string;
  conteo:  number;
  pct:     number;
}

/** Volumen por zona geográfica */
export interface MetricaZona {
  zona:             ZonaGeografica;
  label:            string;
  total:            number;
  pct:              number;
  tipoMasFrecuente: string;
}

/** Resultado completo del hook */
export interface AnalyticsResult {
  globales:        MetricasGlobales;
  porDependencia:  MetricaPorDependencia[];
  alertas:         AlertaPredictiva[];
  tiposFrecuentes: TipoFrecuente[];
  porZona:         MetricaZona[];
  totalBase:       number;   // total antes del filtro de período
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════════════════ */

const ESTADOS_RESUELTOS = new Set(['RESUELTO', 'RECHAZADO']);
const ESTADOS_ACTIVOS   = new Set(['PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA']);

const LABEL_ZONA: Record<ZonaGeografica, string> = {
  CASCO_URBANO:  'Casco Urbano',
  ZONA_RURAL:    'Zona Rural',
  ZONA_YARIGUIES: 'Zona Yariguíes',
};

/* ══════════════════════════════════════════════════════════════
   UTILIDADES PRIVADAS
══════════════════════════════════════════════════════════════ */

function estaActivo(r: VentanillaRadicado): boolean {
  return ESTADOS_ACTIVOS.has(r.estadoActual);
}

function estaResuelto(r: VentanillaRadicado): boolean {
  return ESTADOS_RESUELTOS.has(r.estadoActual);
}

/** Días hábiles que lleva el radicado desde su creación hasta hoy o hasta resolución */
function diasHabilesTranscurridos(r: VentanillaRadicado): number {
  const inicio = r.control.fechaRadicado;
  const fin    = estaResuelto(r)
    ? (r.ultimaActualizacion ?? new Date().toISOString())
    : new Date().toISOString();
  return Math.abs(diasRestantesHabiles(fin, inicio));
}

/** Días desde la última entrada en trazabilidad */
function diasSinMovimiento(r: VentanillaRadicado): number {
  const ultimaFecha = r.ultimaActualizacion ?? r.control.fechaRadicado;
  return Math.abs(diasRestantesHabiles(new Date().toISOString(), ultimaFecha));
}

/**
 * severityScore — Fase 3 ready
 *
 * Permite ordenar alertas automáticamente y alimentar modelos predictivos.
 * Score > 15 → intervención inmediata recomendada.
 */
function calcSeverityScore(
  diasRestantes: number,
  diasSinMov:    number,
  prioridad:     string,
): number {
  const scoreVencido   = diasRestantes < 0 ? Math.abs(diasRestantes) * 5 : 0;
  const scoreSinMov    = diasSinMov * 3;
  const scorePrioridad = prioridad === 'ROJO' ? 2 : 0;
  return scoreVencido + scoreSinMov + scorePrioridad;
}

/** Filtra radicados por ventana de tiempo usando fechaRadicado.
 * Compara sólo la parte YYYY-MM-DD para evitar drift sub-día
 * si el dashboard se renderiza cerca de medianoche.
 */
function filtrarPorPeriodo(
  radicados: VentanillaRadicado[],
  periodo:   PeriodoAnalytics,
): VentanillaRadicado[] {
  if (periodo === 'TODO') return radicados;
  const limite = new Date();
  limite.setDate(limite.getDate() - periodo);
  const limiteStr = limite.toISOString().slice(0, 10);
  return radicados.filter(
    (r) => r.control.fechaRadicado.slice(0, 10) >= limiteStr,
  );
}


/** Promedio numérico de un array, 0 si vacío */
function promedio(arr: number[]): number {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

/* ══════════════════════════════════════════════════════════════
   HOOK PRINCIPAL
══════════════════════════════════════════════════════════════ */

export function useAnalytics(
  todosLosRadicados: VentanillaRadicado[],
  periodo: PeriodoAnalytics,
  tenantIdUsuario: TenantId | 'TODOS',
): AnalyticsResult {
  return useMemo(() => {
    const totalBase = todosLosRadicados.length;
    const radicados = filtrarPorPeriodo(todosLosRadicados, periodo);

    /* ── Métricas globales ─────────────────────────────────── */
    const resueltos    = radicados.filter(estaResuelto);
    const activos      = radicados.filter(estaActivo);
    const vencidos     = activos.filter((r) => diasRestantesHabiles(r.termino.fechaVencimiento) < 0);
    const porVencer    = activos.filter((r) => {
      const d = diasRestantesHabiles(r.termino.fechaVencimiento);
      return d >= 0 && d <= 2;
    });

    const tasaResolucion = radicados.length > 0
      ? Math.round((resueltos.length / radicados.length) * 100)
      : 0;

    const diasResueltos = resueltos.map(diasHabilesTranscurridos);
    const promedioRespuestaDias = promedio(diasResueltos);

    // Dependencia con mayor carga
    const conteoTenant: Partial<Record<TenantId, number>> = {};
    for (const r of radicados) {
      const id = r.clasificacion.oficinaDestino;
      conteoTenant[id] = (conteoTenant[id] ?? 0) + 1;
    }
    const [topTenantId, topTenantTotal] = Object.entries(conteoTenant)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0] ?? [null, 0];

    // Zona con mayor volumen
    const conteoZona: Partial<Record<ZonaGeografica, number>> = {};
    for (const r of radicados) {
      const z = r.clasificacion.zonaGeografica;
      conteoZona[z] = (conteoZona[z] ?? 0) + 1;
    }
    const [topZona, topZonaTotal] = Object.entries(conteoZona)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0] ?? [null, 0];

    const globales: MetricasGlobales = {
      totalPeriodo:          radicados.length,
      resueltos:             resueltos.length,
      tasaResolucion,
      promedioRespuestaDias,
      vencidosActivos:       vencidos.length,
      porVencerHoy:          porVencer.length,
      dependenciaMayorCarga: topTenantId
        ? { id: topTenantId as TenantId, nombre: NOMBRES_TENANT[topTenantId as TenantId], total: topTenantTotal as number }
        : null,
      zonaMayorVolumen: topZona
        ? { zona: topZona as ZonaGeografica, total: topZonaTotal as number }
        : null,
    };

    /* ── Ranking por dependencia ───────────────────────────── */
    const mapaDep: Map<TenantId, { recibidos: number; resueltos: number; vencidos: number; dias: number[] }> = new Map();

    for (const r of radicados) {
      const id = r.clasificacion.oficinaDestino;
      if (!mapaDep.has(id)) {
        mapaDep.set(id, { recibidos: 0, resueltos: 0, vencidos: 0, dias: [] });
      }
      const m = mapaDep.get(id)!;
      m.recibidos += 1;
      if (estaResuelto(r)) {
        m.resueltos += 1;
        m.dias.push(diasHabilesTranscurridos(r));
      }
      if (estaActivo(r) && diasRestantesHabiles(r.termino.fechaVencimiento) < 0) {
        m.vencidos += 1;
      }
    }

    const porDependencia: MetricaPorDependencia[] = Array.from(mapaDep.entries())
      .map(([tenantId, m]) => ({
        tenantId,
        nombre:    NOMBRES_TENANT[tenantId],
        recibidos: m.recibidos,
        resueltos: m.resueltos,
        vencidos:  m.vencidos,
        promDias:  promedio(m.dias),
        pctCarga:  radicados.length > 0 ? Math.round((m.recibidos / radicados.length) * 100) : 0,
      }))
      .sort((a, b) => b.recibidos - a.recibidos);

    /* ── Alertas predictivas con severityScore ─────────────── */
    // Filtro por rol: ADMIN ve todo, demás solo su tenantId
    const activosFiltrados = tenantIdUsuario === 'TODOS'
      ? activos
      : activos.filter((r) => r.clasificacion.oficinaDestino === tenantIdUsuario);

    const alertas: AlertaPredictiva[] = activosFiltrados
      .map((r) => {
        const diasRestantes   = diasRestantesHabiles(r.termino.fechaVencimiento);
        const sinMov          = diasSinMovimiento(r);
        const severityScore   = calcSeverityScore(diasRestantes, sinMov, r.prioridad);

        let nivel: AlertaPredictiva['nivel'];
        if (diasRestantes < 0)          nivel = 'CRITICO';
        else if (diasRestantes <= 2)    nivel = 'URGENTE';
        else                            nivel = 'ATENCION';

        return { nivel, radicado: r, diasRestantes, diasSinMovimiento: sinMov, severityScore };
      })
      .filter((a) => a.nivel !== 'ATENCION' || a.diasRestantes <= 5)
      .sort((a, b) => b.severityScore - a.severityScore);

    /* ── Tipos de solicitud frecuentes ────────────────────── */
    const conteoTipo: Record<string, number> = {};
    for (const r of radicados) {
      const t = r.termino.tipoSolicitudNombre;
      conteoTipo[t] = (conteoTipo[t] ?? 0) + 1;
    }
    const tiposFrecuentes: TipoFrecuente[] = Object.entries(conteoTipo)
      .map(([nombre, conteo]) => ({
        nombre,
        conteo,
        pct: radicados.length > 0 ? Math.round((conteo / radicados.length) * 100) : 0,
      }))
      .sort((a, b) => b.conteo - a.conteo)
      .slice(0, 6);

    /* ── Métricas por zona geográfica ─────────────────────── */
    const mapaZona: Partial<Record<ZonaGeografica, { total: number; tipos: Record<string, number> }>> = {};
    for (const r of radicados) {
      const z = r.clasificacion.zonaGeografica;
      if (!mapaZona[z]) mapaZona[z] = { total: 0, tipos: {} };
      mapaZona[z]!.total += 1;
      const t = r.termino.tipoSolicitudNombre;
      mapaZona[z]!.tipos[t] = (mapaZona[z]!.tipos[t] ?? 0) + 1;
    }

    const porZona: MetricaZona[] = (['CASCO_URBANO', 'ZONA_RURAL', 'ZONA_YARIGUIES'] as ZonaGeografica[])
      .map((zona) => {
        const datos = mapaZona[zona] ?? { total: 0, tipos: {} };
        const tipoMasFrecuente = Object.entries(datos.tipos)
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '—';
        return {
          zona,
          label: LABEL_ZONA[zona],
          total: datos.total,
          pct:   radicados.length > 0 ? Math.round((datos.total / radicados.length) * 100) : 0,
          tipoMasFrecuente,
        };
      });

    return { globales, porDependencia, alertas, tiposFrecuentes, porZona, totalBase };
  }, [todosLosRadicados, periodo, tenantIdUsuario]);
}
