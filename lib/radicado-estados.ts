/**
 * Fuente única de la máquina de estados del radicado (OAT-05).
 *
 * Antes: el set de "estados activos" estaba duplicado (idéntico) en ≥3
 * módulos y el de "cerrados/resueltos" en ≥4. Añadir un estado obligaba a
 * tocar cada copia, con riesgo de inconsistencia. Aquí viven una sola vez;
 * los módulos (kpis-operativos, proxima-accion, reportes, reportes-mipg)
 * importan de aquí.
 *
 * `EstadoRadicado` es el tipo canónico (src/types/radicado.ts). Estas
 * agrupaciones clasifican esos estados por su semántica de ciclo de vida.
 */

/** Estados en los que el radicado sigue "vivo" (en trámite). */
export const ESTADOS_ACTIVOS = new Set<string>([
  'PENDIENTE',
  'ASIGNADO',
  'EN_REVISION',
  'EN_PROCESO',
  'DEVUELTO',
  'PRORROGA',
]);

/** Estados de cierre del radicado (ya no computan término). */
export const ESTADOS_CERRADOS = new Set<string>([
  'RESUELTO',
  'RECHAZADO',
]);

/** ¿El estado corresponde a un radicado activo (en trámite)? */
export function esEstadoActivo(estado: string): boolean {
  return ESTADOS_ACTIVOS.has(estado);
}

/** ¿El estado corresponde a un radicado cerrado? */
export function esEstadoCerrado(estado: string): boolean {
  return ESTADOS_CERRADOS.has(estado);
}
