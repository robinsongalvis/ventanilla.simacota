/**
 * Pieza angular (P2.1) — Fase 3, R7 (anti-doble-submit).
 *
 * El endpoint nuevo (`app/api/radicacion/interna/route.ts`) NO es
 * idempotente: dos POST concurrentes producen dos radicados. El botón
 * "Registrar radicado" del footer de `DrawerNuevoRadicado`
 * (`app/interno/dashboard/page.tsx`) ya se deshabilitaba, ANTES de esta
 * fase, desde el instante del submit hasta la respuesta —
 * `disabled={!!progreso && progresoPct > 0 && progresoPct < 100}`,
 * gateado por `progresoPct`, que `handleSubmit` fija en `5` de forma
 * SÍNCRONA antes de invocar cualquiera de los dos caminos de radicación,
 * y solo repone a `0` en el `catch`. Como la bifurcación del kill-switch
 * (`radicarSegunFlag`) vive DENTRO de ese mismo bloque `try`, hereda la
 * protección sin código nuevo — para AMBOS caminos.
 *
 * Este test lockea esa relación de orden (candado ANTES de la
 * bifurcación, no después) por inspección de texto — mismo patrón que
 * `__tests__/dashboard-modo-amplio-radicados.test.ts` — porque
 * `DrawerNuevoRadicado` no se exporta y el dashboard es un God component
 * de 5000+ líneas sin arnés de render (auth/contexto/Firestore en vivo);
 * simular un doble clic real exigiría montarlo completo, lo que se
 * declara fuera de alcance de esta fase (ver informe de Fase 3).
 * El comportamiento de la bifurcación en sí (qué función se invoca según
 * el flag) SÍ se prueba con mocks reales en
 * `__tests__/radicar-segun-flag.test.ts`.
 */
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('app/interno/dashboard/page.tsx', 'utf8');

function indiceDeHandleSubmit(): number {
  const inicio = dashboard.indexOf('async function handleSubmit(');
  expect(inicio, 'no se encontró handleSubmit de DrawerNuevoRadicado').toBeGreaterThan(-1);
  return inicio;
}

describe('Dashboard — anti-doble-submit (R7) en radicación institucional', () => {
  it('el botón del footer se deshabilita mientras progresoPct está entre 0 y 100', () => {
    expect(dashboard).toContain('disabled={!!progreso && progresoPct > 0 && progresoPct < 100}');
  });

  it('el candado (setProgresoPct(5)) se arma ANTES de invocar la bifurcación del kill-switch', () => {
    const inicio = indiceDeHandleSubmit();
    const cierre = dashboard.indexOf('\n  }', inicio); // fin de handleSubmit
    const cuerpo = dashboard.slice(inicio, cierre === -1 ? undefined : cierre);

    const idxCandado = cuerpo.indexOf('setProgresoPct(5)');
    const idxBifurcacion = cuerpo.indexOf('radicarSegunFlag(');

    expect(idxCandado, 'setProgresoPct(5) no está dentro de handleSubmit').toBeGreaterThan(-1);
    expect(idxBifurcacion, 'radicarSegunFlag no se invoca dentro de handleSubmit').toBeGreaterThan(-1);
    expect(idxCandado).toBeLessThan(idxBifurcacion);
  });

  it('el candado se libera (setProgresoPct(0)) en el catch, para permitir reintentar tras un error', () => {
    const inicio = indiceDeHandleSubmit();
    const cierre = dashboard.indexOf('\n  }', inicio);
    const cuerpo = dashboard.slice(inicio, cierre === -1 ? undefined : cierre);

    expect(cuerpo).toContain('} catch (err) {');
    const idxCatch = cuerpo.indexOf('} catch (err) {');
    expect(cuerpo.indexOf('setProgresoPct(0)', idxCatch)).toBeGreaterThan(idxCatch);
  });
});
