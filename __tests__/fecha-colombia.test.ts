import { describe, expect, it } from 'vitest';
import {
  TIMEZONE_COLOMBIA,
  formatFechaColombia,
  formatFechaCortaColombia,
  formatFechaHoraColombia,
  formatFechaLargaColombia,
  formatHoraColombia,
  fromIsoToColombiaInput,
  safeDate,
  toIsoFromColombiaInput,
} from '@/lib/fecha-colombia';

describe('Fechas Colombia — helper centralizado', () => {
  it('TIMEZONE_COLOMBIA es America/Bogota', () => {
    expect(TIMEZONE_COLOMBIA).toBe('America/Bogota');
  });

  /* 1 */
  it('formatFechaColombia devuelve DD/MM/YYYY en es-CO', () => {
    // 2026-06-17 17:30 UTC = 12:30 p. m. Colombia (UTC-5)
    const iso = '2026-06-17T17:30:00.000Z';
    expect(formatFechaColombia(iso)).toBe('17/06/2026');
  });

  /* 2 */
  it('formatHoraColombia usa America/Bogota (no la zona del navegador)', () => {
    // 2026-06-17 17:30 UTC = 12:30 p. m. Colombia
    const iso = '2026-06-17T17:30:00.000Z';
    const hora = formatHoraColombia(iso);
    expect(hora).toMatch(/12:30/);
    expect(hora.toLowerCase()).toMatch(/p\.?\s?m/);
  });

  /* 3 */
  it('formatFechaHoraColombia produce DD/MM/YYYY + hora 12h', () => {
    // 2026-01-01 04:00 UTC = 23:00 p. m. del 31/12/2025 en Colombia
    const iso = '2026-01-01T04:00:00.000Z';
    const txt = formatFechaHoraColombia(iso);
    expect(txt).toMatch(/31\/12\/2025/);
    expect(txt).toMatch(/11:00/);
  });

  /* 4 */
  it('safeDate retorna null con fechas inválidas', () => {
    expect(safeDate(null)).toBeNull();
    expect(safeDate(undefined)).toBeNull();
    expect(safeDate('')).toBeNull();
    expect(safeDate('no es fecha')).toBeNull();
    expect(safeDate(Number.NaN)).toBeNull();
    expect(safeDate({})).toBeNull();
  });

  it('safeDate acepta string ISO, Date y number', () => {
    expect(safeDate('2026-06-17T12:00:00Z')).toBeInstanceOf(Date);
    expect(safeDate(new Date('2026-06-17'))).toBeInstanceOf(Date);
    expect(safeDate(Date.UTC(2026, 5, 17))).toBeInstanceOf(Date);
  });

  it('safeDate acepta objetos con toDate() (Firestore Timestamp)', () => {
    const ts = { toDate: () => new Date('2026-06-17T12:00:00Z') };
    expect(safeDate(ts)).toBeInstanceOf(Date);
  });

  /* 5 */
  it('fecha inválida muestra "No registrada" o "—"', () => {
    expect(formatFechaColombia(null)).toBe('No registrada');
    expect(formatFechaHoraColombia(null)).toBe('No registrada');
    expect(formatHoraColombia(null)).toBe('—');
    expect(formatFechaCortaColombia(null)).toBe('—');
    expect(formatFechaColombia('basura')).toBe('No registrada');
  });

  it('fallback configurable', () => {
    expect(formatFechaColombia(null, { fallback: 'Pendiente' })).toBe('Pendiente');
  });

  /* 6 */
  it('formatFechaCortaColombia funciona con ISO string', () => {
    const iso = '2026-06-17T17:30:00.000Z';
    expect(formatFechaCortaColombia(iso)).toBe('17/06/26');
  });

  it('formatFechaLargaColombia devuelve forma "DD de MMMM de YYYY"', () => {
    const iso = '2026-06-17T17:30:00.000Z';
    const txt = formatFechaLargaColombia(iso);
    expect(txt.toLowerCase()).toContain('junio');
    expect(txt).toMatch(/2026/);
  });

  /* 7 */
  it('toIsoFromColombiaInput convierte input local Colombia a ISO UTC', () => {
    // Funcionario escribe 17/06/2026 12:30 (Colombia)
    // ISO equivalente: 17/06/2026 17:30 UTC
    expect(toIsoFromColombiaInput('2026-06-17T12:30')).toBe('2026-06-17T17:30:00.000Z');
  });

  it('toIsoFromColombiaInput devuelve cadena vacía con entrada inválida', () => {
    expect(toIsoFromColombiaInput('')).toBe('');
    expect(toIsoFromColombiaInput('basura')).toBe('');
    expect(toIsoFromColombiaInput('2026-13-40T99:99')).toBe('');
  });

  it('fromIsoToColombiaInput es el inverso de toIsoFromColombiaInput', () => {
    const input = '2026-06-17T12:30';
    const iso = toIsoFromColombiaInput(input);
    expect(fromIsoToColombiaInput(iso)).toBe(input);
  });

  it('fromIsoToColombiaInput maneja inválidos con string vacío', () => {
    expect(fromIsoToColombiaInput(null)).toBe('');
    expect(fromIsoToColombiaInput('no es fecha')).toBe('');
  });
});
