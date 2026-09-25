/**
 * Bloque 2 (fix H3) · ruta `radicacion` ciudadana (serie radicados, adjuntos).
 * Patrón staging → transacción → finalize. Esta prueba ejercita el núcleo de H3
 * (atomicidad consecutivo↔documento) con un request SIN adjuntos: un fallo al
 * persistir el radicado NO debe dejar el consecutivo consumido sin documento.
 * Verde con contador+documento en una transacción; rojo si la persistencia
 * vuelve a quedar fuera de la transacción (demostrado por mutación). Maneja el
 * handler POST real; solo mockea la frontera Admin SDK. No toca Firebase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const YEAR = new Date().getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

let contadores: Record<string, number>;
let persistidos: Map<string, unknown>;
let fallaPersistencia = true;

const falla = (path: string) => fallaPersistencia && path.startsWith('ventanilla_radicados/');

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
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contadores[w.path] = w.data.ultimo!;
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

import { POST } from '@/app/api/radicacion/route';

function formularioValido(): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('canalRespuesta', 'CORREO');
  f.append('nombre', 'Juan Perez Prueba');
  f.append('email', 'juan.prueba@example.com');
  f.append('telefono', '3001234567');
  f.append('direccion', 'Calle 1 # 2-3');
  f.append('descripcion', 'Solicito informacion sobre el tramite de certificados de residencia.');
  return f;
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
  fallaPersistencia = true;
});

describe('radicacion ciudadana — atomicidad consecutivo↔documento (H3)', () => {
  it('un fallo al persistir NO debe dejar el consecutivo consumido sin documento', async () => {
    const req = new Request('http://test/api/radicacion', { method: 'POST', body: formularioValido() });
    const res = await POST(req);
    expect(res.status).toBe(500);

    const avanzo = contadores[COUNTER] > 40;
    const persistido = [...persistidos.keys()].some((k) => k.startsWith('ventanilla_radicados/'));

    // Invariante no-huérfano: consecutivo consumido ⇒ documento existe.
    expect(avanzo && !persistido).toBe(false);
  });
});
