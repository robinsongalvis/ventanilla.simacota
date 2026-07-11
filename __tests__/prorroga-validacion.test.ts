import { describe, expect, it } from 'vitest';
import { validarProrroga } from '@/lib/server/radicados-security';

/* ══════════════════════════════════════════════════════════════
   ADR-0003 (hallazgo H1) — control ejecutable de prórroga: unicidad
   y tope legal (Ley 1755/2015 art. 14, parágrafo). Estos tests deben
   FALLAR si la brecha reaparece (regresión): antes de este control,
   el endpoint permitía N prórrogas sin comparar contra un máximo.
══════════════════════════════════════════════════════════════ */

describe('validarProrroga', () => {
  it('primera prórroga dentro del tope es válida (null)', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 10,
      diasRespuesta: 15,
    });
    expect(resultado).toBeNull();
  });

  it('trata prorrogasAplicadas undefined como 0 (válida si además está en el tope)', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: undefined,
      diasProrroga: 10,
      diasRespuesta: 15,
    });
    expect(resultado).toBeNull();
  });

  it('rechaza una segunda prórroga (unicidad, Ley 1755 art. 14) con status 409', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 1,
      diasProrroga: 5,
      diasRespuesta: 15,
    });
    expect(resultado).not.toBeNull();
    expect(resultado?.status).toBe(409);
    expect(resultado?.mensaje).toMatch(/una sola|una prórroga|1755/i);
  });

  it('rechaza cuando diasProrroga supera diasRespuesta (tope del doble) con status 400', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 16,
      diasRespuesta: 15,
    });
    expect(resultado).not.toBeNull();
    expect(resultado?.status).toBe(400);
    expect(resultado?.mensaje).toMatch(/doble|tope|1755/i);
  });

  it('la frontera diasProrroga === diasRespuesta es válida (null)', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 15,
      diasRespuesta: 15,
    });
    expect(resultado).toBeNull();
  });

  it('la unicidad se evalúa antes que el tope: con prorrogasAplicadas >= 1, rechaza 409 aunque el tope también se exceda', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 1,
      diasProrroga: 999,
      diasRespuesta: 15,
    });
    expect(resultado?.status).toBe(409);
  });
});
