/**
 * Bloque 2 (fix H3) · ruta `planillas/generar` (serie planillas, sin adjuntos).
 * Mismo patrón validado en `registro-expres`: el consecutivo se confirmaba en
 * una transacción SEPARADA de la persistencia de la planilla → fantasma si el
 * `.set()` falla. Rojo-primero (ADR-0015 #3): rojo con el código actual, verde
 * con contador+documento en una sola transacción. Maneja el handler POST real;
 * solo mockea fronteras. No toca Firebase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: class extends Error { status = 401; },
  requireActiveInternalUser: vi.fn(async () => ({
    uid: 'u1', nombre: 'Recepción', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA', activo: true,
  })),
}));

vi.mock('@/lib/server/radicados-security', () => ({
  RadicadoActionError: class extends Error { status = 400; },
}));

vi.mock('@/lib/server/planillas-security', () => ({
  obtenerPendientesDeReparto: async () => ({ pendientes: [{ radicadoId: '1-110-2026-00000001' }] }),
}));

vi.mock('@/lib/planillas/construir-planilla', () => ({
  formatearPlanillaId: (n: number, f: Date) => `PL-${f.getFullYear()}-${String(n).padStart(4, '0')}`,
  construirPlanilla: (_p: unknown, consecutivo: number, _a: unknown, f: Date) => ({
    planillaId: `PL-${f.getFullYear()}-${String(consecutivo).padStart(4, '0')}`,
  }),
}));

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const INICIAL: Record<string, number> = { 'counters/planillas-2026': 6 };
let contadores: Record<string, number>;
let persistidos: Map<string, unknown>;
let fallaPersistencia = true;

const falla = (path: string) => fallaPersistencia && path.startsWith('ventanilla_planillas/');

const fakeDb = {
  doc: (path: string) => ({
    path,
    id: path.split('/').pop(),
    set: async (data: unknown) => {
      if (falla(path)) throw new Error('fallo al persistir planilla (fuera de tx)');
      persistidos.set(path, data);
    },
  }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { path: string; data: { ultimo?: number } }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      set: (ref: { path: string }, data: { ultimo?: number }) => {
        if (falla(ref.path)) throw new Error('fallo al persistir planilla (en tx)');
        buffer.push({ path: ref.path, data });
      },
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contadores[w.path] = w.data.ultimo!;
      else persistidos.set(w.path, w.data);
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => fakeDb }));

import { POST } from '@/app/api/planillas/generar/route';

beforeEach(() => {
  contadores = { ...INICIAL };
  persistidos = new Map();
  fallaPersistencia = true;
});

describe('planillas/generar — atomicidad consecutivo↔documento (H3)', () => {
  it('un fallo al persistir NO debe dejar el consecutivo de planilla consumido sin documento', async () => {
    const res = await POST();
    expect(res.status).toBe(500);

    const avanzo = contadores['counters/planillas-2026'] > INICIAL['counters/planillas-2026'];
    const persistido = [...persistidos.keys()].some((k) => k.startsWith('ventanilla_planillas/'));

    // Invariante no-huérfano: consecutivo consumido ⇒ documento existe.
    // Actual (set fuera de la tx): avanza sin documento → FALLA (rojo).
    // Atómico (contador+doc en una tx): revierte → PASA (verde).
    expect(avanzo && !persistido).toBe(false);
  });
});
