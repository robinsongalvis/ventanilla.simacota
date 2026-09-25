import { describe, expect, it } from 'vitest';
import {
  reactivarVencimiento,
  plazoSubsanacion,
  plazoConProrroga,
  dentroVentanaRequerimiento,
  prorrogaEsOportuna,
  subsanacionVencida,
  diasRestantesHabiles,
  esDiaHabil,
} from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   BM-B33 pieza (3) — reloj legal de la subsanación (Ley 1755 Art. 17).
   Casos del plan de QA (CP-3.x, CP-4.x, CP-6.x).
══════════════════════════════════════════════════════════════ */

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function local(y: number, m1: number, d: number): Date {
  return new Date(y, m1 - 1, d, 12, 0, 0, 0);
}

describe('reactivarVencimiento — días hábiles restantes desde el día siguiente', () => {
  // Contrato relacional (no depende del día de la semana): reanudar por N días
  // hábiles equivale a que queden exactamente N días hábiles entre el aporte y
  // el nuevo vencimiento — es decir, se cuenta DESDE EL DÍA SIGUIENTE, no reinicia.
  for (const [aporte, n] of [
    [local(2026, 6, 2), 5],
    [local(2026, 6, 5), 5],   // si cae viernes, el conteo salta el fin de semana
    [local(2026, 7, 17), 3],  // cerca del festivo 20 jul → no se cuenta
    [local(2026, 12, 24), 4], // cerca de festivos de fin de año
  ] as const) {
    it(`CP-3.x · ${ymd(aporte)} + ${n} hábiles restantes → vence en día hábil, ${n} hábiles después`, () => {
      const venc = reactivarVencimiento(aporte, n);
      expect(esDiaHabil(venc)).toBe(true);
      expect(venc.getTime()).toBeGreaterThan(aporte.getTime());
      // exactamente N días hábiles entre el aporte y el nuevo vencimiento
      expect(diasRestantesHabiles(venc, aporte)).toBe(n);
    });
  }

  it('CP-3.5 · 0 días restantes → vence el día hábil SIGUIENTE (mínimo 1)', () => {
    const aporte = local(2026, 6, 2);
    const venc = reactivarVencimiento(aporte, 0);
    expect(esDiaHabil(venc)).toBe(true);
    expect(diasRestantesHabiles(venc, aporte)).toBe(1);
  });
});

describe('plazos calendario (delegan en sumarMesCalendario, C.C. art. 67)', () => {
  it('plazoSubsanacion: 31 ene 2026 → 28 feb 2026', () => {
    expect(ymd(plazoSubsanacion(local(2026, 1, 31)))).toBe('2026-02-28');
  });
  it('plazoConProrroga: 31 ene 2026 → 28 feb 2026 (+1 mes con clamping)', () => {
    expect(ymd(plazoConProrroga(local(2026, 1, 31)))).toBe('2026-02-28');
  });
});

describe('ventana de 10 días para requerir (CP-6.x)', () => {
  const radicado = local(2026, 6, 1);
  it('al 10.º día hábil está dentro de la ventana', () => {
    const d10 = reactivarVencimiento(radicado, 10);
    expect(dentroVentanaRequerimiento(radicado, d10)).toBe(true);
  });
  it('al 11.º día hábil queda fuera', () => {
    const d11 = reactivarVencimiento(radicado, 11);
    expect(dentroVentanaRequerimiento(radicado, d11)).toBe(false);
  });
});

describe('prórroga oportuna / vencimiento del plazo (CP-4.x)', () => {
  const limite = local(2026, 7, 15);
  it('CP-4.3 · solicitada el mismo día del vencimiento → oportuna (inclusive)', () => {
    expect(prorrogaEsOportuna(limite, local(2026, 7, 15))).toBe(true);
  });
  it('CP-4.4 · solicitada un día después → NO oportuna', () => {
    expect(prorrogaEsOportuna(limite, local(2026, 7, 16))).toBe(false);
  });
  it('subsanacionVencida: después del límite = true; en/antes = false', () => {
    expect(subsanacionVencida(limite, local(2026, 7, 16))).toBe(true);
    expect(subsanacionVencida(limite, local(2026, 7, 15))).toBe(false);
    expect(subsanacionVencida(limite, local(2026, 7, 14))).toBe(false);
  });
});
