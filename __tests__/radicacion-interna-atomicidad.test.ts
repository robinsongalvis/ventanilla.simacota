/**
 * Pieza angular (P2.1, Fase 2) — invariante NUEVO de `api/radicacion/interna`:
 * si la transacción aborta, NI el radicado NI el evento de trazabilidad
 * quedan parciales, y el consecutivo NO se consume. A diferencia del patrón
 * hoy en producción (`api/radicacion`, `salidas/registrar`), donde la
 * trazabilidad se escribe con `addDoc`/`.add()` POST-COMMIT (fuera de la
 * tx), esta ruta escribe la trazabilidad con `tx.set` e id determinístico
 * DENTRO de la misma transacción — por eso un fallo del `tx.create` del
 * radicado también debe arrastrar consigo la trazabilidad, no solo el
 * documento.
 *
 * Maneja el handler POST real; solo mockea la frontera Admin SDK (Firestore
 * + Storage). No toca Firebase real ni el emulador — evidencia
 * complementaria (concurrencia real con reintento optimista) vive en
 * `__tests__/radicacion-interna-concurrencia.test.ts` (mock más fiel a
 * nivel de la frontera del SDK) y queda diferida al emulador de CI para
 * confirmación final (ver reporte de la Fase 2).
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
      uid: 'u1', nombre: 'Recepción', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA', activo: true,
    })),
  };
});

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const YEAR = new Date().getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

let contadores: Record<string, number>;
let persistidos: Map<string, unknown>;
/** Cuando true, el `tx.create` del radicado lanza (simula fallo dentro de la tx). */
let fallaCreateRadicado = true;

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  collection: () => ({ add: async () => ({ id: 'trz-no-deberia-usarse' }) }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { tipo: 'counter' | 'radicado' | 'trazabilidad'; path: string; data: unknown }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      create: (ref: { path: string }, data: unknown) => {
        if (fallaCreateRadicado && ref.path.startsWith('ventanilla_radicados/') && !ref.path.includes('/trazabilidad/')) {
          throw new Error('fallo simulado: tx.create del radicado (colisión fail-closed)');
        }
        buffer.push({ tipo: 'radicado', path: ref.path, data });
      },
      set: (ref: { path: string }, data: unknown) => {
        if (ref.path.startsWith('counters/')) {
          buffer.push({ tipo: 'counter', path: ref.path, data });
        } else {
          buffer.push({ tipo: 'trazabilidad', path: ref.path, data });
        }
      },
    };
    const result = await cb(tx); // si lanza, se propaga: NADA se aplica (rollback real de un mock fiel)
    for (const w of buffer) {
      if (w.tipo === 'counter') contadores[w.path] = (w.data as { ultimo: number }).ultimo;
      else persistidos.set(w.path, w.data);
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({ file: () => ({ save: async () => {}, move: async () => {} }) }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

function formularioValido(): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', 'Ana Torres');
  f.append('numeroDocumento', '1098765432');
  f.append('asunto', 'Solicitud de certificado');
  f.append('descripcion', 'El ciudadano solicita certificado de residencia.');
  return f;
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
  fallaCreateRadicado = true;
});

describe('api/radicacion/interna — tx aborta ⇒ ni radicado ni trazabilidad ni consecutivo (invariante nuevo)', () => {
  it('un fallo en tx.create NO debe dejar consecutivo consumido, radicado, ni evento de trazabilidad', async () => {
    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: formularioValido() });
    const res = await POST(req);
    expect(res.status).toBe(500);

    const avanzo = contadores[COUNTER] > 40;
    const hayRadicado = [...persistidos.keys()].some((k) => k.startsWith('ventanilla_radicados/') && !k.includes('/trazabilidad/'));
    const hayTrazabilidad = [...persistidos.keys()].some((k) => k.includes('/trazabilidad/'));

    expect(avanzo).toBe(false);
    expect(hayRadicado).toBe(false);
    expect(hayTrazabilidad).toBe(false);
  });

  it('éxito: consecutivo, radicado Y trazabilidad (RADICACION) se confirman juntos', async () => {
    fallaCreateRadicado = false;
    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: formularioValido() });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(contadores[COUNTER]).toBe(41);
    const radicadoId = [...persistidos.keys()].find((k) => k.startsWith('ventanilla_radicados/') && !k.includes('/trazabilidad/'));
    expect(radicadoId).toBeTruthy();
    const trazId = [...persistidos.keys()].find((k) => k.endsWith('_RADICACION'));
    expect(trazId).toBeTruthy();
  });
});
