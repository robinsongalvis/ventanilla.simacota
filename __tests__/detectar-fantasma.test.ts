/**
 * Prueba de la lógica pura del detector de consecutivos fantasma (Bloque 2,
 * cierre de H3). La ejecución contra Firestore es solo-lectura y se corre
 * aparte contra Producción; aquí se valida el algoritmo de detección de huecos.
 */
import { describe, it, expect } from 'vitest';
import {
  huecosDe,
  consecutivoDeId,
} from '@/scripts/laboratorio/detectar-consecutivos-fantasma.mjs';

describe('detector de fantasmas — huecosDe', () => {
  it('cero huecos cuando todos los consecutivos existen', () => {
    expect(huecosDe(3, [1, 2, 3])).toEqual([]);
  });

  it('detecta el hueco exacto (número consumido sin documento)', () => {
    // Contador en 3, pero falta el 2 → fantasma en el 2.
    expect(huecosDe(3, [1, 3])).toEqual([2]);
  });

  it('detecta múltiples huecos en orden ascendente', () => {
    expect(huecosDe(5, [1, 4])).toEqual([2, 3, 5]);
  });

  it('acepta un Set y no cuenta números por encima del contador', () => {
    expect(huecosDe(2, new Set([1, 2, 3]))).toEqual([]);
  });

  it('contador en 0 no reporta huecos', () => {
    expect(huecosDe(0, [])).toEqual([]);
  });
});

describe('detector de fantasmas — consecutivoDeId', () => {
  it('extrae el consecutivo del id de radicado', () => {
    expect(consecutivoDeId('1-110-2026-00000042')).toBe(42);
  });

  it('extrae el consecutivo de una planilla', () => {
    expect(consecutivoDeId('PL-2026-0007')).toBe(7);
  });

  it('extrae el consecutivo de una salida', () => {
    expect(consecutivoDeId('2-110-2026-00000005')).toBe(5);
  });

  it('devuelve null para un id no parseable', () => {
    expect(consecutivoDeId('sin-numero-final-x')).toBeNull();
  });
});
