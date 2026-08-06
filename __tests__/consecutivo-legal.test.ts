/**
 * Bloque 2 (fix H3) · Checkpoint 1 — pruebas del helper transaccional.
 * Cobertura rama por rama (revisión cruzada firestore: el helper es punto único
 * de fallo compartido por 5 rutas → exige cobertura exhaustiva).
 *
 * Dobles de `tx`/`db` en memoria — NO toca Firebase (ni real ni emulador).
 */
import { describe, it, expect, vi } from 'vitest';
import type { Transaction, Firestore } from 'firebase-admin/firestore';
import {
  leerConsecutivosLegales,
  confirmarConsecutivosLegales,
  verificarAvanceCounter,
  type ConsecutivoPendiente,
} from '@/lib/server/consecutivo-legal';

/** Doble de Firestore: `doc(path)` devuelve una ref con su path como id. */
function fakeDb(): Firestore {
  return {
    doc: (path: string) => ({ path, id: path.split('/').pop() }),
  } as unknown as Firestore;
}

/**
 * Doble de Transaction: `get` sirve valores de contador desde un mapa por path;
 * `set` registra las escrituras en orden. Registra si hubo algún `set` antes
 * del último `get` (para verificar lecturas-antes-de-escrituras).
 */
function fakeTx(contadores: Record<string, number | undefined>) {
  const escrituras: { path: string; data: Record<string, unknown> }[] = [];
  let huboSetAntesDeGet = false;
  const tx = {
    get: vi.fn(async (ref: { path: string }) => {
      if (escrituras.length > 0) huboSetAntesDeGet = true;
      const ultimo = contadores[ref.path];
      return { data: () => (ultimo === undefined ? undefined : { ultimo }) };
    }),
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      escrituras.push({ path: ref.path, data });
    }),
  };
  return { tx: tx as unknown as Transaction, escrituras, get huboSetAntesDeGet() { return huboSetAntesDeGet; } };
}

const fmtRadicado = (n: number, f: Date) => `1-110-${f.getFullYear()}-${String(n).padStart(8, '0')}`;
const fmtSalida = (n: number, f: Date) => `2-110-${f.getFullYear()}-${String(n).padStart(8, '0')}`;
const FECHA = new Date('2026-07-13T12:00:00Z');

