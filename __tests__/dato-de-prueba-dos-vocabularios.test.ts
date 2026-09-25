import { describe, it, expect } from 'vitest';
import { esDatoDePrueba, soloOperacionReal } from '@/lib/radicados/dato-de-prueba';

/**
 * Los expedientes de licencias marcan la demostración con `esPrueba`; los
 * radicados con `isTest`. El criterio canónico solo miraba el segundo, así que
 * `soloOperacionReal` sobre `expedientes` no filtraba NADA — y con el candado
 * R10 cerrado el 100% de los expedientes es de demostración.
 *
 * Consecuencia viva, no teórica: el vigía del término los alertaba a todos como
 * licencias reales camino del silencio administrativo positivo.
 */

describe('el criterio de dato de prueba cubre los dos vocabularios', () => {
  it.each([
    ['isTest (radicados)', { isTest: true }],
    ['esPrueba (expedientes de licencias)', { esPrueba: true }],
    ['excludeFromMetrics', { excludeFromMetrics: true }],
    ['anulado con acta', { anulado: { fecha: 'x', motivo: 'y', acta: 'z' } }],
  ])('reconoce %s', (_cual, marcas) => {
    expect(esDatoDePrueba(marcas)).toBe(true);
  });

  it('la operación real sigue pasando', () => {
    expect(esDatoDePrueba({})).toBe(false);
    expect(esDatoDePrueba({ isTest: false, esPrueba: false })).toBe(false);
  });

  /* El caso que motiva todo: un lote de expedientes de demostración no puede
     colarse en un barrido que alimenta alertas de plazo legal. */
  it('un lote de expedientes de demostración se filtra entero', () => {
    const expedientes = [
      { id: 'a', esPrueba: true },
      { id: 'b', esPrueba: true },
      { id: 'c', esPrueba: false },
    ];
    expect(soloOperacionReal(expedientes).map((e) => e.id)).toEqual(['c']);
  });
});
