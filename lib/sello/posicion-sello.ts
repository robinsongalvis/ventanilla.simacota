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

/**
 * SUELO DE LEGIBILIDAD.
 *
 * `calcularRectanguloSello` ENCOGE el sello para que quepa, así que
 * `selloCabeEnPagina` solo dice que no en páginas de menos de 24 pt (0,85 cm) —
 * un caso que no ocurre. El problema real es el contrario: en una página
 * pequeña el sello cabe **encogido hasta ser ilegible**, y eso se reportaba
 * como estampado con éxito. Un sello que nadie puede leer no es un sello, y
 * decir que se puso es afirmar algo que el papel no sostiene.
 *
 * Las cotas salen del contenido, no de un número redondo:
 *  · ALTO 52 pt — las cuatro líneas del sello se dibujan hasta 32 pt por debajo
 *    del borde superior interno, más el padding de 6 arriba y la línea de pie a
 *    6 del borde inferior: por debajo de 52 las líneas se pisan.
 *  · ANCHO 120 pt — el número de radicado va en Courier 8,5 (avance 0,6 em =
 *    5,1 pt por carácter). Un `1-110-202608-00000123` son 21 caracteres ≈ 107 pt,
 *    más 12 de padding. Por debajo de eso, el dato que importa sale cortado.
 */
export const SELLO_MIN_ANCHO_PT = 120;
export const SELLO_MIN_ALTO_PT = 52;

/**
 * ¿El sello dibujado en este rectángulo se puede LEER?
 *
 * Distinta de `selloCabeEnPagina`, que solo comprueba que no se salga de la
 * página. Aquí se comprueba que valga para lo que existe.
 */
export function selloEsLegible(rect: RectanguloSello): boolean {
  return rect.ancho >= SELLO_MIN_ANCHO_PT && rect.alto >= SELLO_MIN_ALTO_PT;
}
