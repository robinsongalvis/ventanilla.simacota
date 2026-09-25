/**
 * Sprint Radicación de salida — serie propia de correspondencia
 * DESPACHADA por la administración.
 *
 * Dos series amarradas (decisión aprobada): la entrada conserva su
 * formato `1-110-{AAAAMM}-{NNNNNNNN}`; la salida usa la serie
 * `2-110-{AAAAMM}-{NNNNNNNN}` con contador anual propio
 * (`counters/salidas-{año}`), misma mecánica transaccional del
 * consecutivo de entrada. Así el libro de salidas es una serie
 * continua auditable — sin huecos ni duplicados — y el amarre
 * entrada↔salida vive en el documento y la trazabilidad, no en el
 * número.
 *
 * ADR-0024 (2026-07-15, decisión del propietario): alinea la salida con
 * el formato legado municipal — el código de oficina `110` reemplaza el
 * canal `SAL`, y el tercer segmento pasa a `{AAAAMM}`. El consecutivo
 * SIGUE SIENDO ANUAL (AGN 060/2001: serie continua; el mes es
 * informativo); `counters/salidas-{año}` no cambia. Los documentos
 * anteriores a este cambio conservan su id `2-SAL-{AAAA}-…` — nunca se
 * reescriben — y todo consumidor debe seguir aceptándolos.
 *
 * Fase B: el consecutivo se genera SIEMPRE server-side (Admin SDK, en
 * /api/salidas/registrar y /api/dependencias/registro-expres); aquí
 * solo vive el formato de la serie.
 */

export const CODIGO_OFICINA_RADICADORA_SALIDA = '110';

export function formatearRadicadoSalida(
  consecutivo: number,
  fecha = new Date(),
): string {
  const year = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `2-${CODIGO_OFICINA_RADICADORA_SALIDA}-${year}${mes}-${String(consecutivo).padStart(8, '0')}`;
}