describe('consecutivo-legal — leerConsecutivosLegales', () => {
  it('siguiente = ultimo + 1 cuando el contador existe', async () => {
    const { tx } = fakeTx({ 'counters/radicados-2026': 41 });
    const [p] = await leerConsecutivosLegales(tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    expect(p.consecutivo).toBe(42);
    expect(p.documentoId).toBe('1-110-2026-00000042');
    expect(p.serie).toBe('radicados');
  });

  it('empieza en 1 cuando el contador no existe (data undefined)', async () => {
    const { tx } = fakeTx({});
    const [p] = await leerConsecutivosLegales(tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    expect(p.consecutivo).toBe(1);
    expect(p.documentoId).toBe('1-110-2026-00000001');
  });

  it('multi-serie: lee las N series y NO escribe nada durante la lectura', async () => {
    const { tx, escrituras } = fakeTx({
      'counters/radicados-2026': 10,
      'counters/salidas-2026': 5,
    });
    const pend = await leerConsecutivosLegales(tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
      { serie: 'salidas', formatear: fmtSalida },
    ]);
    expect(pend.map((p) => p.consecutivo)).toEqual([11, 6]);
    expect(pend[1].documentoId).toBe('2-110-2026-00000006');
    expect(escrituras).toHaveLength(0); // fase lectura no confirma nada
  });

  it('usa el path de contador por serie y año correctos', async () => {
    const { tx } = fakeTx({ 'counters/planillas-2026': 0 });
    const [p] = await leerConsecutivosLegales(tx, fakeDb(), FECHA, [
      { serie: 'planillas', formatear: (n) => `PL-${n}` },
    ]);
    expect((p.ref as unknown as { path: string }).path).toBe('counters/planillas-2026');
    expect(p.consecutivo).toBe(1);
  });
});

describe('consecutivo-legal — confirmarConsecutivosLegales', () => {
  it('escribe cada contador con {ultimo, anio, actualizadoEn} y merge, DESPUÉS de leer', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': 41, 'counters/salidas-2026': 5 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
      { serie: 'salidas', formatear: fmtSalida },
    ]);
    confirmarConsecutivosLegales(doble.tx, FECHA, pend);

    expect(doble.escrituras).toHaveLength(2);
    expect(doble.escrituras[0]).toEqual({
      path: 'counters/radicados-2026',
      data: { ultimo: 42, anio: 2026, actualizadoEn: FECHA.toISOString() },
    });
    expect(doble.huboSetAntesDeGet).toBe(false); // lecturas-antes-de-escrituras
  });

  it('lanza si los pendientes NO provienen de leer (arreglo construido a mano)', () => {
    const { tx } = fakeTx({});
    const falsos: ConsecutivoPendiente[] = [
      { serie: 'radicados', ref: { path: 'counters/radicados-2026' } as never, ultimoActual: 998, consecutivo: 999, documentoId: 'x' },
    ];
    expect(() => confirmarConsecutivosLegales(tx, FECHA, falsos)).toThrow(
      /leerConsecutivosLegales sobre la misma transacción/,
    );
  });

  it('lanza si los pendientes provienen de OTRA transacción', async () => {
    const a = fakeTx({ 'counters/radicados-2026': 0 });
    const b = fakeTx({ 'counters/radicados-2026': 0 });
    const pendDeA = await leerConsecutivosLegales(a.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    // Confirmar en la tx B con pendientes leídos en la tx A → debe lanzar.
    expect(() => confirmarConsecutivosLegales(b.tx, FECHA, pendDeA)).toThrow();
    // Y confirmar en A con sus propios pendientes → no lanza.
    expect(() => confirmarConsecutivosLegales(a.tx, FECHA, pendDeA)).not.toThrow();
  });

  // ── Cableado del guard D9 en el flujo estándar (ADR-0026 §A2 #7) ──────────
  it('cablea el guard D9: un `consecutivo` manipulado a un valor <= al leído hace throw ANTES del set', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': 41 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    // Simula un bug/manipulación que baja el propuesto por debajo del leído (41).
    pend[0].consecutivo = 40;
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).toThrow(
      /no puede retroceder ni estancarse/,
    );
    expect(doble.escrituras).toHaveLength(0); // el guard corre ANTES del tx.set
  });

  it('cablea el guard D9: si una serie del lote es inválida, NO escribe ninguna (validar-todo-antes)', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': 10, 'counters/salidas-2026': 5 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
      { serie: 'salidas', formatear: fmtSalida },
    ]);
    // La segunda serie se corrompe a un valor no monótono; la primera es válida.
    pend[1].consecutivo = 5;
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).toThrow(
      /no puede retroceder ni estancarse/,
    );
    expect(doble.escrituras).toHaveLength(0); // ni la serie válida se escribió
  });

  it('cablea el guard D9: un flujo REAL normal (ultimo+1) pasa el guard y escribe', async () => {
    const doble = fakeTx({ 'counters/expedientes-2026': 0 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'expedientes', formatear: (n, f) => `EXP-${f.getFullYear()}-${n}` },
    ]);
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).not.toThrow();
    expect(doble.escrituras).toHaveLength(1);
    expect(doble.escrituras[0].data).toMatchObject({ ultimo: 1 });
  });
});

describe('consecutivo-legal — verificarAvanceCounter (guard monotónico D9, ADR-0026)', () => {
  it('acepta un avance REAL estrictamente mayor que el actual', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: 41, ultimoPropuesto: 42, origen: 'REAL' }),
    ).not.toThrow();
  });

  it('acepta arrancar desde 0 (contador nuevo) con origen REAL', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'expedientes', ultimoActual: 0, ultimoPropuesto: 1, origen: 'REAL' }),
    ).not.toThrow();
  });

  it('rechaza un propuesto igual al actual (estancamiento)', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: 10, ultimoPropuesto: 10, origen: 'REAL' }),
    ).toThrow(/no puede retroceder ni estancarse/);
  });

  it('rechaza un propuesto MENOR al actual (retroceso)', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: 100, ultimoPropuesto: 5, origen: 'REAL' }),
    ).toThrow(/no puede retroceder ni estancarse/);
  });

  it('rechaza cualquier avance de origen RECONSTRUIDO, incluso si es monótono', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'expedientes', ultimoActual: 5, ultimoPropuesto: 6, origen: 'RECONSTRUIDO' }),
    ).toThrow(/RECONSTRUIDO/);
  });

  it('rechaza ultimoActual no entero o negativo', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: -1, ultimoPropuesto: 1, origen: 'REAL' }),
    ).toThrow(/ultimoActual/);
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: 1.5, ultimoPropuesto: 2, origen: 'REAL' }),
    ).toThrow(/ultimoActual/);
  });

  it('rechaza ultimoPropuesto no entero o negativo', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: 1, ultimoPropuesto: -2, origen: 'REAL' }),
    ).toThrow(/ultimoPropuesto/);
    expect(() =>
      verificarAvanceCounter({ serie: 'radicados', ultimoActual: 1, ultimoPropuesto: 2.7, origen: 'REAL' }),
    ).toThrow(/ultimoPropuesto/);
  });

  it('la serie nueva "expedientes" es aceptada por el tipo sin romper el guard (no-breaking)', () => {
    expect(() =>
      verificarAvanceCounter({ serie: 'expedientes', ultimoActual: 0, ultimoPropuesto: 1, origen: 'REAL' }),
    ).not.toThrow();
  });
});
