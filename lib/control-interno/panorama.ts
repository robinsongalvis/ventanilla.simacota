/**
 * Panorama General — Control Interno.
 *
 * Calcula los 17 KPIs profesionales y el desempeño por dependencia
 * a partir del set de radicados y métricas auxiliares.
 *
 * Funciones puras: no acceden a Firestore.
 */

import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type {
  DesempenoDependencia,
  KpiControlInterno,
  NivelRiesgo,
  PanoramaControlInterno,
  SemaforoKpi,
} from '@/src/types/control-interno';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { evaluarRiesgoMasivo } from './riesgos';

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);

function activo(r: VentanillaRadicado): boolean {
  return !ESTADOS_RESUELTOS.has(r.estadoActual);
}

interface PanoramaInput {
  radicados:           VentanillaRadicado[];
  desde:               string;
  hasta:               string;
  hallazgosAbiertos?:  number;
  planesAbiertos?:     number;
  casosCriticosActivos?: number;
  /** Hallazgos abiertos por tenant — opcional. */
  hallazgosPorTenant?: Map<TenantId, number>;
  /** Planes abiertos por tenant — opcional. */
  planesPorTenant?:    Map<TenantId, number>;
  /** Última trazabilidad por radicado (opcional). */
  ultimasTrazabilidades?: Map<string, string | null>;
}

function semaforoFromPct(pct: number, verdeMin: number, amarilloMin: number): SemaforoKpi {
  if (pct >= verdeMin) return 'VERDE';
  if (pct >= amarilloMin) return 'AMARILLO';
  return 'ROJO';
}

function semaforoCero(valor: number, amarilloMax: number): SemaforoKpi {
  if (valor === 0) return 'VERDE';
  if (valor <= amarilloMax) return 'AMARILLO';
  return 'ROJO';
}

