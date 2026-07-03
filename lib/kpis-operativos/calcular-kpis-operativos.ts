import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { TIMEZONE_COLOMBIA } from '@/lib/fecha-colombia';

/**
 * Panel Operativo Fase 2 — KPIs operativos para la barra secundaria
 * de Ventanilla Única. Complementan (NO reemplazan) los 8 KPIs MIPG
 * oficiales.
 *
 * Todas las métricas se calculan en frontend sobre `todosLosRadicados`
 * que ya está en memoria por el `onSnapshot` global — cero lecturas
 * Firestore adicionales.
 */

export interface KpisOperativos {
  hoy:            number;
  sinAsignar:     number;
  sinSellar:      number;
  correoFallido:  number;
  resueltosHoy:   number;
}

const ESTADOS_RESUELTOS = new Set<string>(['RESUELTO', 'RECHAZADO']);
const ESTADOS_ACTIVOS = new Set<string>([
  'PENDIENTE', 'ASIGNADO', 'EN_REVISION', 'EN_PROCESO', 'DEVUELTO', 'PRORROGA',
]);

const DIAS_MS = 24 * 60 * 60 * 1000;
const VENTANA_SIN_SELLAR_MS = 30 * DIAS_MS;

/**
 * Convierte una fecha (ISO o Date) al string `YYYY-MM-DD` en zona
 * América/Bogotá. Usado para comparar día calendario colombiano sin
 * ambigüedad de UTC.
 */
export function fechaYmdColombia(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // en-CA da formato YYYY-MM-DD directamente en la zona indicada.
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE_COLOMBIA });
}

/** True si el radicado está en un estado activo (no resuelto/rechazado). */
export function esActivo(r: VentanillaRadicado): boolean {
  return ESTADOS_ACTIVOS.has(r.estadoActual);
}

/** True si el radicado tiene al menos un PDF sin copia sellada. */
export function tienePdfSinSellar(r: VentanillaRadicado): boolean {
  return r.archivos.some((a) => a.tipo === 'application/pdf' && !a.sellado);
}

/**
 * Fecha real de resolución del radicado:
 *  - fuente primaria: respuestaOficial.fecha (fecha que registró el
 *    funcionario al resolver);
 *  - fallback: ultimaActualizacion (para radicados históricos sin
 *    respuestaOficial pero con estadoActual RESUELTO).
 */
export function fechaResolucion(r: VentanillaRadicado): string | null {
  if (r.respuestaOficial?.fecha) return r.respuestaOficial.fecha;
  if (ESTADOS_RESUELTOS.has(r.estadoActual)) return r.ultimaActualizacion ?? null;
  return null;
}

/**
 * Calcula los KPIs operativos para una lista de radicados y una
 * referencia temporal (default: `new Date()`). La referencia inyectable
 * permite tests deterministas.
 */
export function calcularKpisOperativos(
  radicados: VentanillaRadicado[],
  ahora: Date = new Date(),
): KpisOperativos {
  const hoyYmd = fechaYmdColombia(ahora);
  const limiteSinSellarMs = ahora.getTime() - VENTANA_SIN_SELLAR_MS;

  const acc: KpisOperativos = {
    hoy:           0,
    sinAsignar:    0,
    sinSellar:     0,
    correoFallido: 0,
    resueltosHoy:  0,
  };

  for (const r of radicados) {
    // KPI 1 — Radicados de hoy (por fechaRadicado, día calendario Colombia).
    if (r.control?.fechaRadicado && fechaYmdColombia(r.control.fechaRadicado) === hoyYmd) {
      acc.hoy += 1;
    }

    // KPI 2 — Sin asignar: PENDIENTE sin funcionarioResponsableUid.
    if (r.estadoActual === 'PENDIENTE'
        && !r.clasificacion?.funcionarioResponsableUid) {
      acc.sinAsignar += 1;
    }

    // KPI 5 — Sin sellar: activos, con al menos un PDF sin sello, y
    // radicados de los últimos 30 días. Filtro por ventana evita que
    // históricos infinitos inflen el conteo.
    if (esActivo(r) && tienePdfSinSellar(r)) {
      const fechaMs = r.control?.fechaRadicado
        ? new Date(r.control.fechaRadicado).getTime()
        : 0;
      if (!Number.isNaN(fechaMs) && fechaMs >= limiteSinSellarMs) {
        acc.sinSellar += 1;
      }
    }

    // KPI 7 — Con correo institucional fallido (bandera raíz del modelo).
    if (r.alertaNotificacionFallida === true) {
      acc.correoFallido += 1;
    }

    // KPI 8 — Resueltos hoy: fecha real de resolución en día colombiano.
    const fechaResol = fechaResolucion(r);
    if (fechaResol && fechaYmdColombia(fechaResol) === hoyYmd) {
      acc.resueltosHoy += 1;
    }
  }

  return acc;
}
