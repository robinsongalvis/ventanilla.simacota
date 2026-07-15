/**
 * Bloque 2 (fix H3) · ruta `salidas/registrar` (serie salidas, PDF opcional).
 * Patrón staging → transacción → finalize. Esta prueba ejercita el núcleo de H3
 * (atomicidad consecutivo↔documento) con una salida SIN PDF: un fallo al
 * persistir el documento del libro NO debe dejar el consecutivo 2-SAL consumido
 * sin documento. Verde con el fix; rojo contra el código original (mutación por
 * git stash). Maneja el handler POST real; solo mockea fronteras. No toca Firebase.
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

vi.mock('@/lib/salidas/construir-salida', () => ({
  validarSalida: () => null,
  construirDocSalida: (_e: unknown, salidaId: string) => ({
    salidaId,
    radicadoEntradaId: null,
    destinatario: { nombre: 'Destino X' },
    dependenciaOrigen: 'VENTANILLA_UNICA',
  }),
  construirNotaSalida: () => 'nota',
}));

vi.mock('@/lib/server/salidas-security', () => ({
  uploadOficioSalidaAdmin: vi.fn(),
  moverOficioSalida: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const YEAR = new Date().getFullYear();
const COUNTER = `counters/salidas-${YEAR}`;
let contadores: Record<string, number>;
let persistidos: Map<string, unknown>;
let fallaPersistencia = true;

const falla = (path: string) => fallaPersistencia && path.startsWith('ventanilla_salidas/');

const fakeDb = {
  doc: (path: string) => ({
    path,
    id: path.split('/').pop(),
    get: async () => ({ exists: true }),
    set: async (data: unknown) => {
      if (falla(path)) throw new Error('fallo al persistir salida (fuera de tx)');
      persistidos.set(path, data);
    },
  }),
  collection: () => ({ add: async () => ({ id: 'trz' }) }),
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
        if (falla(ref.path)) throw new Error('fallo al persistir salida (en tx)');
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

import { POST } from '@/app/api/salidas/registrar/route';

function formulario(): FormData {
  const f = new FormData();
  f.append('tipoSalida', 'OFICIO_INDEPENDIENTE');
  f.append('destinatarioNombre', 'Destino X');
  f.append('asunto', 'Asunto de prueba');
  f.append('dependenciaOrigen', 'VENTANILLA_UNICA');
  f.append('firmanteNombre', 'Firmante X');
  return f;
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
  fallaPersistencia = true;
});

describe('salidas/registrar — atomicidad consecutivo↔documento (H3)', () => {
  it('un fallo al persistir NO debe dejar el consecutivo 2-SAL consumido sin documento', async () => {
    const req = new Request('http://test/api/salidas/registrar', { method: 'POST', body: formulario() });
    const res = await POST(req);
    expect(res.status).toBe(500);

    const avanzo = contadores[COUNTER] > 40;
    const persistido = [...persistidos.keys()].some((k) => k.startsWith('ventanilla_salidas/'));

    // Invariante no-huérfano: consecutivo consumido ⇒ documento existe.
    expect(avanzo && !persistido).toBe(false);
  });
});
