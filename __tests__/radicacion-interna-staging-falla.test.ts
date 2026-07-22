/**
 * @vitest-environment node
 *
 * Pieza angular (P2.1, Fase 2) — fallo en STAGING (antes de abrir la
 * transacción): un adjunto que falla al subirse a `_pendientes/**` NO debe
 * consumir consecutivo ni crear radicado. La subida a staging ocurre ANTES
 * de `leerConsecutivosLegales`/la tx, exactamente como en `api/radicacion`
 * y `salidas/registrar` (H3, Bloque 2).
 *
 * `@vitest-environment node`: ver nota en
 * `radicacion-interna-magic-bytes.test.ts` (File de otro realm en jsdom).
 *
 * Maneja el handler POST real; solo mockea la frontera Admin SDK.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/server/internal-auth', () => {
  class InternalAuthError extends Error {
    status: 401 | 403;
    constructor(message: string, status: 401 | 403 = 401) {
      super(message);
      this.status = status;
    }
  }
  return {
    InternalAuthError,
    requireActiveInternalUser: vi.fn(async () => ({
      uid: 'u1', nombre: 'Recepción', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA', activo: true,
    })),
  };
});

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const YEAR = new Date().getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

let contadores: Record<string, number>;
let persistidos: Map<string, unknown>;
let tránsaccionInvocada = false;

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  collection: () => ({ add: async () => ({ id: 'trz' }) }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    tránsaccionInvocada = true;
    const buffer: { path: string; data: unknown }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      create: (ref: { path: string }, data: unknown) => buffer.push({ path: ref.path, data }),
      set: (ref: { path: string }, data: unknown) => buffer.push({ path: ref.path, data }),
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contadores[w.path] = (w.data as { ultimo: number }).ultimo;
      else persistidos.set(w.path, w.data);
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: () => ({
        save: async () => { throw new Error('fallo simulado de Storage en staging'); },
        move: async () => {},
      }),
    }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

function formularioConAdjunto(): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', 'Carlos Ramirez');
  f.append('numeroDocumento', '1098765432');
  f.append('asunto', 'Solicitud con adjunto');
  f.append('descripcion', 'El ciudadano adjunta copia de cedula.');
  const bytesPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
  const archivo = new File([bytesPdf], 'cedula.pdf', { type: 'application/pdf' });
  f.append('archivos', archivo);
  return f;
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
  tránsaccionInvocada = false;
});

describe('api/radicacion/interna — fallo en staging (antes de la tx)', () => {
  it('un fallo al subir el adjunto a _pendientes NO consume consecutivo ni abre la transacción', async () => {
    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: formularioConAdjunto() });
    const res = await POST(req);
    expect(res.status).toBe(500);

    expect(tránsaccionInvocada).toBe(false);
    expect(contadores[COUNTER]).toBe(40); // sin avanzar
    expect(persistidos.size).toBe(0); // 0 radicado
  });
});
