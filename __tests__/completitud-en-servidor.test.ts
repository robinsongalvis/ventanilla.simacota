import { describe, it, expect } from 'vitest';
import { calcularCompletitudExpediente } from '@/lib/server/completitud-expediente';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL as DEF } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';

const AHORA = new Date('2026-09-01T12:00:00.000Z');

describe('la completitud se calcula en el SERVIDOR, no en la pantalla', () => {
  it('un expediente sin aportes nace INCOMPLETO y lista sus faltantes', () => {
    // Es la contradicción que el ADR-0033 nombra: hoy el expediente nace
    // afirmando RADICADA_EN_DEBIDA_FORMA con `aportes: []`. Ahora esa
    // contradicción queda ESCRITA en el propio documento.
    const c = calcularCompletitudExpediente([], {}, AHORA);
    expect(c.completo).toBe(false);
    expect(c.faltantes.length).toBeGreaterThan(0);
    expect(c.evaluadoEn).toBe(AHORA.toISOString());
  });

  it('los faltantes traen nombre legible — es lo que la constancia impresa debe listar', () => {
    // ADR-0033 §4.8: quien llega con 9 de 19 se va sabiendo CUÁLES son los que
    // faltan, no con «traiga lo que falta». Sin nombre, la lista no sirve.
    const c = calcularCompletitudExpediente([], {}, AHORA);
    for (const f of c.faltantes) {
      expect(f.nombre.length).toBeGreaterThan(3);
      expect(f.requisitoId.length).toBeGreaterThan(0);
    }
  });

  it('los condicionales que no aplican NO cuentan como aplicables', () => {
    // Sin apoderado, el poder no se exige: el total de aplicables debe bajar.
    const sinApoderado = calcularCompletitudExpediente([], { esApoderado: false }, AHORA);
    const conApoderado = calcularCompletitudExpediente([], { esApoderado: true }, AHORA);
    expect(sinApoderado.aplicables).toBeLessThan(conApoderado.aplicables);
    expect(conApoderado.aplicables).toBeLessThanOrEqual(DEF.requisitos.length);
  });

  it('el resultado es un dato serializable — va a Firestore, no a una pantalla', () => {
    const c = calcularCompletitudExpediente([], {}, AHORA);
    expect(() => JSON.parse(JSON.stringify(c))).not.toThrow();
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });
});
