import { describe, expect, it } from 'vitest';
import {
  calcularRectanguloSello,
  selloCabeEnPagina,
  SELLO_ANCHO_PT,
  SELLO_ALTO_PT,
  SELLO_MARGEN_PT,
  calcularRectanguloSelloEnEsquina,
} from '@/lib/sello/posicion-sello';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 3 — coordenadas del sello.

   Tests puros: verifican que el sello queda en la esquina superior
   izquierda para todos los tamaños de página estándar, siempre dentro
   de la página, y con las mismas dimensiones nominales (150×70 pt).
══════════════════════════════════════════════════════════════ */

// Tamaños en puntos PDF (1 pt = 1/72 inch).
const CARTA_PORTRAIT   = { ancho: 612, alto: 792 };
const A4_PORTRAIT      = { ancho: 595, alto: 842 };
const OFICIO_PORTRAIT  = { ancho: 612, alto: 1008 };
const CARTA_LANDSCAPE  = { ancho: 792, alto: 612 };
const HALF_LETTER      = { ancho: 396, alto: 612 };

describe('Sprint Op 3 — calcularRectanguloSello', () => {
  /* 1 */
  it('carta portrait: sello en esquina superior izquierda con margen 12pt', () => {
    const rect = calcularRectanguloSello(CARTA_PORTRAIT);
    expect(rect.x).toBe(SELLO_MARGEN_PT);
    expect(rect.ancho).toBe(SELLO_ANCHO_PT);
    expect(rect.alto).toBe(SELLO_ALTO_PT);
    // El sello está anclado ARRIBA: y + alto === pageAlto - margen.
    expect(rect.y + rect.alto).toBe(CARTA_PORTRAIT.alto - SELLO_MARGEN_PT);
  });

  /* 2 */
  it('A4 portrait: mismo layout que carta, dimensiones nominales conservadas', () => {
    const rect = calcularRectanguloSello(A4_PORTRAIT);
    expect(rect.x).toBe(SELLO_MARGEN_PT);
    expect(rect.ancho).toBe(SELLO_ANCHO_PT);
    expect(rect.alto).toBe(SELLO_ALTO_PT);
    expect(rect.y + rect.alto).toBe(A4_PORTRAIT.alto - SELLO_MARGEN_PT);
  });

  /* 3 */
  it('oficio: sello sigue en esquina superior izquierda', () => {
    const rect = calcularRectanguloSello(OFICIO_PORTRAIT);
    expect(rect.x).toBe(SELLO_MARGEN_PT);
    expect(rect.y + rect.alto).toBe(OFICIO_PORTRAIT.alto - SELLO_MARGEN_PT);
  });

  /* 4 */
  it('landscape: sello sigue en esquina superior izquierda de la vista horizontal', () => {
    const rect = calcularRectanguloSello(CARTA_LANDSCAPE);
    expect(rect.x).toBe(SELLO_MARGEN_PT);
    expect(rect.ancho).toBe(SELLO_ANCHO_PT);
    expect(rect.alto).toBe(SELLO_ALTO_PT);
    expect(rect.y + rect.alto).toBe(CARTA_LANDSCAPE.alto - SELLO_MARGEN_PT);
    // Nunca cruza el borde derecho.
    expect(rect.x + rect.ancho).toBeLessThanOrEqual(CARTA_LANDSCAPE.ancho);
  });

  /* 5 */
  it('half-letter (compacto): sello cabe dentro de la página sin cruzar bordes', () => {
    const rect = calcularRectanguloSello(HALF_LETTER);
    expect(selloCabeEnPagina(rect, HALF_LETTER)).toBe(true);
    expect(rect.x + rect.ancho).toBeLessThanOrEqual(HALF_LETTER.ancho);
    expect(rect.y).toBeGreaterThanOrEqual(0);
  });
});


/* ══════════════════════════════════════════════════════════════
   LAS CUATRO ESQUINAS (1-sep-2026) — el propietario descongeló la posición
   para el paquete sellado: la marca la ubica quien descarga, con el patrón
   del «Sello de recibido» de ventanilla. SUP_IZQ delega en la función nueva,
   así que los casos históricos de arriba también la vigilan.
══════════════════════════════════════════════════════════════ */
describe('calcularRectanguloSelloEnEsquina — las cuatro esquinas en carta', () => {
  const CARTA = { ancho: 612, alto: 792 };

  it.each([
    ['SUP_IZQ', 12, 792 - 12 - 70],
    ['SUP_DER', 612 - 12 - 150, 792 - 12 - 70],
    ['INF_IZQ', 12, 12],
    ['INF_DER', 612 - 12 - 150, 12],
  ] as const)('%s → x=%d, y=%d', (esquina, x, y) => {
    const r = calcularRectanguloSelloEnEsquina(CARTA, esquina);
    expect(r.x, `x de ${esquina}`).toBe(x);
    expect(r.y, `y de ${esquina}`).toBe(y);
    expect(r.ancho).toBe(150);
    expect(r.alto).toBe(70);
  });

  it('las cuatro producen rectángulos DISTINTOS — si dos coinciden, el selector miente', () => {
    const rects = (['SUP_IZQ', 'SUP_DER', 'INF_IZQ', 'INF_DER'] as const)
      .map((e) => calcularRectanguloSelloEnEsquina(CARTA, e))
      .map((r) => `${r.x},${r.y}`);
    expect(new Set(rects).size).toBe(4);
  });
});
