import type { VentanillaRadicado, TrazabilidadRadicado } from '@/src/types/ventanilla';
import { diasRestantesHabiles } from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   Cálculo de indicadores MIPG — Función pura, testable.

   No depende de Firestore ni del DOM. Recibe los radicados ya
   filtrados (por rol y por fechas) y devuelve los KPIs.
══════════════════════════════════════════════════════════════ */

export interface IndicadoresMipg {
  totalRadicados:           number;
  pendientes:               number;
  enTramite:                number;
  resueltos:                number;
  resueltosEnTermino:       number;
  resueltosFueraDeTermino:  number;
  porVencer:                number;
  vencidos:                 number;
  tasaResolucionPct:        number;     // (resueltos / total) * 100
  cumplimientoTerminosPct:  number | null;
  promedioDiasRespuesta:    number | null;
  sinResponsable:           number;
  notificacionesFallidas:   number;
  anonimosOReservados:      number;
}

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);
const ESTADOS_EN_TRAMITE = new Set<string>(['ASIGNADO', 'EN_REVISION', 'EN_PROCESO', 'PRORROGA']);
const ESTADOS_PENDIENTES = new Set<string>(['PENDIENTE', 'DEVUELTO']);

function esAnonimoOReservado(r: VentanillaRadicado): boolean {
  return r.esAnonimo === true
      || r.tipoPresentacion === 'ANONIMA'
      || r.tipoPresentacion === 'RESERVADA'
      || r.identidadReservada === true;
}

export function calcularIndicadoresMipg(radicados: VentanillaRadicado[]): IndicadoresMipg {
  const totalRadicados   = radicados.length;
  const resueltos        = radicados.filter((r) => ESTADOS_RESUELTOS.has(r.estadoActual)).length;
  const enTramite        = radicados.filter((r) => ESTADOS_EN_TRAMITE.has(r.estadoActual)).length;
  const pendientes       = radicados.filter((r) => ESTADOS_PENDIENTES.has(r.estadoActual)).length;

  const conDato                = radicados.filter((r) => r.cumplioTermino === true || r.cumplioTermino === false);
  const resueltosEnTermino     = radicados.filter((r) => r.cumplioTermino === true).length;
  const resueltosFueraDeTermino = radicados.filter((r) => r.cumplioTermino === false).length;
  const cumplimientoTerminosPct = conDato.length > 0
    ? Math.round((resueltosEnTermino / conDato.length) * 100)
    : null;

  const tasaResolucionPct = totalRadicados > 0
    ? Math.round((resueltos / totalRadicados) * 100)
    : 0;

  // Días hábiles entre radicación y respuesta — solo para resueltos
  const diasResolucion: number[] = [];
  for (const r of radicados) {
    if (!ESTADOS_RESUELTOS.has(r.estadoActual)) continue;
    const fechaResp = r.respuestaOficial?.fecha;
    if (!fechaResp) continue;
    const ms = new Date(fechaResp).getTime() - new Date(r.control.fechaRadicado).getTime();
    if (Number.isNaN(ms)) continue;
    const dias = Math.round(ms / (1000 * 60 * 60 * 24));
    diasResolucion.push(dias);
  }
  const promedioDiasRespuesta = diasResolucion.length > 0
    ? Math.round(diasResolucion.reduce((a, b) => a + b, 0) / diasResolucion.length)
    : null;

  // Por vencer / Vencidos: solo activos
  let porVencer = 0;
  let vencidos  = 0;
  for (const r of radicados) {
    if (ESTADOS_RESUELTOS.has(r.estadoActual)) continue;
    const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
    if (dias < 0) vencidos += 1;
    else if (dias <= 2) porVencer += 1;
  }

  const sinResponsable = radicados.filter(
    (r) => !ESTADOS_RESUELTOS.has(r.estadoActual)
        && !r.clasificacion.funcionarioResponsableNombre,
  ).length;

  const notificacionesFallidas = radicados.filter((r) => r.alertaNotificacionFallida === true).length;
  const anonimosOReservados    = radicados.filter(esAnonimoOReservado).length;

  return {
    totalRadicados,
    pendientes,
    enTramite,
    resueltos,
    resueltosEnTermino,
    resueltosFueraDeTermino,
    porVencer,
    vencidos,
    tasaResolucionPct,
    cumplimientoTerminosPct,
    promedioDiasRespuesta,
    sinResponsable,
    notificacionesFallidas,
    anonimosOReservados,
  };
}

/* ══════════════════════════════════════════════════════════════
   Cumplimiento por dependencia — agrupación
══════════════════════════════════════════════════════════════ */

