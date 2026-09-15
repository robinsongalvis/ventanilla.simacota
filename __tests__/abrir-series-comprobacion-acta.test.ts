import { describe, expect, it } from 'vitest';
// @ts-expect-error — script de operación en .mjs, sin tipos
import { verificarEsperados } from '@/scripts/operacion/abrir-series.mjs';

/* ══════════════════════════════════════════════════════════════
   NO SE ESCRIBE SI NO COINCIDE CON EL ACTA.

   Lo pidió el propietario el 15-sep-2026, antes de abrir en producción: «que el
   procedimiento obligatoriamente haga el dry-run y muestre los primeros
   números. No ejecutes si el resultado no coincide exactamente con el acta y
   con el libro oficial».

   EL DEFECTO QUE CIERRA. El dry-run era el MODO POR DEFECTO, que no es lo mismo
   que una precondición: `CONFIRMO_APERTURA=SI` se podía escribir de primeras y
   el script abría sin que nadie hubiera mirado un número. Y abrir una serie en
   el número equivocado no se deshace — el siguiente trámite se lleva el número
   y queda notificado.

   ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────

   Esto MIRA: que lo que el script abriría coincida, serie por serie, con lo que
   el acta declara; y que sobrar o faltar una serie también aborte.

   Esto NO MIRA —y ningún código puede—: que el libro DE PAPEL haya avanzado sin
   que el sistema lo sepa. Para eso está el dry-run impreso y el contraste
   humano contra el libro.
══════════════════════════════════════════════════════════════ */

const planDe = (pares: [string, number][]) =>
  pares.map(([serie, primerNumero]) => ({ serie, d: { nuevoUltimo: primerNumero - 1 } }));

describe('la comprobación contra el acta', () => {
  it('pasa cuando cada serie abre en el número que el acta dice', () => {
    const plan = planDe([['expedientes', 26], ['actos-lsr', 14]]);
    expect(verificarEsperados(plan, { expedientes: 26, 'actos-lsr': 14 })).toEqual([]);
  });

  it('aborta si el libro avanzó: la configuración abriría en otro número', () => {
    /* El caso real que esto previene: entre que Planeación confirma y alguien
       ejecuta, se radica a mano y el punto de apertura queda viejo. */
    const plan = planDe([['expedientes', 31]]);
    const problemas = verificarEsperados(plan, { expedientes: 26 });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/acta dice primer número 26/);
    expect(problemas[0]).toMatch(/abriría en 31/);
  });

  it('aborta si aparece una serie que el acta no contempla', () => {
    /* Alguien dejó un punto de apertura de más en `configuracion/series` y
       nadie lo declaró: se abriría una serie sin acta que la respalde. */
    const plan = planDe([['expedientes', 26], ['actos-lc', 9]]);
    const problemas = verificarEsperados(plan, { expedientes: 26 });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/'actos-lc' se abriría en 9 y el acta no la declara/);
  });

  it('aborta si el acta declara una serie que esta corrida no abriría', () => {
    /* Al revés: el acta cuenta con abrir `actos-lsr` y la configuración no la
       trae. Callarlo dejaría media apertura hecha, creyendo que fue entera. */
    const problemas = verificarEsperados(planDe([['expedientes', 26]]), { expedientes: 26, 'actos-lsr': 14 });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/declara 'actos-lsr' con primer número 14/);
  });

  it('un número de menos también aborta — no solo uno de más', () => {
    expect(verificarEsperados(planDe([['expedientes', 25]]), { expedientes: 26 })).toHaveLength(1);
  });

  it('cada problema explica qué hacer, no solo que algo falla', () => {
    const problemas = verificarEsperados(
      planDe([['expedientes', 31], ['actos-lc', 9]]),
      { expedientes: 26, 'actos-lsr': 14 },
    );
    expect(problemas).toHaveLength(3);
    for (const p of problemas) {
      expect(p.length, 'un mensaje demasiado corto para decidir nada').toBeGreaterThan(60);
    }
  });

  it('los valores del acta del 15-sep-2026 son los que pasan', () => {
    /* Fija los números confirmados por la Secretaría de Planeación. Si alguien
       los cambia sin tocar el acta, esta prueba lo dice. */
    const plan = planDe([['expedientes', 26], ['actos-lsr', 14]]);
    expect(verificarEsperados(plan, { expedientes: 26, 'actos-lsr': 14 })).toEqual([]);
    expect(verificarEsperados(plan, { expedientes: 27, 'actos-lsr': 14 })).toHaveLength(1);
    expect(verificarEsperados(plan, { expedientes: 26, 'actos-lsr': 15 })).toHaveLength(1);
  });
});
