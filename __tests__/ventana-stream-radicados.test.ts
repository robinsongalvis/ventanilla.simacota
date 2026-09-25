/* ══════════════════════════════════════════════════════════════
   Ventana operativa del stream (ADR-0010, incremento 2A, R11)

   Control de regresión: `useVentanillaRadicados` NO puede volver a
   suscribir la colección `ventanilla_radicados` completa. Debe acotar
   siempre — con o sin filtro de tenant (ADMIN/RECEPCIONISTA/CONTROL_INTERNO
   incluidos, el peor caso medido en docs/auditorias/rendimiento-base-lectura.md)
   — con un rango temporal (`control.fechaRadicado >= cutoff`) + un
   `limit()` de seguridad. Si cualquiera de los dos se elimina, el número
   de documentos leídos vuelve a depender de N (patrón O(N) que este ADR
   corrige) y este test debe fallar.
══════════════════════════════════════════════════════════════ */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { puedeVerTodosLosTenants } from '@/lib/permisos/alcance-tenants';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';

/* ── Mocks de módulos externos ──────────────────────────────── */

const mockCollection = vi.fn((...args: unknown[]) => ({ __ref: 'ventanilla_radicados', args }));
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

import { useVentanillaRadicados } from '@/lib/hooks/useVentanillaRadicados';

const usuarioAdmin: UsuarioAutenticado = {
  uid:      'usr_admin',
  email:    'admin@simacota.gov.co',
  nombre:   'Admin Prueba',
  rol:      'ADMIN',
  tenantId: 'SEC_GOBIERNO',
};

const usuarioFuncionario: UsuarioAutenticado = {
  uid:      'usr_func',
  email:    'funcionario@simacota.gov.co',
  nombre:   'Funcionario Prueba',
  rol:      'FUNCIONARIO',
  tenantId: 'SEC_GOBIERNO',
};

function argsDe(mock: ReturnType<typeof vi.fn>, campo: string): unknown[] | undefined {
  return mock.mock.calls.find((call) => call[0] === campo);
}

describe('useVentanillaRadicados — ventana operativa del stream (ADR-0010, R11)', () => {
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

  it('sanity: ADMIN/RECEPCIONISTA/CONTROL_INTERNO son los roles sin tenant fijo (peor caso R11)', () => {
    expect(puedeVerTodosLosTenants('ADMIN')).toBe(true);
    expect(puedeVerTodosLosTenants('FUNCIONARIO')).toBe(false);
  });

  it('rol sin tenant fijo (ADMIN, tenantFiltro=TODOS): la consulta SIEMPRE incluye un rango temporal + limit()', () => {
    act(() => {
      renderHook(() => useVentanillaRadicados(usuarioAdmin, 'TODOS'));
    });

    // No debe quedar SOLO orderBy sin acotamiento: el rango temporal
    // sobre control.fechaRadicado debe estar presente.
    const llamadaRango = argsDe(mockWhere, 'control.fechaRadicado');
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

  it('rol con tenant fijo (FUNCIONARIO): la ventana temporal + limit() se preservan además del where de tenant', () => {
    act(() => {
      renderHook(() => useVentanillaRadicados(usuarioFuncionario, 'TODOS'));
    });

    const llamadaTenant = argsDe(mockWhere, 'clasificacion.oficinaDestino');
    expect(llamadaTenant).toBeDefined();
    expect(llamadaTenant?.[2]).toBe('SEC_GOBIERNO');

    // Aislamiento por tenant intacto (condición del propietario, ADR-0010).
    const llamadaRango = argsDe(mockWhere, 'control.fechaRadicado');
    expect(llamadaRango).toBeDefined();

    expect(mockLimit).toHaveBeenCalledTimes(1);
  });

  it('la ventana temporal es cercana a "ahora menos N días", no una fecha fija arbitraria ni ausente', () => {
    const antes = Date.now();
    act(() => {
      renderHook(() => useVentanillaRadicados(usuarioAdmin, 'TODOS'));
    });
    const despues = Date.now();

    const llamadaRango = argsDe(mockWhere, 'control.fechaRadicado');
    const cutoffMs = new Date(llamadaRango?.[2] as string).getTime();

    // El cutoff debe caer en el pasado relativo a "ahora" (ventana > 0 días)
    // y no ser una fecha absurda (epoch, futuro, NaN).
    expect(Number.isNaN(cutoffMs)).toBe(false);
    expect(cutoffMs).toBeLessThan(antes);
    expect(cutoffMs).toBeGreaterThan(antes - 366 * 24 * 60 * 60 * 1000); // < 1 año de ventana
    expect(cutoffMs).toBeLessThan(despues);
  });

  it('sigue ordenando por control.fechaRadicado desc (contrato existente, sin regresión)', () => {
    act(() => {
      renderHook(() => useVentanillaRadicados(usuarioAdmin, 'TODOS'));
    });

    expect(mockOrderBy).toHaveBeenCalledWith('control.fechaRadicado', 'desc');
  });
});
