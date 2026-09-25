import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  esActivo,
  fechaYmdColombia,
  tienePdfSinSellar,
} from '@/lib/kpis-operativos/calcular-kpis-operativos';
import { tieneDatosNoAportados } from '@/lib/busqueda/filtros-radicado';

/**
 * Ventanilla · módulo de mostrador — "Trabajo de hoy".
 *
 * Reduce los radicados del día calendario colombiano a filas con sus
 * pendientes puntuales de recepción. Reutiliza los MISMOS predicados de
 * los KPIs operativos para que los números del mostrador y del Tablero
 * nunca se contradigan.
 *
 * Protección de identidad reservada: la fila NUNCA incluye el nombre
 * del solicitante — solo id, hora, trámite y dependencia.
 *
 * Función pura: sin React, sin Firestore.
 */

export type PendienteMostrador =
  | 'SELLAR_PDF'
  | 'DATOS_INCOMPLETOS'
  | 'CORREO_FALLIDO'
  | 'CONSTANCIA_SIN_ENVIAR';

export type FiltroTrabajoHoy = PendienteMostrador | 'TODOS';

export interface FilaTrabajoHoy {
  radicadoId: string;
  /** Hora legible registrada al radicar ("10:00"). */
  horaRadicado: string;
  /** ISO completo, usado para ordenar cronológicamente. */
  fechaRadicado: string;
  tipoSolicitudNombre: string;
  oficinaDestino: TenantId;
  /** True si el solicitante es anónimo o de identidad reservada. */
  identidadReservada: boolean;
  pendientes: PendienteMostrador[];
}

export interface ConteosTrabajoHoy {
  sellarPdf: number;
  datosIncompletos: number;
  correoFallido: number;
  constanciaSinEnviar: number;
}

export interface TrabajoDeHoy {
  filas: FilaTrabajoHoy[];
  conteos: ConteosTrabajoHoy;
}

function pendientesDe(r: VentanillaRadicado): PendienteMostrador[] {
  const pendientes: PendienteMostrador[] = [];
  if (esActivo(r) && tienePdfSinSellar(r)) pendientes.push('SELLAR_PDF');
  if (tieneDatosNoAportados(r.solicitante?.datosNoAportados)) pendientes.push('DATOS_INCOMPLETOS');
  if (r.alertaNotificacionFallida === true) pendientes.push('CORREO_FALLIDO');
  // Constancia: solo cuenta como pendiente cuando HAY correo al cual
  // enviarla y aún no se ha enviado. Mide envío por correo — si la
  // funcionaria solo la imprime, el chip persiste (caveat aceptado).
  const tieneCorreo = Boolean(r.solicitante?.email?.trim())
    && r.solicitante?.datosNoAportados?.correo !== true;
  if (tieneCorreo && r.constanciaEnviadaCorreo !== true) {
    pendientes.push('CONSTANCIA_SIN_ENVIAR');
  }
  return pendientes;
}

/**
 * Filas del mostrador para el día calendario colombiano de `ahora`,
 * ordenadas cronológicamente por hora de radicación, con conteos por
 * tipo de pendiente para los chips de filtro.
 */
export function trabajoDeHoy(
  radicados: VentanillaRadicado[],
  ahora: Date = new Date(),
): TrabajoDeHoy {
  const hoyYmd = fechaYmdColombia(ahora);

  const filas = radicados
    .filter((r) => r.control?.fechaRadicado
      && fechaYmdColombia(r.control.fechaRadicado) === hoyYmd)
    .map((r): FilaTrabajoHoy => ({
      radicadoId:          r.radicadoId,
      horaRadicado:        r.control.horaRadicado ?? '',
      fechaRadicado:       r.control.fechaRadicado,
      tipoSolicitudNombre: r.termino?.tipoSolicitudNombre || 'Sin clasificar',
      oficinaDestino:      r.clasificacion?.oficinaDestino ?? 'VENTANILLA_UNICA',
      identidadReservada:  r.identidadReservada === true || r.esAnonimo === true,
      pendientes:          pendientesDe(r),
    }))
    .sort((a, b) => new Date(a.fechaRadicado).getTime() - new Date(b.fechaRadicado).getTime());

  const conteos: ConteosTrabajoHoy = {
    sellarPdf: 0, datosIncompletos: 0, correoFallido: 0, constanciaSinEnviar: 0,
  };
  for (const f of filas) {
    if (f.pendientes.includes('SELLAR_PDF'))            conteos.sellarPdf += 1;
    if (f.pendientes.includes('DATOS_INCOMPLETOS'))     conteos.datosIncompletos += 1;
    if (f.pendientes.includes('CORREO_FALLIDO'))        conteos.correoFallido += 1;
    if (f.pendientes.includes('CONSTANCIA_SIN_ENVIAR')) conteos.constanciaSinEnviar += 1;
  }

  return { filas, conteos };
}

/** Filtro puro para los chips: 'TODOS' devuelve la lista intacta. */
export function filtrarTrabajoHoy(
  filas: FilaTrabajoHoy[],
  filtro: FiltroTrabajoHoy,
): FilaTrabajoHoy[] {
  if (filtro === 'TODOS') return filas;
  return filas.filter((f) => f.pendientes.includes(filtro));
}
