/**
 * Sprint Recepción fluida — medios físicos entregados con el radicado.
 *
 * El ciudadano a veces entrega CDs, memorias USB o sobres sellados
 * junto al documento. Los chips del formulario componen la descripción
 * en `detalle.anexosDescripcion` — campo que YA existe en el modelo y
 * que el detalle del radicado ya muestra — así que el registro queda
 * en Firestore sin ningún campo nuevo.
 *
 * Funciones puras: sin React, sin Firestore.
 */

export const MEDIOS_ANEXOS = ['CD', 'USB', 'Sobre sellado', 'Otro'] as const;

export type MedioAnexo = (typeof MEDIOS_ANEXOS)[number];

/**
 * Agrega o quita un medio de la selección, conservando el orden del
 * catálogo (los valores fuera de catálogo quedan al final).
 */
export function toggleMedio(actuales: readonly string[], medio: string): string[] {
  const seleccion = new Set(actuales);
  if (seleccion.has(medio)) {
    seleccion.delete(medio);
  } else {
    seleccion.add(medio);
  }
  const enCatalogo = MEDIOS_ANEXOS.filter((m) => seleccion.has(m));
  const extras = [...seleccion].filter(
    (m) => !(MEDIOS_ANEXOS as readonly string[]).includes(m),
  );
  return [...enCatalogo, ...extras];
}

/** Texto corto para `anexosDescripcion`, comprobante y sello ("CD, USB"). */
export function componerDescripcionAnexos(medios: readonly string[]): string {
  return medios.join(', ');
}
