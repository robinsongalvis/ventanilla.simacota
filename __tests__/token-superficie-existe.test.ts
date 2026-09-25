import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * NINGÚN COMPONENTE PINTA CON UN TOKEN QUE NO EXISTE.
 *
 * `var(--bg-surface-1)` se usaba en CUATRO componentes y NO ESTÁ DEFINIDO en
 * `app/globals.css` — los que hay son `--bg-surface` y `--bg-surface-2`. Un
 * token inexistente no falla: resuelve a transparente y el elemento se queda
 * SIN FONDO.
 *
 * Por eso nadie lo vio en tres meses: sobre un padre blanco, un cuadro sin
 * fondo se ve blanco. Se destapó el 29-ago-2026 al aclarar el velo de la
 * ventana de radicación — de golpe el expediente de detrás se veía A TRAVÉS del
 * cuadro del acto.
 *
 * ── ALCANCE (ADR-0033 §4.6-bis) ─────────────────────────────────────────
 * QUÉ MIRA: que todo `var(--bg-*)` y `var(--text-*)` usado en los componentes
 * de licencias esté declarado en `app/globals.css`.
 * QUÉ NO MIRA: si el color elegido es el correcto ni si contrasta — eso es
 * criterio de diseño, no existencia.
 */

const CSS = readFileSync('app/globals.css', 'utf8');
const DIR = 'app/interno/licencias/components';

const declarados = new Set(
  [...CSS.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]),
);

describe('los tokens de color que se usan están declarados', () => {
  it('globals.css declara al menos los de superficie y texto', () => {
    expect(declarados.has('--bg-surface')).toBe(true);
    expect(declarados.has('--bg-surface-2')).toBe(true);
  });

  it('`--bg-surface-1` NO existe: nadie puede volver a usarlo', () => {
    /* La afirmación que caza la reincidencia. Si algún día se declara de
       verdad, esta prueba lo dirá y se decide a conciencia. */
    expect(declarados.has('--bg-surface-1')).toBe(false);
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.tsx'))) {
      expect(readFileSync(`${DIR}/${f}`, 'utf8'), `${f} usa un token inexistente`)
        .not.toMatch(/var\(--bg-surface-1\)/);
    }
  });

  it('ningún componente de licencias usa un token de color sin declarar', () => {
    const huerfanos: string[] = [];
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.tsx'))) {
      const src = readFileSync(`${DIR}/${f}`, 'utf8');
      for (const m of src.matchAll(/var\((--(?:bg|text|color|shadow)-[a-z0-9-]+)\)/g)) {
        if (!declarados.has(m[1])) huerfanos.push(`${f} → ${m[1]}`);
      }
    }
    expect(huerfanos, `tokens sin declarar:\n  ${huerfanos.join('\n  ')}`).toEqual([]);
  });
});
