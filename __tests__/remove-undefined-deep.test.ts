import { describe, expect, it } from 'vitest';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';

/* ══════════════════════════════════════════════════════════════
   Fix React #31 — removeUndefinedDeep no debe convertir instancias
   de clase (FieldValue.delete(), Timestamp, Date…) en `{}`.

   Reproduce el bug real: el endpoint de asignación pasaba
   `areaResponsable: FieldValue.delete()` por este limpiador; el
   sentinel se clonaba como objeto vacío y `{}` quedaba ESCRITO en
   Firestore — y el panel revienta al dibujar un objeto como texto.
══════════════════════════════════════════════════════════════ */

/** Simula un sentinel del Admin SDK: instancia de clase sin props enumerables. */
class SentinelSimulado {
  private readonly marca = 'delete';
  metodo(): string { return this.marca; }
}

describe('removeUndefinedDeep', () => {
  /* 1 · el comportamiento original se conserva */
  it('quita undefined en profundidad de objetos planos', () => {
    const limpio = removeUndefinedDeep({
      a: 1,
      b: undefined,
      c: { d: undefined, e: 'ok', f: [1, undefined, { g: undefined, h: 2 }] },
    });
    expect(limpio).toEqual({ a: 1, c: { e: 'ok', f: [1, undefined, { h: 2 }] } });
  });

  /* 2 · EL BUG: los sentinels de clase pasan intactos, no como {} */
  it('preserva instancias de clase en vez de clonarlas como objeto vacío', () => {
    const sentinel = new SentinelSimulado();
    const limpio = removeUndefinedDeep({
      'clasificacion.areaResponsable': sentinel,
      estadoActual: 'ASIGNADO',
    });
    expect(limpio['clasificacion.areaResponsable']).toBe(sentinel);
    expect(limpio['clasificacion.areaResponsable']).not.toEqual({});
  });

  /* 3 · Date también sobrevive (misma familia del problema) */
  it('preserva instancias de Date anidadas', () => {
    const fecha = new Date('2026-07-06T12:00:00Z');
    const limpio = removeUndefinedDeep({ meta: { fecha, extra: undefined } });
    expect(limpio.meta.fecha).toBe(fecha);
  });

  /* 4 · los objetos planos vacíos legítimos no cambian */
  it('mantiene {} literal cuando de verdad es un objeto plano vacío', () => {
    expect(removeUndefinedDeep({ vacio: {} })).toEqual({ vacio: {} });
  });
});
