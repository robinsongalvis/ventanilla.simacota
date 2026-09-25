import { describe, it, expect } from 'vitest';
import { verificarCoherenciaConApertura } from '@/lib/server/consecutivo-legal';

/**
 * El contador contra su propia historia.
 *
 * La reserva de unicidad hace imposible el duplicado, pero falla en el último
 * paso con un ALREADY_EXISTS que no dice nada. Esta comprobación detecta la
 * CAUSA —un contador movido hacia atrás por fuera— y detiene la emisión antes
 * de intentarla.
 */
const APERTURA = { abiertoEn: 1600, autorizadoPor: 'Propietario', fecha: '2026-09-01T12:00:00.000Z' };

describe('coherencia del contador con su historia de apertura', () => {
  it('EL ATAQUE: contador movido a 27 tras haberse abierto en 1600 ⇒ NO emite', () => {
    // Sin esto, la emisión leería 27, propondría 28 —avance válido para D9— y
    // reintentaría números ya entregados, uno por emisión.
    expect(() => verificarCoherenciaConApertura('radicados', 27, APERTURA))
      .toThrow(/incoherente/i);
  });

  it('el mensaje nombra los dos valores y quién autorizó — para poder actuar', () => {
    try {
      verificarCoherenciaConApertura('radicados', 27, APERTURA);
      throw new Error('debió lanzar');
    } catch (e) {
      const m = (e as Error).message;
      expect(m).toContain('1600');
      expect(m).toContain('27');
      expect(m).toContain('Propietario');
    }
  });

  it('el piso es abiertoEn-1: justo ahí es legítimo, un número por debajo no', () => {
    expect(() => verificarCoherenciaConApertura('radicados', 1599, APERTURA)).not.toThrow();
    expect(() => verificarCoherenciaConApertura('radicados', 1598, APERTURA)).toThrow();
  });

  it('un contador que avanzó normalmente pasa sin ruido', () => {
    expect(() => verificarCoherenciaConApertura('radicados', 1650, APERTURA)).not.toThrow();
  });

  it('una serie SIN apertura registrada no se bloquea', () => {
    // Exigir historia donde no la hay bloquearía toda emisión previa a la
    // apertura: fallar cerrado donde no hay riesgo es tan malo como no fallar
    // donde lo hay.
    expect(() => verificarCoherenciaConApertura('radicados', 27, undefined)).not.toThrow();
    expect(() => verificarCoherenciaConApertura('radicados', 27, {})).not.toThrow();
  });

  it('ignora un registro de apertura corrupto en vez de bloquear la operación', () => {
    for (const malo of [{ abiertoEn: 'mil' }, { abiertoEn: 1.5 }, { abiertoEn: null }]) {
      expect(() => verificarCoherenciaConApertura('radicados', 27, malo as never)).not.toThrow();
    }
  });

  it('protege las cuatro series por igual', () => {
    for (const serie of ['radicados', 'salidas', 'planillas', 'expedientes'] as const) {
      expect(() => verificarCoherenciaConApertura(serie, 5, { abiertoEn: 100 })).toThrow();
    }
  });
});