export function calcularPanorama(input: PanoramaInput): PanoramaControlInterno {
  const { radicados, desde, hasta } = input;
  const evaluaciones = evaluarRiesgoMasivo(radicados);
  const evalById = new Map(evaluaciones.map((e) => [e.radicadoId, e] as const));

  let total = 0;
  let vencidos = 0;
  let porVencer = 0;
  let resueltosFueraTermino = 0;
  let sinResponsable = 0;
  let conProrroga = 0;
  let devueltos = 0;
  let notifFallidas = 0;
  let anonReservados = 0;
  let criticos = 0;
  let cumplidosATiempo = 0;

  const porTenant = new Map<TenantId, {
    total: number;
    resueltos: number;
    vencidos: number;
    porVencer: number;
    sinResponsable: number;
    notifFallidas: number;
    sumDiasResp: number;
    countDiasResp: number;
    riesgos: { CRITICO: number; ALTO: number; MEDIO: number; BAJO: number };
  }>();

  function bucket(t: TenantId) {
    let b = porTenant.get(t);
    if (!b) {
      b = {
        total: 0, resueltos: 0, vencidos: 0, porVencer: 0, sinResponsable: 0,
        notifFallidas: 0, sumDiasResp: 0, countDiasResp: 0,
        riesgos: { CRITICO: 0, ALTO: 0, MEDIO: 0, BAJO: 0 },
      };
      porTenant.set(t, b);
    }
    return b;
  }

  for (const r of radicados) {
    total += 1;
    const t = r.clasificacion.oficinaDestino;
    const b = bucket(t);
    b.total += 1;

    const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
    const esActivo = activo(r);

    if (esActivo && dias < 0) { vencidos += 1; b.vencidos += 1; }
    if (esActivo && dias >= 0 && dias <= 2) { porVencer += 1; b.porVencer += 1; }
    if (r.cumplioTermino === false) resueltosFueraTermino += 1;
    if (r.cumplioTermino === true) cumplidosATiempo += 1;
    if (ESTADOS_RESUELTOS.has(r.estadoActual)) { b.resueltos += 1; }
    if (esActivo && !r.clasificacion.funcionarioResponsableUid) { sinResponsable += 1; b.sinResponsable += 1; }
    if ((r.termino.prorrogasAplicadas ?? 0) > 0) conProrroga += 1;
    if (r.estadoActual === 'DEVUELTO') devueltos += 1;
    if (r.alertaNotificacionFallida === true) { notifFallidas += 1; b.notifFallidas += 1; }
    if (r.esAnonimo === true || r.identidadReservada === true) anonReservados += 1;

    const ev = evalById.get(r.radicadoId);
    if (ev) {
      b.riesgos[ev.nivel] += 1;
      if (ev.nivel === 'CRITICO' && esActivo) criticos += 1;
    }

    if (ESTADOS_RESUELTOS.has(r.estadoActual) && r.respuestaOficial?.fecha) {
      const t0 = Date.parse(r.control.fechaRadicado);
      const t1 = Date.parse(r.respuestaOficial.fecha);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 >= t0) {
        const d = Math.max(0, Math.floor((t1 - t0) / (1000 * 60 * 60 * 24)));
        b.sumDiasResp += d;
        b.countDiasResp += 1;
      }
    }
  }

  const denom = cumplidosATiempo + resueltosFueraTermino;
  const cumplimientoPct = denom > 0 ? Math.round((cumplidosATiempo / denom) * 100) : 100;

  // Dependencia con más vencidos
  let peor: { tenantId: TenantId; nombre: string; vencidos: number } | null = null;
  let mejor: { tenantId: TenantId; nombre: string; cumplimiento: number } | null = null;
  for (const [tenantId, b] of porTenant.entries()) {
    if (!peor || b.vencidos > peor.vencidos) {
      peor = { tenantId, nombre: NOMBRES_TENANT[tenantId] ?? tenantId, vencidos: b.vencidos };
    }
    if (b.total > 0) {
      const cumplPct = b.total > 0 ? Math.round((b.resueltos / b.total) * 100) : 0;
      if (!mejor || cumplPct > mejor.cumplimiento) {
        mejor = { tenantId, nombre: NOMBRES_TENANT[tenantId] ?? tenantId, cumplimiento: cumplPct };
      }
    }
  }

  const kpis: KpiControlInterno[] = [
    kpi('total', 'Total de radicados', total, 'VERDE', 'Volumen total en el período.'),
    kpi('vencidos', 'Radicados vencidos', vencidos, semaforoCero(vencidos, 3),
      'Activos con fecha de vencimiento superada.',
      vencidos > 0 ? 'Revisar dependencias con incumplimiento.' : undefined),
    kpi('porVencer', 'Por vencer (≤ 2 días)', porVencer, semaforoCero(porVencer, 5),
      'Activos que vencen en 2 días hábiles o menos.',
      porVencer > 0 ? 'Confirmar plan de respuesta inmediato.' : undefined),
    kpi('fueraTermino', 'Respondidos fuera de término', resueltosFueraTermino,
      semaforoCero(resueltosFueraTermino, 2),
      'Respuestas oficiales registradas después del plazo legal.',
      resueltosFueraTermino > 0 ? 'Documentar hallazgo y plan de mejora.' : undefined),
    kpi('cumplimiento', 'Cumplimiento general', `${cumplimientoPct}%`,
      semaforoFromPct(cumplimientoPct, 90, 75),
      'Porcentaje de respuestas dentro del término legal.'),
    kpi('peorDep', 'Dependencia con más vencidos',
      peor && peor.vencidos > 0 ? `${peor.nombre} (${peor.vencidos})` : '—',
      peor && peor.vencidos > 3 ? 'ROJO' : peor && peor.vencidos > 0 ? 'AMARILLO' : 'VERDE',
      'Mayor cantidad de radicados vencidos en el período.'),
    kpi('mejorDep', 'Dependencia con mejor cumplimiento',
      mejor ? `${mejor.nombre} (${mejor.cumplimiento}%)` : '—',
      'VERDE', 'Mayor tasa de radicados resueltos.'),
    kpi('sinResp', 'Sin responsable asignado', sinResponsable,
      semaforoCero(sinResponsable, 2),
      'Activos sin funcionario responsable.',
      sinResponsable > 0 ? 'Asignar responsable funcional inmediato.' : undefined),
    kpi('conProrroga', 'Con prórroga', conProrroga,
      semaforoCero(conProrroga, 5),
      'Radicados con prórroga aplicada.',
      conProrroga > 5 ? 'Validar justificación de prórrogas.' : undefined),
    kpi('devueltos', 'Devueltos', devueltos, semaforoCero(devueltos, 3),
      'Radicados en estado DEVUELTO.'),
    kpi('notifFallidas', 'Notificación fallida', notifFallidas,
      semaforoCero(notifFallidas, 1),
      'Correos institucionales fallidos sin gestionar.',
      notifFallidas > 0 ? 'Gestionar canal alternativo de notificación.' : undefined),
    kpi('anonReservados', 'Anónimos / Reservados', anonReservados, 'VERDE',
      'Solicitudes con protección de identidad.'),
    kpi('criticos', 'Casos críticos activos', criticos,
      semaforoCero(criticos, 1),
      'Activos con nivel de riesgo CRÍTICO según el motor.',
      criticos > 0 ? 'Atender de inmediato y dejar evidencia.' : undefined),
    kpi('hallazgosAbiertos', 'Hallazgos abiertos', input.hallazgosAbiertos ?? 0,
      semaforoCero(input.hallazgosAbiertos ?? 0, 2),
      'Hallazgos sin cerrar registrados por Control Interno.'),
    kpi('planesAbiertos', 'Planes de mejora abiertos', input.planesAbiertos ?? 0,
      semaforoCero(input.planesAbiertos ?? 0, 2),
      'Acciones correctivas en seguimiento.'),
  ];

  return {
    periodo: { desde, hasta },
    kpis,
    peorDependencia: peor && peor.vencidos > 0 ? peor : null,
    mejorDependencia: mejor,
  };
}

