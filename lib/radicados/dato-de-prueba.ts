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
 *
 * DOS VOCABULARIOS, UN CRITERIO (26-ago-2026). Los expedientes de licencias no
 * usan `isTest`: marcan la demostración con `esPrueba`, escrito por el candado
 * R10 (`lib/server/expedientes-licencias.ts`). Este criterio no lo miraba, así
 * que `soloOperacionReal` sobre la colección `expedientes` no filtraba NADA —
 * y con el candado cerrado el 100% de los expedientes es de demostración. El
 * vigía del término los alertaba a todos como si fueran licencias reales camino
 * del silencio administrativo positivo.
 *
 * Se reconocen los dos vocabularios en vez de renombrar uno: `esPrueba` está
 * ligado a la doctrina R10 y renombrarlo esparciría el cambio a la
 * documentación del candado y exigiría migrar los expedientes ya escritos.
 * Reconocerlo aquí es aditivo y no deja a nadie fuera.
 */

/** Marcas que el sistema pone sobre lo que no debe contar como operación real. */
export interface MarcasDePrueba {
  isTest?: boolean;
  excludeFromMetrics?: boolean;
  /**
   * Vocabulario de los expedientes de licencias — `true` en todo expediente
   * creado bajo el candado R10. Equivale a `isTest` para este criterio.
   */
  esPrueba?: boolean;
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
  return r.isTest === true
    || r.esPrueba === true
    || r.excludeFromMetrics === true
    || r.anulado != null;
}

/** Deja solo la operación real. Usar en TODA lectura que alimente bandeja, métricas, alertas o reportes. */
export function soloOperacionReal<T extends MarcasDePrueba>(registros: T[]): T[] {
  return registros.filter((r) => !esDatoDePrueba(r));
}
