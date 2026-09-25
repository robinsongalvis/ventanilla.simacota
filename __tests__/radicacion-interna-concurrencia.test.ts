/**
 * Pieza angular (P2.1, Fase 2) — concurrencia + fallo del ENDPOINT REAL
 * `api/radicacion/interna` (blueprint §Pruebas, condición QA explícita: "el
 * test de concurrencia+fallo invoca el endpoint real... NO una
 * reimplementación inline — el harness `e2e/rules/h3-atomicidad-
 * integracion.test.mjs` es el antipatrón a NO copiar").
 *
 * Este archivo SÍ invoca `POST` importado directamente de
 * `app/api/radicacion/interna/route.ts` — la lógica de negocio bajo prueba
 * es la de producción, no una copia. Lo único que se sustituye es la
 * FRONTERA del SDK (Firestore Admin): un `runTransaction` fiel al
 * comportamiento observable de Firestore (serializable — nunca dos
 * transacciones concurrentes ven el mismo estado de un mismo documento a
 * la vez) mediante un mutex simple, exactamente como el emulador real
 * garantiza (Firestore serializa los commits en conflicto).
 *
 * Evidencia complementaria y de mayor fidelidad — CI, no local
 * ─────────────────────────────────────────────────────────────
 * El emulador de Firestore no corre en este entorno (Java 8 local; el
 * proyecto requiere Java 21 — ver `docs/` y memoria de dev-backend
 * "Entorno Firebase local"). La verificación de concurrencia REAL contra
 * el emulador (con reintento optimista genuino de Firestore, no un mutex
 * que lo emula) queda DIFERIDA al job `laboratorio-emulador` de CI
 * (`.github/workflows/ci.yml`, `npm run test:rules`), donde si se desea
 * fidelidad total habría que invocar el endpoint por HTTP contra un
 * servidor Next real + Auth emulator (fuera del alcance de esta pieza:
 * requiere infraestructura de CI adicional — devops/QA deciden si se
 * construye). Esta suite es la evidencia disponible AHORA, a nivel de
 * frontera del SDK, sobre el código de producción real.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
let persistidos: Map<string, Record<string, unknown>>;
/** Id de la invocación (por índice de llamada) que debe fallar dentro de
 *  su `tx.create` — simula un fallo de commit a mitad de una de las N
 *  transacciones concurrentes. `null` = ninguna falla. */
let invocacionQueFalla: number | null;
let contadorInvocaciones: number;

/**
 * Mutex mínimo: serializa las transacciones tal como Firestore garantiza
 * (serializable isolation) — nunca dos callbacks corren intercalados sobre
 * el mismo documento. No reimplementa la lógica de negocio (eso vive en
 * `route.ts`, importado más abajo); solo modela la garantía de la
 * FRONTERA del SDK que el código de producción asume.
 */
let colaTx: Promise<void> = Promise.resolve();
function conMutex<T>(fn: () => Promise<T>): Promise<T> {
  const resultado = colaTx.then(fn, fn);
  colaTx = resultado.then(() => undefined, () => undefined);
  return resultado;
}

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  runTransaction: (cb: (tx: unknown) => Promise<unknown>) => conMutex(async () => {
    const miInvocacion = contadorInvocaciones;
    contadorInvocaciones += 1;
    const buffer: { path: string; data: Record<string, unknown> }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      create: (ref: { path: string }, data: Record<string, unknown>) => {
        if (
          invocacionQueFalla === miInvocacion
          && ref.path.startsWith('ventanilla_radicados/')
          && !ref.path.includes('/trazabilidad/')
        ) {
          throw new Error(`fallo simulado en el commit de la invocación #${miInvocacion}`);
        }
        buffer.push({ path: ref.path, data });
      },
      set: (ref: { path: string }, data: Record<string, unknown>) => buffer.push({ path: ref.path, data }),
    };
    const result = await cb(tx); // si lanza, NADA del buffer se aplica (rollback real)
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contadores[w.path] = (w.data as { ultimo: number }).ultimo;
      else persistidos.set(w.path, w.data);
    }
    return result;
  }),
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({ file: () => ({ save: async () => {}, move: async () => {} }) }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

function formularioValido(nombre: string): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', nombre);
  f.append('numeroDocumento', '1098765432');
  f.append('asunto', 'Solicitud de concurrencia');
  f.append('descripcion', 'Radicación concurrente para probar el consecutivo.');
  return f;
}

function llamar(nombre: string): Promise<Response> {
  const req = new Request('http://test/api/radicacion/interna', {
    method: 'POST',
    body: formularioValido(nombre),
  });
  return POST(req);
}

function radicadosPersistidos(): { path: string; consecutivo: number }[] {
  return [...persistidos.entries()]
    .filter(([path]) => path.startsWith('ventanilla_radicados/') && !path.includes('/trazabilidad/'))
    .map(([path, data]) => ({
      path,
      consecutivo: (data.control as Record<string, unknown>).consecutivo as number,
    }));
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
  invocacionQueFalla = null;
  contadorInvocaciones = 0;
  colaTx = Promise.resolve();
});

describe('api/radicacion/interna — concurrencia + fallo (endpoint real, mock en la frontera del SDK)', () => {
  it('dos radicaciones concurrentes ⇒ consecutivos distintos y contiguos, sin hueco ni repetido', async () => {
    const [resA, resB] = await Promise.all([llamar('Ana'), llamar('Beto')]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const radicados = radicadosPersistidos();
    expect(radicados).toHaveLength(2);
    const consecutivos = radicados.map((r) => r.consecutivo).sort((a, b) => a - b);
    expect(consecutivos).toEqual([41, 42]);
    expect(contadores[COUNTER]).toBe(42);

    // Cada respuesta trae el consecutivo real que persistió (no un peek
    // desincronizado).
    const bodyA = await resA.json();
    const bodyB = await resB.json();
    expect(new Set([bodyA.consecutivo, bodyB.consecutivo])).toEqual(new Set([41, 42]));
  });

  it('fallo en el commit de una de dos concurrentes ⇒ la otra avanza SIN hueco; la fallida no consume consecutivo', async () => {
    // La invocación #1 (segunda en tomar el mutex, no necesariamente la
    // segunda en el array — el mutex serializa por orden de llegada al
    // `runTransaction`) fallará en su `tx.create`.
    invocacionQueFalla = 1;

    const [resA, resB] = await Promise.all([llamar('Carla'), llamar('Diego')]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 500]);

    const radicados = radicadosPersistidos();
    expect(radicados).toHaveLength(1); // solo la exitosa persistió
    // El consecutivo exitoso es 41: la que falló NO dejó un 42 fantasma
    // pendiente ni un hueco — el contador solo avanzó una vez.
    expect(radicados[0].consecutivo).toBe(41);
    expect(contadores[COUNTER]).toBe(41);

    // Ninguna trazabilidad quedó huérfana de la invocación fallida.
    const trazabilidades = [...persistidos.keys()].filter((k) => k.includes('/trazabilidad/'));
    expect(trazabilidades).toHaveLength(1);
  });
});
