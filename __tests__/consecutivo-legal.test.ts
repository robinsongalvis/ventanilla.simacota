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
      {
        serie: 'radicados',
        ref: { path: 'counters/radicados-2026' } as never,
        consecutivo: 999,
        documentoId: 'x',
        ultimoActual: 998,
        origen: 'REAL',
      },
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
});

describe('consecutivo-legal — guard D9 cableado en confirmarConsecutivosLegales (deuda #7 §A2, 6-ago-2026)', () => {
  it('counter corrupto (ultimo=3.5, no entero) → confirmar lanza el guard y NO escribe ningún tx.set', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': 3.5 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    expect(pend[0].ultimoActual).toBe(3.5);
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).toThrow(/ultimoActual/);
    expect(doble.escrituras).toHaveLength(0);
  });

  it('counter corrupto (ultimo=-2, negativo) → confirmar lanza el guard y NO escribe ningún tx.set', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': -2 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    expect(pend[0].ultimoActual).toBe(-2);
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).toThrow(/ultimoActual/);
    expect(doble.escrituras).toHaveLength(0);
  });

  it('SolicitudSerie con origen RECONSTRUIDO → confirmar lanza (invariante 2) y NO escribe', async () => {
    const doble = fakeTx({ 'counters/expedientes-2026': 5 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'expedientes', formatear: (n) => `EXP-${n}`, origen: 'RECONSTRUIDO' },
    ]);
    expect(pend[0].origen).toBe('RECONSTRUIDO');
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).toThrow(/RECONSTRUIDO/);
    expect(doble.escrituras).toHaveLength(0);
  });

  it('lote multi-serie: si UNA falla el guard, NINGUNA se escribe (fail-closed sobre el lote completo)', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': 10, 'counters/expedientes-2026': 5 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado }, // este solo sería válido
      { serie: 'expedientes', formatear: (n) => `EXP-${n}`, origen: 'RECONSTRUIDO' }, // este lo bloquea
    ]);
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).toThrow(/RECONSTRUIDO/);
    expect(doble.escrituras).toHaveLength(0); // ni siquiera 'radicados' (válido) quedó escrito
  });

  it('flujo normal REAL, counter sano → sigue confirmando y escribiendo ultimo correcto', async () => {
    const doble = fakeTx({ 'counters/radicados-2026': 41 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    expect(pend[0].ultimoActual).toBe(41);
    expect(pend[0].origen).toBe('REAL');
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).not.toThrow();
    expect(doble.escrituras).toEqual([
      { path: 'counters/radicados-2026', data: { ultimo: 42, anio: 2026, actualizadoEn: FECHA.toISOString() } },
    ]);
  });

  it('flujo normal REAL, counter inexistente (→0) → sigue confirmando y escribiendo ultimo=1', async () => {
    const doble = fakeTx({});
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'radicados', formatear: fmtRadicado },
    ]);
    expect(pend[0].ultimoActual).toBe(0);
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pend)).not.toThrow();
    expect(doble.escrituras).toEqual([
      { path: 'counters/radicados-2026', data: { ultimo: 1, anio: 2026, actualizadoEn: FECHA.toISOString() } },
    ]);
  });

  it('SolicitudSerie sin origen declarado → default REAL (los 5 call sites actuales no cambian)', async () => {
    const doble = fakeTx({ 'counters/salidas-2026': 3 });
    const pend = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      { serie: 'salidas', formatear: fmtSalida },
    ]);
    expect(pend[0].origen).toBe('REAL');
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
