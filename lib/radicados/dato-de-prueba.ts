/**
 * Criterio ÚNICO de «esto no es operación real».
 *
 * Existía repetido literalmente en seis sitios (`!r.isTest &&
 * !r.excludeFromMetrics`) y ausente en un séptimo — Control Interno —, que es
 * precisamente el que alimenta las alertas de vencimiento, el panorama y el
 * Excel institucional. Ese olvido no era inocuo: un radicado de prueba
 * anulado conserva su `estadoActual` y su fecha de vencimiento, así que
 * aparecía como PQRSD ciudadana VENCIDA en nivel CRÍTICO y se exportaba al
 * indicador oficial de cumplimiento de términos del municipio.
 *
 * Un criterio de exclusión duplicado siempre termina así: se corrige en cinco
 * copias y se olvida la sexta. Aquí vive una sola vez.
 */

/** Marcas que el sistema pone sobre lo que no debe contar como operación real. */
export interface MarcasDePrueba {
  isTest?: boolean;
  excludeFromMetrics?: boolean;
  /** Bloque escrito por las actas de anulación (scripts/operacion/limpiar-datos-prueba.mjs). */
  anulado?: { fecha: string; motivo: string; acta: string } | null;
}

/**
 * `true` si el registro NO representa operación real: dato de prueba, excluido
 * de métricas, o número anulado con acta.
 *
 * Incluye `anulado` a propósito y no solo por redundancia: es la marca
 * institucional del acta, la que un auditor busca. Si mañana alguien anula un
 * número sin poner `isTest`, este criterio lo sigue excluyendo de la operación.
 */
export function esDatoDePrueba(r: MarcasDePrueba | null | undefined): boolean {
  if (!r) return false;
  return r.isTest === true || r.excludeFromMetrics === true || r.anulado != null;
}

/** Deja solo la operación real. Usar en TODA lectura que alimente bandeja, métricas, alertas o reportes. */
export function soloOperacionReal<T extends MarcasDePrueba>(registros: T[]): T[] {
  return registros.filter((r) => !esDatoDePrueba(r));
}