function kpi(
  clave: string,
  label: string,
  valor: number | string,
  semaforo: SemaforoKpi,
  descripcion: string,
  accion?: string,
): KpiControlInterno {
  return { clave, label, valor, semaforo, descripcion, accion };
}

/* ══════════════════════════════════════════════════════════════
   DESEMPEÑO POR DEPENDENCIA
══════════════════════════════════════════════════════════════ */

export function calcularDesempenoPorDependencia(input: PanoramaInput): DesempenoDependencia[] {
  const { radicados } = input;
  const evaluaciones = evaluarRiesgoMasivo(radicados);
  const evalById = new Map(evaluaciones.map((e) => [e.radicadoId, e] as const));

  const buckets = new Map<TenantId, ReturnType<typeof emptyBucket>>();
  for (const r of radicados) {
    const t = r.clasificacion.oficinaDestino;
    let b = buckets.get(t);
    if (!b) { b = emptyBucket(); buckets.set(t, b); }

    b.total += 1;
    const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
    const esActivo = activo(r);

    if (ESTADOS_RESUELTOS.has(r.estadoActual)) b.resueltos += 1;
    if (esActivo && dias < 0) b.vencidos += 1;
    if (esActivo && dias >= 0 && dias <= 2) b.porVencer += 1;
    if (esActivo && !r.clasificacion.funcionarioResponsableUid) b.sinResponsable += 1;
    if (r.alertaNotificacionFallida === true) b.notifFallidas += 1;

    if (ESTADOS_RESUELTOS.has(r.estadoActual) && r.respuestaOficial?.fecha) {
      const t0 = Date.parse(r.control.fechaRadicado);
      const t1 = Date.parse(r.respuestaOficial.fecha);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && t1 >= t0) {
        b.sumDiasResp += Math.max(0, Math.floor((t1 - t0) / (1000 * 60 * 60 * 24)));
        b.countDiasResp += 1;
      }
    }

    const ev = evalById.get(r.radicadoId);
    if (ev) b.riesgos[ev.nivel] += 1;
  }

  return Array.from(buckets.entries())
    .map(([tenantId, b]) => {
      const cumplimientoPct = b.total > 0 ? Math.round((b.resueltos / b.total) * 100) : 0;
      const promedio = b.countDiasResp > 0 ? Math.round(b.sumDiasResp / b.countDiasResp) : null;
      const nivel = nivelDependencia(b.vencidos, b.riesgos.CRITICO, b.riesgos.ALTO);
      return {
        tenantId,
        nombre: NOMBRES_TENANT[tenantId] ?? tenantId,
        total: b.total,
        resueltos: b.resueltos,
        vencidos: b.vencidos,
        porVencer: b.porVencer,
        cumplimientoPct,
        promedioDiasRespuesta: promedio,
        sinResponsable: b.sinResponsable,
        hallazgosAbiertos: input.hallazgosPorTenant?.get(tenantId) ?? 0,
        planesMejoraAbiertos: input.planesPorTenant?.get(tenantId) ?? 0,
        notificacionesFallidas: b.notifFallidas,
        nivelRiesgo: nivel,
      };
    })
    .sort((a, b) => b.vencidos - a.vencidos);
}

function emptyBucket() {
  return {
    total: 0, resueltos: 0, vencidos: 0, porVencer: 0,
    sinResponsable: 0, notifFallidas: 0,
    sumDiasResp: 0, countDiasResp: 0,
    riesgos: { CRITICO: 0, ALTO: 0, MEDIO: 0, BAJO: 0 } as Record<NivelRiesgo, number>,
  };
}

function nivelDependencia(vencidos: number, criticos: number, altos: number): NivelRiesgo {
  if (vencidos >= 5 || criticos >= 3) return 'CRITICO';
  if (vencidos >= 2 || criticos >= 1 || altos >= 5) return 'ALTO';
  if (vencidos >= 1 || altos >= 1) return 'MEDIO';
  return 'BAJO';
}
