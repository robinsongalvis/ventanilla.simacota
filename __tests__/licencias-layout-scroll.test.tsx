/**
 * Regresión del bug de scroll del módulo Licencias (reportado en
 * producción el 11-ago-2026): la página bajaba más allá del contenido, el
 * sidebar de altura fija se quedaba arriba y debajo aparecía una franja en
 * blanco.
 *
 * CAUSA: el contenedor flex-column que envuelve `<main>` no declaraba
 * `min-h-0`. Un hijo flex con `flex-1` tiene `min-height: auto` implícito,
 * así que NO se contrae por debajo de su contenido: en una pantalla larga
 * (el Detalle con el checklist completo) `<main>` crecía, empujaba el
 * documento más allá de `h-screen` y el scroll se iba al `<body>` en vez
 * de quedarse dentro de `<main>`.
 *
 * Este test asevera la CLASE en el marcado, no el layout renderizado: jsdom
 * no calcula altura de flexbox (todo mide 0), así que un test de geometría
 * pasaría siempre y no protegería nada. El comportamiento real se verificó
 * en el navegador — con el defecto, el documento medía 4023px y `<main>`
 * no tenía scroll interno (scrollHeight === clientHeight); con `min-h-0`,
 * `<main>` recupera su scroll y el documento deja de desbordar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LAYOUT = readFileSync(join(process.cwd(), 'app/interno/licencias/layout.tsx'), 'utf8');

describe('layout de Licencias — cadena de scroll (regresión 11-ago-2026)', () => {
  it('el contenedor flex-column que envuelve <main> declara min-h-0', () => {
    // Se localiza el div por sus otras clases estructurales y se exige que
    // `min-h-0` esté presente en el MISMO className.
    const match = LAYOUT.match(/className="([^"]*flex-1 flex flex-col[^"]*)"/);
    expect(match, 'no se encontró el contenedor flex-column del layout').not.toBeNull();
    expect(match![1]).toContain('min-h-0');
  });

  it('<main> conserva su scroll interno (overflow-y-auto) — es el que debe desplazarse, no el body', () => {
    expect(LAYOUT).toMatch(/<main[^>]*overflow-y-auto/);
  });

  it('el contenedor raíz sigue acotado a la altura del viewport', () => {
    expect(LAYOUT).toMatch(/className="h-screen[^"]*overflow-hidden/);
  });
});
