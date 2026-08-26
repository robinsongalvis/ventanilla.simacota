/**
 * Bloque 2 (fix H3) · Checkpoint 2 — reproducción + control de regresión de
 * la ruta `registro-expres` (Admin SDK, 2 series: radicados + salidas).
 *
 * Defecto (código actual, `route.ts:111-137`): la transacción confirma AMBOS
 * contadores, pero los documentos se persisten FUERA de ella → si el `.set()`
 * del radicado falla, ambos consecutivos quedan consumidos sin documento
 * (DOBLE fantasma), y puede quedar un radicado que referencia un `salidaId`
 * inexistente.
 *
 * Rojo-primero (ADR-0015 #3): con el código actual esta prueba FALLA (fantasma);
 * con contador+documentos en una sola transacción, PASA. Es el control de
 * regresión del fix. Maneja el handler POST REAL; solo mockea fronteras. No
 * toca Firebase (ni real ni emulador).
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

vi.mock('@/lib/dependencias/registro-expres', () => ({
  validarRegistroExpres: () => null,
  construirPaqueteExpres: (_e: unknown, ids: { radicadoId: string; salidaId: string }) => ({
    radicado: { radicadoId: ids.radicadoId },
    salida: { salidaId: ids.salidaId },
    eventosEntrada: [],
  }),
}));

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const INICIAL: Record<string, number> = {
  'counters/radicados-2026': 40,
  'counters/salidas-2026': 4,
};
let contadores: Record<string, number>;
let persistidos: Map<string, unknown>;
/** Inyección: la persistencia del radicado falla (dentro o fuera de la tx). */
let fallaPersistenciaRadicado = true;

function falla(path: string): boolean {
  return fallaPersistenciaRadicado && path.startsWith('ventanilla_radicados/');
}

const fakeDb = {
  doc: (path: string) => ({
    path,
    id: path.split('/').pop(),
    set: async (data: unknown) => {
      if (falla(path)) throw new Error('fallo al persistir radicado (fuera de tx)');
      persistidos.set(path, data);
    },
  }),
  collection: () => ({ add: async () => ({ id: 'trz' }) }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { path: string; data: { ultimo?: number } }[] = [];
    const reservados = new Set<string>();
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      /* Reserva de unicidad del número emitido. Con semántica real: falla si
         el documento ya existe. Sin ella, este doble no representaba la
         transacción que corre de verdad y los casos de fallo pasaban por
         "tx.create no es una función" en vez de por el fallo inyectado. */
      create: (ref: { path: string }, data: { ultimo?: number }) => {
        if (falla(ref.path)) throw new Error('fallo al reservar el número (en tx)');
        if (reservados.has(ref.path)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
        reservados.add(ref.path);
        buffer.push({ path: ref.path, data });
      },
      set: (ref: { path: string }, data: { ultimo?: number }) => {
        if (falla(ref.path)) throw new Error('fallo al persistir radicado (en tx)');
        buffer.push({ path: ref.path, data });
      },
    };
    const result = await cb(tx); // si lanza, se propaga y NO se comitea (rollback)
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contadores[w.path] = w.data.ultimo!;
      else persistidos.set(w.path, w.data);
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => fakeDb }));

import { POST } from '@/app/api/dependencias/registro-expres/route';

beforeEach(() => {
  contadores = { ...INICIAL };
  persistidos = new Map();
  fallaPersistenciaRadicado = true;
});

describe('registro-expres — atomicidad consecutivo↔documento (H3)', () => {
  it('un fallo al persistir NO debe dejar consecutivos consumidos sin documento', async () => {
    const req = new Request('http://test/api/dependencias/registro-expres', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dependencia: 'VENTANILLA_UNICA' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500); // la persistencia del radicado falló

    const radAvanzo = contadores['counters/radicados-2026'] > INICIAL['counters/radicados-2026'];
    const salAvanzo = contadores['counters/salidas-2026'] > INICIAL['counters/salidas-2026'];
    const radPersistido = [...persistidos.keys()].some((k) => k.startsWith('ventanilla_radicados/'));
    const salPersistido = [...persistidos.keys()].some((k) => k.startsWith('ventanilla_salidas/'));

    // Invariante no-huérfano por serie: consecutivo consumido ⇒ documento existe.
    // Código actual (sets fuera de la tx): ambos contadores avanzan sin documento → FALLA (rojo).
    // Código atómico (contador+docs en una tx): el fallo revierte todo → PASA (verde).
    expect(radAvanzo && !radPersistido).toBe(false);
    expect(salAvanzo && !salPersistido).toBe(false);
  });
});
