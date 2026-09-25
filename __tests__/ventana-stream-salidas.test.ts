/* ══════════════════════════════════════════════════════════════
   Ventana operativa del stream del libro de salidas (Roadmap P1.5)

   Control de regresión: `useSalidas` NO puede volver a suscribir la
   colección `ventanilla_salidas` completa vía `onSnapshot` + `orderBy` sin
   cota — el mismo antipatrón O(N) que R11 (ADR-0010) ya corrigió en
   `useVentanillaRadicados`, detectado en la auditoría P1.5 porque el gate
   de rendimiento original solo barría `ventanilla_radicados`. Debe acotar
   siempre con un rango temporal (`fechaSalida >= cutoff`) + un `limit()`
   de seguridad. Si cualquiera de los dos se elimina, el número de
   documentos leídos vuelve a depender de N y este test debe fallar.
══════════════════════════════════════════════════════════════ */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ── Mocks de módulos externos ──────────────────────────────── */

const mockCollection = vi.fn((...args: unknown[]) => ({ __ref: 'ventanilla_salidas', args }));
const mockQuery       = vi.fn((...args: unknown[]) => ({ __query: args }));
const mockWhere       = vi.fn((...args: unknown[]) => ({ __constraint: 'where', args }));
const mockOrderBy     = vi.fn((...args: unknown[]) => ({ __constraint: 'orderBy', args }));
const mockLimit       = vi.fn((...args: unknown[]) => ({ __constraint: 'limit', args }));
const mockUnsub       = vi.fn();
const mockOnSnapshot  = vi.fn((..._args: unknown[]) => mockUnsub);

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query:      (...args: unknown[]) => mockQuery(...args),
  where:      (...args: unknown[]) => mockWhere(...args),
  orderBy:    (...args: unknown[]) => mockOrderBy(...args),
  limit:      (...args: unknown[]) => mockLimit(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

vi.mock('@/lib/firebase', () => ({
  getDb: vi.fn(() => ({ __db: true })),
}));

/* ── Import (después de los mocks para que Vitest los intercepte) ── */

import { useSalidas } from '@/lib/hooks/useSalidas';

function argsDe(mock: ReturnType<typeof vi.fn>, campo: string): unknown[] | undefined {
  return mock.mock.calls.find((call) => call[0] === campo);
}

describe('useSalidas — ventana operativa del stream (Roadmap P1.5)', () => {
  beforeEach(() => {
    mockCollection.mockClear();
    mockQuery.mockClear();
    mockWhere.mockClear();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
    mockOnSnapshot.mockClear();
    mockUnsub.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('inactivo (activo=false): no se suscribe — no hay onSnapshot ni consulta construida', () => {
    act(() => {
      renderHook(() => useSalidas(false));
    });
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('activo=true: la consulta SIEMPRE incluye un rango temporal (fechaSalida) + limit()', () => {
    act(() => {
      renderHook(() => useSalidas(true));
    });

    // No debe quedar SOLO orderBy sin acotamiento: el rango temporal sobre
    // fechaSalida debe estar presente.
    const llamadaRango = argsDe(mockWhere, 'fechaSalida');
    expect(llamadaRango).toBeDefined();
    expect(llamadaRango?.[1]).toBe('>=');
    expect(typeof llamadaRango?.[2]).toBe('string');

    // El techo de documentos (limit) debe estar presente y ser un nº finito > 0.
    expect(mockLimit).toHaveBeenCalledTimes(1);
    const limiteUsado = mockLimit.mock.calls[0][0];
    expect(typeof limiteUsado).toBe('number');
    expect(limiteUsado).toBeGreaterThan(0);
    expect(Number.isFinite(limiteUsado)).toBe(true);
  });

  it('la ventana temporal es cercana a "ahora menos N días", no una fecha fija arbitraria ni ausente', () => {
    const antes = Date.now();
    act(() => {
      renderHook(() => useSalidas(true));
    });
    const despues = Date.now();

    const llamadaRango = argsDe(mockWhere, 'fechaSalida');
    const cutoffMs = new Date(llamadaRango?.[2] as string).getTime();

    expect(Number.isNaN(cutoffMs)).toBe(false);
    expect(cutoffMs).toBeLessThan(antes);
    expect(cutoffMs).toBeGreaterThan(antes - 366 * 24 * 60 * 60 * 1000); // < 1 año de ventana
    expect(cutoffMs).toBeLessThan(despues);
  });

  it('sigue ordenando por fechaSalida desc (contrato existente, sin regresión)', () => {
    act(() => {
      renderHook(() => useSalidas(true));
    });

    expect(mockOrderBy).toHaveBeenCalledWith('fechaSalida', 'desc');
  });
});
