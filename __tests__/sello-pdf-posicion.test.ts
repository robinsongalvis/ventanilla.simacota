import { describe, expect, it } from 'vitest';
import {
  calcularRectanguloSello,
  encajarEnCaja,
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

/* ══════════════════════════════════════════════════════════════
   encajarEnCaja — la imagen NUNCA se deforma (1-sep-2026).

   El defecto que la exige: el sello dibujaba el lockup institucional (4:1)
   en un cuadro fijo de 26×26 — `width: caja, height: caja` — y salía la
   mancha que el propietario rechazó en la muestra. La mutación realista es
   justamente volver a llenar la caja.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA: que la proporción de la
   imagen sobreviva al encaje, que el resultado quepa en la caja, y que
   `ampliar` gobierne el tope de escala. NO mira: dónde se dibuja (eso es del
   llamador) ni la calidad del PNG.
══════════════════════════════════════════════════════════════ */
describe('encajarEnCaja — sin deformar', () => {
  it('el lockup 4:1 en caja cuadrada conserva su proporción (no se aplasta)', () => {
    const r = encajarEnCaja({ ancho: 1574, alto: 382 }, { ancho: 24, alto: 24 });
    expect(r.ancho / r.alto).toBeCloseTo(1574 / 382, 6);
    expect(r.ancho).toBeLessThanOrEqual(24);
    expect(r.alto).toBeLessThanOrEqual(24);
  });

  it('el escudo casi cuadrado llena el cuadro del sello a lo alto', () => {
    const r = encajarEnCaja({ ancho: 278, alto: 345 }, { ancho: 24, alto: 24 }, { ampliar: true });
    expect(r.alto).toBeCloseTo(24, 6);
    expect(r.ancho / r.alto).toBeCloseTo(278 / 345, 6);
  });

  it('sin `ampliar`, una imagen pequeña se queda en su tamaño natural', () => {
    // La foto del ciudadano vuelta página: ampliarla sería inventar píxeles.
    const r = encajarEnCaja({ ancho: 10, alto: 10 }, { ancho: 100, alto: 100 });
    expect(r).toEqual({ ancho: 10, alto: 10 });
  });

  it('con `ampliar`, la misma imagen crece hasta la caja — sin pasarse', () => {
    const r = encajarEnCaja({ ancho: 10, alto: 10 }, { ancho: 100, alto: 100 }, { ampliar: true });
    expect(r).toEqual({ ancho: 100, alto: 100 });
  });
});
