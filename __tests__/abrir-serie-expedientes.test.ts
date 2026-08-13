import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// Script `.mjs` sin tipos: se importan sus funciones PURAS, que es lo que
// decide el número escrito en el contador legal.
import { consecutivosDelLibro, diasDesde, planificarApertura } from '@/scripts/migracion/abrir-serie-expedientes.mjs';

/* ══════════════════════════════════════════════════════════════
   Apertura de la serie legal de expedientes (ADR-0031).

   Lo que se prueba aquí decide QUÉ NÚMERO se escribe en un contador legal
   de producción. Si sale bajo, la primera emisión real duplica un número
   del libro de papel — dos actos administrativos con el mismo número
   (Acuerdo AGN 060/2001 art. 5). Si sale alto, se saltan números de la
   serie, que también es un defecto archivístico.

   El caso que gobierna el diseño: SEIS registros del libro quedaron en
   CUARENTENA por fecha inválida y NUNCA llegaron a Firestore, pero sus
   números están consumidos en papel. Un cálculo que mire solo Firestore
   da un máximo MENOR que el real.
══════════════════════════════════════════════════════════════ */

/**
 * El LIBRO versionado y sin PII. Deliberadamente NO se usa
 * `plan-importacion.generado.json`: está en `.gitignore` (`*.generado.json`),
 * así que esta suite fallaría en CI y en cualquier clon que no sea el del
 * propietario — y con ella la red de seguridad del procedimiento de apertura.
 */
const LIBRO_REAL = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts/migracion/datos/consecutivo-licencias-snapshot.sanitizado.json'), 'utf8'),
);

/** Forma PLAN (derivado): expedientes importados + los que quedaron en cuarentena. */
function planDe(expedientes: string[], cuarentena: string[] = []) {
  return {
    expedientes: expedientes.map((numero, i) => ({ id: `e${i}`, numeroExpediente: { numero } })),
    cuarentena: cuarentena.map((radicado) => ({ radicado })),
  };
}

/** Forma SNAPSHOT (el libro tal cual), que es el insumo por defecto del script. */
function libroDe(radicados: string[]) {
  return { registros: radicados.map((radicado, i) => ({ hoja: '2026', fila: i + 2, radicado })) };
}

describe('consecutivosDelLibro — el libro manda, no Firestore', () => {
  it('cuenta también los de CUARENTENA: están en papel aunque no en Firestore', () => {
    const plan = planDe(['68745-0-26-0001', '68745-0-26-0004'], ['68745-0-26-0019']);
    expect([...consecutivosDelLibro(plan, 2026)].sort((a: number, b: number) => a - b)).toEqual([1, 4, 19]);
  });

  it('ignora los de OTROS años (el contador y el AA del número van por año)', () => {
    const plan = planDe(['68745-0-25-0050', '68745-0-26-0007']);
    expect([...consecutivosDelLibro(plan, 2026)]).toEqual([7]);
    expect([...consecutivosDelLibro(plan, 2025)]).toEqual([50]);
  });

  it('ignora números malformados en vez de romperse o inventar un consecutivo', () => {
    const plan = planDe(['DEMO-26-a1b2c3d4', '', '68745-0-26-0003'], ['no-es-un-numero']);
    expect([...consecutivosDelLibro(plan, 2026)]).toEqual([3]);
  });

  it('un año sin números en el libro devuelve conjunto vacío', () => {
    expect(consecutivosDelLibro(planDe(['68745-0-26-0001']), 2027).size).toBe(0);
  });
});

describe('planificarApertura — con qué valor se abre la serie', () => {
  it('abre en el MÁXIMO del libro: la próxima emisión es el siguiente libre', () => {
    const p = planificarApertura(planDe(['68745-0-26-0001', '68745-0-26-0019']), 2026);
    expect(p.ultimo).toBe(19);
  });

  it('LA PRUEBA QUE IMPORTA: sin contar la cuarentena el máximo saldría bajo y se duplicaría', () => {
    const conCuarentena = planificarApertura(planDe(['68745-0-26-0001'], ['68745-0-26-0019']), 2026);
    const sinCuarentena = planificarApertura(planDe(['68745-0-26-0001']), 2026);
    expect(conCuarentena.ultimo).toBe(19);
    expect(sinCuarentena.ultimo).toBe(1); // ← lo que habría pasado mirando solo Firestore
  });

  it('reporta los huecos, que NO son números libres sino registros en cuarentena', () => {
    const p = planificarApertura(planDe(['68745-0-26-0001', '68745-0-26-0004']), 2026);
    expect(p.huecos).toEqual([2, 3]);
  });

  it('un año sin histórico se abre en 0 → la primera emisión es la 0001', () => {
    const p = planificarApertura(planDe(['68745-0-26-0001']), 2027);
    expect(p).toMatchObject({ hayLibro: false, ultimo: 0, huecos: [] });
  });
});

describe('el script acepta las DOS formas del insumo y coinciden', () => {
  it('snapshot y plan dan el mismo máximo para el mismo libro', () => {
    const desdeSnapshot = planificarApertura(libroDe(['68745-0-26-0001', '68745-0-26-0019']), 2026);
    const desdePlan = planificarApertura(planDe(['68745-0-26-0001'], ['68745-0-26-0019']), 2026);
    expect(desdeSnapshot.ultimo).toBe(desdePlan.ultimo);
  });
});

describe('diasDesde — antigüedad de la confirmación con Planeación', () => {
  it('cuenta días civiles entre dos fechas ISO', () => {
    expect(diasDesde('2026-08-06', '2026-08-13')).toBe(7);
    expect(diasDesde('2026-08-13', '2026-08-13')).toBe(0);
  });

  it('negativo si la confirmación está en el futuro, null si es inválida', () => {
    expect(diasDesde('2026-08-20', '2026-08-13')).toBe(-7);
    expect(diasDesde('no-es-fecha', '2026-08-13')).toBeNull();
  });
});

describe('contra el LIBRO REAL — los valores que se van a sembrar', () => {
  // Si estos números cambian, el procedimiento de apertura queda obsoleto y
  // hay que rehacerlo: por eso se fijan aquí.
  it.each([
    [2022, 49, [] as number[]],
    [2023, 44, []],
    [2024, 39, []],
    [2025, 50, []],
    [2026, 19, []],
  ])('año %i → abrir en %i, sin huecos', (anio, ultimo, huecos) => {
    const p = planificarApertura(LIBRO_REAL, anio);
    expect(p.ultimo).toBe(ultimo);
    expect(p.huecos).toEqual(huecos);
  });

  it('el libro es CONTIGUO 1..máx en los cinco años, una vez contada la cuarentena', () => {
    // Es la validación cruzada del método: los 6 "huecos" que se ven mirando
    // solo Firestore son exactamente los 6 registros en cuarentena.
    for (const anio of [2022, 2023, 2024, 2025, 2026]) {
      const p = planificarApertura(LIBRO_REAL, anio);
      expect(p.ocupados).toBe(p.ultimo);
    }
  });

  it('2026 es el único año con riesgo vivo: el año en curso con histórico', () => {
    expect(planificarApertura(LIBRO_REAL, 2026).ultimo).toBe(19);
    expect(planificarApertura(LIBRO_REAL, 2027).hayLibro).toBe(false);
  });
});
