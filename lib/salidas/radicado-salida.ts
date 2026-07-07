/**
 * Sprint Radicación de salida — serie propia de correspondencia
 * DESPACHADA por la administración.
 *
 * Dos series amarradas (decisión aprobada): la entrada conserva su
 * formato `1-{CANAL}-{AÑO}-{NNNNNNNN}` intacto; la salida estrena la
 * serie `2-SAL-{AÑO}-{NNNNNNNN}` con contador anual propio
 * (`counters/salidas-{año}`), misma mecánica transaccional del
 * consecutivo de entrada. Así el libro de salidas es una serie
 * continua auditable — sin huecos ni duplicados — y el amarre
 * entrada↔salida vive en el documento y la trazabilidad, no en el
 * número.
 *
 * Fase B: el consecutivo se genera SIEMPRE server-side (Admin SDK, en
 * /api/salidas/registrar y /api/dependencias/registro-expres); aquí
 * solo vive el formato de la serie.
 */

export function formatearRadicadoSalida(
  consecutivo: number,
  fecha = new Date(),
): string {
  const year = fecha.getFullYear();
  return `2-SAL-${year}-${String(consecutivo).padStart(8, '0')}`;
}
