/**
 * Reloj de subsanación parametrizado por régimen (D5, ADR-0026).
 *
 * PURO: sin I/O. Calcula fechas límite y ventanas a partir de un
 * `RegimenSubsanacion` (dato) en vez de tener el plazo grabado en código.
 * El objetivo explícito de esta pieza es que el MISMO motor produzca, con
 * datos distintos, tanto el régimen de Licencia de Construcción
 * (Decreto 1077: 30 días hábiles + prórroga de 15 días hábiles) como el de
 * Ley 1755 (1 mes calendario + prórroga de 1 mes, ventana de 10 días
 * hábiles) — ver `__tests__/motor-expedientes-subsanacion-regimen.test.ts`.
 * Ningún número de esos regímenes está hardcodeado aquí.
 *
 * Reutiliza el calendario de festivos colombianos (`festivosColombia`,
 * `esDiaHabil`) y las utilidades de fecha (`atLocalNoon`, `addDays`,
 * `sumarMesCalendario`) de `lib/tiempos-radicado.ts` en vez de duplicar esa
 * lógica.
 *
 * Nota de diseño (declarada explícitamente): `calcularFechaVencimiento` de
 * `lib/tiempos-radicado.ts` NO se reutiliza directamente aquí porque está
 * acoplada al catálogo cerrado `TipoSolicitudId` (resuelve el plazo por un
 * id de tipo de solicitud, con fallback a PETICION_GENERAL si el id no
 * existe) — usarla para un régimen arbitrario `{dias, unidad}` obligaría a
 * hardcodear un id de catálogo o a extender ese catálogo cerrado, lo cual
 * contradice el requisito de "NO hardcodear ninguno" de este reloj. En su
 * lugar se reutilizan las piezas primitivas que esa misma función usa
 * internamente (`festivosColombia`, `esDiaHabil`, `addDays`), que sí son
 * genéricas. Ver `docs/planes/PLAN_FASES_MOTOR_EXPEDIENTES.md` §Fase 0.
 */

import {
  addDays,
  atLocalNoon,
  esDiaHabil,
  festivosColombia,
  sumarMesCalendario,
} from '@/lib/tiempos-radicado';
import type { RegimenSubsanacion, UnidadPlazoSubsanacion } from './tipos';

/** Suma `cantidad` unidades de plazo (hábiles, calendario o meses) a `fecha`, mediodía local. */
function sumarPlazo(
  fecha: Date,
  cantidad: number,
  unidad: UnidadPlazoSubsanacion,
  festivosExtra: string[],
): Date {
  if (unidad === 'MESES') {
    return sumarMesCalendario(fecha, cantidad);
  }
  if (unidad === 'CALENDARIO') {
    return addDays(fecha, cantidad);
  }
  // HABILES — mismo algoritmo de conteo que `calcularFechaVencimiento`.
  const festivos = new Set([
    ...festivosColombia(fecha.getFullYear()),
    ...festivosColombia(fecha.getFullYear() + 1),
    ...festivosExtra,
  ]);
  let cursor = fecha;
  let pendientes = Math.max(0, Math.trunc(cantidad));
  while (pendientes > 0) {
    cursor = addDays(cursor, 1);
    if (esDiaHabil(cursor, festivos)) pendientes -= 1;
  }
  return cursor;
}

/**
 * Fecha límite para que el ciudadano subsane, contada desde la
 * NOTIFICACIÓN del requerimiento (no desde su emisión), según el régimen
 * del trámite.
 */
export function calcularLimiteSubsanacion(
  regimen: RegimenSubsanacion,
  fechaNotificacion: string | Date,
  festivosExtra: string[] = [],
): Date {
  const inicio = atLocalNoon(fechaNotificacion);
  return sumarPlazo(inicio, regimen.dias, regimen.unidad, festivosExtra);
}

/**
 * Fecha límite CON prórroga, contada desde la fecha límite vigente
 * (`fechaLimiteActual`). `prorrogaDias` usa la misma `unidad` que el plazo
 * principal del régimen.
 */
export function calcularLimiteConProrroga(
  regimen: RegimenSubsanacion,
  fechaLimiteActual: string | Date,
  festivosExtra: string[] = [],
): Date {
  const inicio = atLocalNoon(fechaLimiteActual);
  return sumarPlazo(inicio, regimen.prorrogaDias, regimen.unidad, festivosExtra);
}

/**
 * Fecha límite hasta la cual es válido EMITIR el requerimiento de
 * subsanación, contada desde la radicación (`ventanaRequerimiento` del
 * régimen).
 */
export function calcularFinVentanaRequerimiento(
  regimen: RegimenSubsanacion,
  fechaRadicacion: string | Date,
  festivosExtra: string[] = [],
): Date {
  const inicio = atLocalNoon(fechaRadicacion);
  return sumarPlazo(
    inicio,
    regimen.ventanaRequerimiento.dias,
    regimen.ventanaRequerimiento.unidad,
    festivosExtra,
  );
}

/** ¿`ahora` cae dentro de la ventana válida para emitir el requerimiento de subsanación de este régimen? */
export function dentroVentanaRequerimientoRegimen(
  regimen: RegimenSubsanacion,
  fechaRadicacion: string | Date,
  ahora: string | Date = new Date(),
  festivosExtra: string[] = [],
): boolean {
  const limite = calcularFinVentanaRequerimiento(regimen, fechaRadicacion, festivosExtra);
  return atLocalNoon(ahora).getTime() <= limite.getTime();
}
