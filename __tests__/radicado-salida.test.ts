import { describe, expect, it } from 'vitest';
import { formatearRadicadoSalida } from '@/lib/salidas/radicado-salida';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — formato de la serie 2-SAL.

   La serie de salida es propia y continua; el formato de ENTRADA
   (1-{CANAL}-...) no se toca.
══════════════════════════════════════════════════════════════ */

describe('Radicación de salida — formatearRadicadoSalida', () => {
  /* 1 · el formato aprobado */
  it('arma 2-SAL-{año}-{consecutivo a 8 dígitos}', () => {
    expect(formatearRadicadoSalida(1, new Date('2026-07-04T10:00:00Z')))
      .toBe('2-SAL-2026-00000001');
    expect(formatearRadicadoSalida(12, new Date('2026-07-04T10:00:00Z')))
      .toBe('2-SAL-2026-00000012');
  });

  /* 2 · padding completo para consecutivos grandes */
  it('conserva 8 dígitos con consecutivos altos', () => {
    expect(formatearRadicadoSalida(12345678, new Date('2026-01-01T10:00:00Z')))
      .toBe('2-SAL-2026-12345678');
  });

  /* 3 · la serie es anual */
  it('usa el año de la fecha dada', () => {
    expect(formatearRadicadoSalida(1, new Date('2027-01-15T10:00:00Z')))
      .toBe('2-SAL-2027-00000001');
  });

  /* 4 · nunca colisiona con la serie de entrada */
  it('el prefijo 2-SAL no coincide con el formato de entrada 1-CANAL', () => {
    const salida = formatearRadicadoSalida(45, new Date('2026-07-04T10:00:00Z'));
    expect(salida.startsWith('2-SAL-')).toBe(true);
    expect(salida).not.toMatch(/^1-/);
  });
});
