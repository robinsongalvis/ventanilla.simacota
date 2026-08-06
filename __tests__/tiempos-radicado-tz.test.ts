/**
 * RS-1 (ADR-0026 §A2 #15) — regresión de zona horaria en `atLocalNoon`.
 *
 * Se fija `process.env.TZ = 'UTC'` ANTES de importar el módulo para reproducir
 * el entorno de producción (Vercel corre en UTC). Con el bug original,
 * `atLocalNoon` derivaba el día con los getters de la TZ del runtime, así que
 * un instante de la franja nocturna colombiana (que en UTC ya es el día
 * siguiente) se anclaba al día equivocado → ±1 día en TODOS los plazos legales.
 *
 * El fix ancla el día calendario a America/Bogota (UTC-5) de forma
 * independiente del runtime; estas pruebas fallan con el código anterior bajo
 * TZ=UTC y pasan con el fix.
 */
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { atLocalNoon, calcularFechaVencimiento } from '@/lib/tiempos-radicado';

/** [año, mes(1-based), día] de un Date por sus getters locales (estable a mediodía). */
function ymd(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

describe('atLocalNoon — anclaje a America/Bogota (RS-1)', () => {
  it('instante nocturno colombiano (04:30Z = 23:30 Bogotá del día anterior) → día de Bogotá', () => {
    // 2026-11-13T04:30Z es 2026-11-12 23:30 en Colombia. El día correcto es el 12.
    expect(ymd(atLocalNoon('2026-11-13T04:30:00.000Z'))).toEqual([2026, 11, 12]);
  });

  it('límite exacto medianoche Bogotá (05:00Z = 00:00 Bogotá) → ese mismo día', () => {
    expect(ymd(atLocalNoon('2026-11-13T05:00:00.000Z'))).toEqual([2026, 11, 13]);
  });

  it('instante diurno (mismo día en UTC y en Bogotá) → sin cambio', () => {
    expect(ymd(atLocalNoon('2026-11-13T15:00:00.000Z'))).toEqual([2026, 11, 13]);
  });

  it('acepta Date además de string y ancla igual', () => {
    expect(ymd(atLocalNoon(new Date('2026-11-13T04:30:00.000Z')))).toEqual([2026, 11, 12]);
  });

  it('string de SOLO fecha "YYYY-MM-DD" se toma literal (no se corre al día anterior)', () => {
    // Sin el trato especial, new Date('2026-11-13') = medianoche UTC → 12-nov en Bogotá.
    expect(ymd(atLocalNoon('2026-11-13'))).toEqual([2026, 11, 13]);
  });

  it('solo-fecha y su instante mediodía-Bogotá coinciden en el día', () => {
    const porFecha = atLocalNoon('2026-11-13');
    const porInstante = atLocalNoon('2026-11-13T12:00:00-05:00'); // 17:00Z, 13-nov Bogotá
    expect(ymd(porFecha)).toEqual(ymd(porInstante));
  });

  it('el resultado queda anclado a mediodía (no cruza medianoche por offset)', () => {
    expect(atLocalNoon('2026-11-13T04:30:00.000Z').getHours()).toBe(12);
  });

  it('fecha inválida se propaga como Invalid Date', () => {
    expect(Number.isNaN(atLocalNoon('esto-no-es-fecha').getTime())).toBe(true);
  });

  it('solo-fecha con overflow ("2026-02-31") → Invalid Date (no rueda a marzo)', () => {
    expect(Number.isNaN(atLocalNoon('2026-02-31').getTime())).toBe(true);
  });
});

describe('calcularFechaVencimiento — usa el día de Bogotá como base (RS-1, extremo a extremo)', () => {
  it('radicado nocturno colombiano computa desde el día de Bogotá, no el de UTC', () => {
    // 2026-11-12 23:30 Colombia = 2026-11-13T04:30Z. La base debe ser 12-nov.
    const r = calcularFechaVencimiento('2026-11-13T04:30:00.000Z', 'PETICION_GENERAL');
    expect(r.fechaRadicado.startsWith('2026-11-12')).toBe(true);
  });

  it('el vencimiento cae en día hábil (no fin de semana)', () => {
    const r = calcularFechaVencimiento('2026-11-13T04:30:00.000Z', 'PETICION_GENERAL');
    const fin = new Date(r.fechaVencimiento);
    expect(fin.getDay()).not.toBe(0);
    expect(fin.getDay()).not.toBe(6);
  });
});
