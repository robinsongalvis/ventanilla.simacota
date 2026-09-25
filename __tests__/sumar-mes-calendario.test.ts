import { describe, expect, it } from 'vitest';
import { sumarMesCalendario } from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   BM-B33 pieza (1) — "1 mes calendario" con clamping C.C. art. 67.
   Casos de borde del plan de QA (CP-2.x). La fecha se ancla a
   mediodía local; comparamos por Y-M-D local.
══════════════════════════════════════════════════════════════ */

/** 'YYYY-MM-DD' local de un Date (mismo criterio que atLocalNoon del módulo). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fecha local a mediodía para entradas deterministas (sin ambigüedad TZ). */
function local(y: number, m1: number, d: number): Date {
  return new Date(y, m1 - 1, d, 12, 0, 0, 0);
}

describe('sumarMesCalendario (C.C. art. 67)', () => {
  it('CP-2.1 · 31 ene 2026 +1 mes → 28 feb 2026 (no 3 mar)', () => {
    expect(ymd(sumarMesCalendario(local(2026, 1, 31)))).toBe('2026-02-28');
  });

  it('CP-2.2 · 31 ene 2024 +1 mes → 29 feb 2024 (bisiesto)', () => {
    expect(ymd(sumarMesCalendario(local(2024, 1, 31)))).toBe('2024-02-29');
  });

  it('CP-2.3 · 30 y 31 mar +1 mes → 30 abr (abril tiene 30, sin desbordar a mayo)', () => {
    expect(ymd(sumarMesCalendario(local(2026, 3, 30)))).toBe('2026-04-30');
    expect(ymd(sumarMesCalendario(local(2026, 3, 31)))).toBe('2026-04-30');
  });

  it('CP-2.4 · 15 jun +1 mes → 15 jul (camino regular)', () => {
    expect(ymd(sumarMesCalendario(local(2026, 6, 15)))).toBe('2026-07-15');
  });

  it('CP-2.5 · 30 dic 2026 +1 mes → 30 ene 2027 (cruce de año)', () => {
    expect(ymd(sumarMesCalendario(local(2026, 12, 30)))).toBe('2027-01-30');
  });

  it('CP-2.6 · 29 feb 2024 +1 mes → 29 mar 2024', () => {
    expect(ymd(sumarMesCalendario(local(2024, 2, 29)))).toBe('2024-03-29');
  });

  it('acepta string ISO y ancla a mediodía local (no corrimiento de día)', () => {
    // 2026-01-31 a cualquier hora → +1 mes → 28 feb 2026.
    expect(ymd(sumarMesCalendario('2026-01-31T09:00:00.000-05:00'))).toBe('2026-02-28');
  });

  it('meses=2 encadena el clamping (31 dic +2 → 28 feb)', () => {
    expect(ymd(sumarMesCalendario(local(2025, 12, 31), 2))).toBe('2026-02-28');
  });

  it('fecha inválida se propaga como Invalid Date (no lanza)', () => {
    expect(Number.isNaN(sumarMesCalendario('no-es-fecha').getTime())).toBe(true);
  });
});
