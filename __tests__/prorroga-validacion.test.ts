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

/* ══════════════════════════════════════════════════════════════
   ADR-0012 (hallazgo R6) — control ejecutable de temporalidad de la
   prórroga (Ley 1755/2015 art. 14, parágrafo: la ampliación debe
   informarse ANTES del vencimiento del término original). Control de
   regresión: estos tests deben FALLAR si vuelve a ser posible prorrogar
   un término ya vencido. Reloj inyectado (`ahora`) para determinismo,
   patrón H1.
══════════════════════════════════════════════════════════════ */

describe('validarProrroga — R6 temporalidad', () => {
  const AHORA_FIJO = new Date('2026-07-11T12:00:00.000Z');

  it('rechaza (409) si el término original ya venció, con reloj fijo inyectado', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 5,
      diasRespuesta: 15,
      fechaVencimiento: '2026-07-10T12:00:00.000Z', // venció ayer
      ahora: AHORA_FIJO,
    });
    expect(resultado).not.toBeNull();
    expect(resultado?.status).toBe(409);
    expect(resultado?.mensaje).toMatch(/venci|antes del vencimiento|1755/i);
  });

  it('permite la prórroga si el término aún está vigente', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 5,
      diasRespuesta: 15,
      fechaVencimiento: '2026-07-12T12:00:00.000Z', // vence mañana
      ahora: AHORA_FIJO,
    });
    expect(resultado).toBeNull();
  });

  it('frontera: fechaVencimiento === ahora se considera VENCIDO (rechaza) — "antes" excluye el instante exacto', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 5,
      diasRespuesta: 15,
      fechaVencimiento: AHORA_FIJO.toISOString(),
      ahora: AHORA_FIJO,
    });
    expect(resultado).not.toBeNull();
    expect(resultado?.status).toBe(409);
  });

  it('acepta `ahora` como fábrica (función) además de Date, para inyección determinista', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 5,
      diasRespuesta: 15,
      fechaVencimiento: '2026-07-10T12:00:00.000Z',
      ahora: () => AHORA_FIJO,
    });
    expect(resultado?.status).toBe(409);
  });

  it('si se omite fechaVencimiento, R6 no aplica (compatibilidad con llamadas previas a R6)', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 5,
      diasRespuesta: 15,
    });
    expect(resultado).toBeNull();
  });

  it('control de regresión: un término vencido con un reloj "real" posterior también se rechaza', () => {
    const vencidoHaceUnMes = new Date(AHORA_FIJO);
    vencidoHaceUnMes.setMonth(vencidoHaceUnMes.getMonth() - 1);
    const resultado = validarProrroga({
      prorrogasAplicadas: 0,
      diasProrroga: 5,
      diasRespuesta: 15,
      fechaVencimiento: vencidoHaceUnMes.toISOString(),
      ahora: AHORA_FIJO,
    });
    expect(resultado).not.toBeNull();
    expect(resultado?.status).toBe(409);
  });

  it('la unicidad y el tope se evalúan antes que la temporalidad: con prorrogasAplicadas >= 1 rechaza 409 por unicidad aunque el término también esté vencido', () => {
    const resultado = validarProrroga({
      prorrogasAplicadas: 1,
      diasProrroga: 5,
      diasRespuesta: 15,
      fechaVencimiento: '2026-07-10T12:00:00.000Z',
      ahora: AHORA_FIJO,
    });
    expect(resultado?.status).toBe(409);
    expect(resultado?.mensaje).toMatch(/una sola|una prórroga/i);
  });
});
