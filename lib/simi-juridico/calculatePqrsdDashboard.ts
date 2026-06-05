/**
 * calculatePqrsdDashboard — Indicadores de vencimientos y riesgo PQRSD.
 */

import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';

export interface PqrsdDashboardData {
  totalRadicados:        number;
  proximosAVencer:       number;   // 1-3 días hábiles
  vencidos:              number;   // días < 0
  riesgoAlto:            number;   // prioridad ROJO activos
  pendientesJuridica:    number;   // estado DEVUELTO o marcados para revisión
  pendientesJefe:        number;   // sin responsable asignado y activos
  sinAnalizarSimi:       number;   // estado PENDIENTE sin responsable
  promedioDiasRespuesta?: number;
  porDependencia: Array<{
    dependencia: string;
    tenantId:    TenantId;
    total:       number;
    vencidos:    number;
    riesgoAlto:  number;
    proximosVencer: number;
  }>;
}

const ESTADOS_ACTIVOS = new Set([
  'PENDIENTE', 'EN_REVISION', 'EN_PROCESO', 'ASIGNADO', 'DEVUELTO', 'PRORROGA',
]);

const ESTADOS_RESUELTOS = new Set(['RESUELTO', 'RECHAZADO']);

export function calculatePqrsdDashboard(
  radicados: VentanillaRadicado[],
  filtroTenant?: TenantId | 'TODOS',
): PqrsdDashboardData {
  const oficiales = (radicados as Array<VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean }>)
    .filter((r) => !r.isTest && !r.excludeFromMetrics);
  const filtrados = filtroTenant && filtroTenant !== 'TODOS'
    ? oficiales.filter((r) => r.clasificacion.oficinaDestino === filtroTenant)
    : oficiales;

  const activos = filtrados.filter((r) => ESTADOS_ACTIVOS.has(r.estadoActual));
  const resueltos = filtrados.filter((r) => ESTADOS_RESUELTOS.has(r.estadoActual));

  // Promediar días de respuesta en resueltos
  let promedioDias: number | undefined;
  if (resueltos.length > 0) {
    const totalDias = resueltos.reduce((acc, r) => {
      const inicio = new Date(r.control.fechaRadicado).getTime();
      const fin    = r.termino.fechaVencimiento
        ? new Date(r.termino.fechaVencimiento).getTime()
        : Date.now();
      const dias = Math.max(0, Math.round((fin - inicio) / (1000 * 60 * 60 * 24)));
      return acc + dias;
    }, 0);
    promedioDias = Math.round(totalDias / resueltos.length);
  }

  // Por dependencia
  const porTenant = new Map<TenantId, {
    total: number; vencidos: number; riesgoAlto: number; proximosVencer: number;
  }>();

  for (const r of activos) {
    const tid = r.clasificacion.oficinaDestino;
    if (!porTenant.has(tid)) {
      porTenant.set(tid, { total: 0, vencidos: 0, riesgoAlto: 0, proximosVencer: 0 });
    }
    const stats = porTenant.get(tid)!;
    stats.total++;

    const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
    if (dias < 0)              stats.vencidos++;
    if (dias >= 0 && dias <= 3) stats.proximosVencer++;
    if (r.prioridad === 'ROJO') stats.riesgoAlto++;
  }

  const porDependencia = Array.from(porTenant.entries()).map(([tid, s]) => ({
    dependencia:    NOMBRES_TENANT[tid] ?? tid,
    tenantId:       tid,
    total:          s.total,
    vencidos:       s.vencidos,
    riesgoAlto:     s.riesgoAlto,
    proximosVencer: s.proximosVencer,
  })).sort((a, b) => b.vencidos - a.vencidos || b.riesgoAlto - a.riesgoAlto);

  return {
    totalRadicados:  filtrados.length,
    proximosAVencer: activos.filter((r) => {
      const d = diasRestantesHabiles(r.termino.fechaVencimiento);
      return d >= 0 && d <= 3;
    }).length,
    vencidos:        activos.filter((r) => diasRestantesHabiles(r.termino.fechaVencimiento) < 0).length,
    riesgoAlto:      activos.filter((r) => r.prioridad === 'ROJO').length,
    pendientesJuridica: activos.filter((r) => r.estadoActual === 'DEVUELTO').length,
    pendientesJefe:  activos.filter((r) => !r.clasificacion.funcionarioResponsableUid).length,
    sinAnalizarSimi: activos.filter((r) => r.estadoActual === 'PENDIENTE' && !r.clasificacion.funcionarioResponsableUid).length,
    promedioDiasRespuesta: promedioDias,
    porDependencia,
  };
}
