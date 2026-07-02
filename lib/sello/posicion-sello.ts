/**
 * Sprint Ventanilla Operativa 3 — cálculo de coordenadas del sello.
 *
 * Se ubica el sello en la ESQUINA SUPERIOR IZQUIERDA (decisión de UX
 * congelada). La izquierda evita tapar el N° de oficio o fecha del
 * remitente, que suelen estar en la esquina superior derecha.
 *
 * Margen interior: 12 pt desde el borde superior y desde el borde
 * izquierdo. Tamaño: 150×70 pt (~5.3×2.5 cm). Estos valores se
 * mantienen constantes para dar consistencia visual, independientes
 * del tamaño de página (carta, A4, oficio, landscape, half-letter).
 *
 * En PDFs muy pequeños (imposibles en la práctica pero posible edge
 * case), el helper garantiza que el sello nunca cruza el borde derecho
 * ni inferior — se reduce proporcionalmente si es necesario.
 */

export interface DimensionesPagina {
  ancho: number;
  alto:  number;
}

export interface RectanguloSello {
  /** X del borde izquierdo del sello. Origen (0,0) en PDF = esquina inferior izquierda. */
  x: number;
  /** Y del borde inferior del sello (nota: PDF crece hacia arriba). */
  y: number;
  ancho: number;
  alto:  number;
}

/** Dimensiones nominales del sello, en puntos PDF (1 pt = 1/72 inch). */
export const SELLO_ANCHO_PT  = 150;
export const SELLO_ALTO_PT   = 70;
export const SELLO_MARGEN_PT = 12;

/**
 * Devuelve el rectángulo donde se debe dibujar el sello en la página
 * dada. El sello se ancla arriba a la izquierda; en PDF el eje Y crece
 * hacia arriba, por lo que la coordenada `y` del sello es
 * `alto - margen - selloAlto`.
 */
export function calcularRectanguloSello(pagina: DimensionesPagina): RectanguloSello {
  // Reducir sello si la página es muy pequeña. En un carta portrait
  // (612×792), el sello ocupa 24% del ancho — bien.
  const anchoDisponible = pagina.ancho - 2 * SELLO_MARGEN_PT;
  const altoDisponible  = pagina.alto  - 2 * SELLO_MARGEN_PT;

  const ancho = Math.min(SELLO_ANCHO_PT, Math.max(0, anchoDisponible));
  const alto  = Math.min(SELLO_ALTO_PT,  Math.max(0, altoDisponible));

  const x = SELLO_MARGEN_PT;
  const y = pagina.alto - SELLO_MARGEN_PT - alto;

  return { x, y, ancho, alto };
}

/**
 * Guarda de seguridad: verifica que el rectángulo del sello está
 * completamente contenido dentro de la página. Retorna true si es
 * seguro dibujarlo. Usado por tests y por el generador para abortar
 * si algo va mal.
 */
export function selloCabeEnPagina(
  rect: RectanguloSello,
  pagina: DimensionesPagina,
): boolean {
  if (rect.ancho <= 0 || rect.alto <= 0) return false;
  if (rect.x < 0 || rect.y < 0) return false;
  if (rect.x + rect.ancho > pagina.ancho) return false;
  if (rect.y + rect.alto  > pagina.alto)  return false;
  return true;
}