export interface CumplimientoPorDependencia {
  tenantId:                string;
  total:                   number;
  asignados:               number;
  resueltos:               number;
  pendientes:              number;
  porVencer:               number;
  vencidos:                number;
  resueltosEnTermino:      number;
  resueltosFueraDeTermino: number;
  cumplimientoPct:         number | null;
}

export function calcularCumplimientoPorDependencia(
  radicados: VentanillaRadicado[],
): CumplimientoPorDependencia[] {
  const mapa = new Map<string, VentanillaRadicado[]>();
  for (const r of radicados) {
    const key = r.clasificacion.oficinaDestino;
    const bucket = mapa.get(key) ?? [];
    bucket.push(r);
    mapa.set(key, bucket);
  }

  const resultado: CumplimientoPorDependencia[] = [];
  for (const [tenantId, lista] of mapa.entries()) {
    let asignados = 0, resueltos = 0, pendientes = 0;
    let porVencer = 0, vencidos = 0;
    let enTermino = 0, fueraTermino = 0;

    for (const r of lista) {
      if (ESTADOS_RESUELTOS.has(r.estadoActual)) resueltos += 1;
      else if (ESTADOS_EN_TRAMITE.has(r.estadoActual)) asignados += 1;
      else if (ESTADOS_PENDIENTES.has(r.estadoActual)) pendientes += 1;

      if (!ESTADOS_RESUELTOS.has(r.estadoActual)) {
        const dias = diasRestantesHabiles(r.termino.fechaVencimiento);
        if (dias < 0) vencidos += 1;
        else if (dias <= 2) porVencer += 1;
      }
      if (r.cumplioTermino === true)  enTermino += 1;
      if (r.cumplioTermino === false) fueraTermino += 1;
    }

    const conDato = enTermino + fueraTermino;
    const cumplimientoPct = conDato > 0 ? Math.round((enTermino / conDato) * 100) : null;

    resultado.push({
      tenantId,
      total: lista.length,
      asignados,
      resueltos,
      pendientes,
      porVencer,
      vencidos,
      resueltosEnTermino: enTermino,
      resueltosFueraDeTermino: fueraTermino,
      cumplimientoPct,
    });
  }

  resultado.sort((a, b) => b.total - a.total);
  return resultado;
}

/* ══════════════════════════════════════════════════════════════
   Notificaciones — extracción desde trazabilidad
══════════════════════════════════════════════════════════════ */

export interface NotificacionExportable {
  radicadoId:           string;
  tipoNotificacion:     string;
  destinatario:         string;
  canal:                string;
  estado:               'ENVIADA' | 'FALLIDA' | 'OMITIDA' | 'GESTIONADA';
  fecha:                string;
  error?:               string;
  gestionadaManualmente: boolean;
  motivoGestion?:       string;
}

const ACCIONES_NOTIFICACION = new Set<string>([
  'NOTIFICACION_CORREO_ENVIADA',
  'NOTIFICACION_CORREO_FALLIDA',
  'NOTIFICACION_OMITIDA_DUPLICADA',
  'NOTIFICACION_GESTIONADA_MANUALMENTE',
]);

export function extraerNotificaciones(
  trazabilidadPorRadicado: Map<string, TrazabilidadRadicado[]>,
): NotificacionExportable[] {
  const salida: NotificacionExportable[] = [];
  for (const [radicadoId, eventos] of trazabilidadPorRadicado.entries()) {
    for (const e of eventos) {
      const accionStr = String(e.accion);
      if (!ACCIONES_NOTIFICACION.has(accionStr)) continue;
      const md = (e.metadata as Record<string, unknown> | undefined) ?? {};
      let estado: NotificacionExportable['estado'];
      if (accionStr === 'NOTIFICACION_CORREO_ENVIADA') estado = 'ENVIADA';
      else if (accionStr === 'NOTIFICACION_CORREO_FALLIDA') estado = 'FALLIDA';
      else if (accionStr === 'NOTIFICACION_OMITIDA_DUPLICADA') estado = 'OMITIDA';
      else estado = 'GESTIONADA';

      salida.push({
        radicadoId,
        tipoNotificacion:     typeof md.tipoNotificacion === 'string' ? md.tipoNotificacion : '—',
        destinatario:         typeof md.destinatario === 'string' ? md.destinatario : '—',
        canal:                'CORREO',
        estado,
        fecha:                e.fecha,
        error:                typeof md.error === 'string' ? md.error : undefined,
        gestionadaManualmente: accionStr === 'NOTIFICACION_GESTIONADA_MANUALMENTE',
        motivoGestion:        accionStr === 'NOTIFICACION_GESTIONADA_MANUALMENTE'
                                ? (typeof e.nota === 'string' ? e.nota : undefined)
                                : undefined,
      });
    }
  }
  return salida;
}
