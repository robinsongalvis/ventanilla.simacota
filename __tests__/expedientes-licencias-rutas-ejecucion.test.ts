/**
 * Bloque "Integración UI y demo" — ejecución REAL de las rutas de
 * expedientes de licencias (mismo patrón que
 * `__tests__/subsanacion-rutas-ejecucion.test.ts`): mockea solo fronteras
 * (auth, firebase-admin, logger) e invoca los handlers reales; la lógica
 * de decisión (`lib/server/expedientes-licencias.ts`) corre de verdad.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let sesion: { uid: string; nombre: string; rol: string; tenantId: string };

/** Store en memoria: path completo → datos. */
let store: Map<string, Record<string, unknown>>;
/** Cada write (set/update/create) queda registrado aquí para aserciones. */
let escrituras: { path: string; tipo: 'set' | 'update'; data: Record<string, unknown> }[];

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: class extends Error { status = 401; },
  requireActiveInternalUser: vi.fn(async () => sesion),
  canOperateTenant: (u: { rol: string; tenantId: string }, t: string) =>
    u.rol === 'ADMIN' || u.rol === 'RECEPCIONISTA' || (u.rol === 'FUNCIONARIO' && u.tenantId === t),
}));

function docRef(path: string) {
  return {
    path,
    get: async () => {
      const data = store.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    collection: (sub: string) => collectionRef(`${path}/${sub}`),
  };
}

function collectionRef(basePath: string) {
  const docsBajoEsteBase = () =>
    [...store.entries()].filter(([p]) => p.startsWith(`${basePath}/`) && p.slice(basePath.length + 1).split('/').length === 1);

  const construir = (ordenarPor?: { campo: string; direccion: 'asc' | 'desc' }, filtro?: { campo: string; valor: unknown }) => ({
    doc: (id: string) => docRef(`${basePath}/${id}`),
    where: (campo: string, _op: string, valor: unknown) => construir(ordenarPor, { campo, valor }),
    orderBy: (campo: string, direccion: 'asc' | 'desc' = 'asc') => construir({ campo, direccion }, filtro),
    get: async () => {
      let docs = docsBajoEsteBase().map(([p, data]) => ({ id: p.split('/').pop()!, data: () => data }));
      if (filtro) docs = docs.filter((d) => (d.data() as Record<string, unknown>)[filtro.campo] === filtro.valor);
      if (ordenarPor) {
        docs = docs.sort((a, b) => {
          const va = String((a.data() as Record<string, unknown>)[ordenarPor.campo] ?? '');
          const vb = String((b.data() as Record<string, unknown>)[ordenarPor.campo] ?? '');
          return ordenarPor.direccion === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        });
      }
      return { docs, size: docs.length };
    },
  });
  return construir();
}

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (path: string) => docRef(path),
    collection: (name: string) => collectionRef(name),
    batch: () => ({
      set: (ref: { path: string }, data: Record<string, unknown>) => {
        escrituras.push({ path: ref.path, tipo: 'set', data });
        store.set(ref.path, data);
      },
      update: (ref: { path: string }, data: Record<string, unknown>) => {
        escrituras.push({ path: ref.path, tipo: 'update', data });
        store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
      },
      commit: async () => {},
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

import { POST as crearPOST, GET as bandejaGET } from '@/app/api/licencias/expedientes/route';
import { GET as detalleGET } from '@/app/api/licencias/expedientes/[id]/route';
import { POST as actuacionPOST } from '@/app/api/licencias/expedientes/[id]/actuaciones/route';

function req(body: unknown, method = 'POST'): Request {
  return new Request('http://x', { method, body: method === 'GET' ? undefined : JSON.stringify(body) });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BODY_VALIDO = { solicitanteNombre: 'Juan Pérez', solicitanteDocumento: '12345678', subtipos: ['CONSTRUCCION'] };

beforeEach(() => {
  store = new Map();
  escrituras = [];
  sesion = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO', tenantId: 'SEC_PLANEACION' };
});

describe('POST /api/licencias/expedientes — FAIL-CLOSED: demo NUNCA escribe counters ni unicidad_expedientes', () => {
  it('crea el expediente y su primera actuación; NINGUNA escritura toca counters/ ni unicidad_expedientes/', async () => {
    const res = await crearPOST(req(BODY_VALIDO));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.expediente.esPrueba).toBe(true);

    expect(escrituras.length).toBeGreaterThan(0);
    for (const e of escrituras) {
      expect(e.path).not.toMatch(/^counters\//);
      expect(e.path).not.toMatch(/^unicidad_expedientes\//);
      expect(e.path).toMatch(/^expedientes\//);
    }
  });

  it('la primera actuación queda en la subcolección actuaciones del expediente', async () => {
    const res = await crearPOST(req(BODY_VALIDO));
    const data = await res.json();
    const actuacionEscrita = escrituras.find((e) => e.path.includes('/actuaciones/'));
    expect(actuacionEscrita).toBeDefined();
    expect(actuacionEscrita?.path.startsWith(`expedientes/${data.expediente.id}/actuaciones/`)).toBe(true);
  });

  it('subtipo en cuarentena (LA) → 422, no escribe nada', async () => {
    const res = await crearPOST(req({ ...BODY_VALIDO, subtipos: ['LA'] }));
    expect(res.status).toBe(422);
    expect(escrituras).toHaveLength(0);
  });

  it('FUNCIONARIO de otro tenant → 403, no escribe nada', async () => {
    sesion = { uid: 'u1', nombre: 'X', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' };
    const res = await crearPOST(req(BODY_VALIDO));
    expect(res.status).toBe(403);
    expect(escrituras).toHaveLength(0);
  });
});

describe('GET /api/licencias/expedientes — bandeja del tenant', () => {
  it('devuelve solo expedientes del tenant, ordenados por creadoEn desc', async () => {
    store.set('expedientes/e1', { id: 'e1', tenantId: 'SEC_PLANEACION', creadoEn: '2026-01-01T00:00:00.000Z' });
    store.set('expedientes/e2', { id: 'e2', tenantId: 'SEC_PLANEACION', creadoEn: '2026-06-01T00:00:00.000Z' });
    store.set('expedientes/e3', { id: 'e3', tenantId: 'SEC_HACIENDA', creadoEn: '2026-08-01T00:00:00.000Z' });

    const res = await bandejaGET();
    const data = await res.json();

    expect(data.expedientes.map((e: { id: string }) => e.id)).toEqual(['e2', 'e1']); // e3 excluido, e2 (más reciente) primero
  });
});

describe('GET /api/licencias/expedientes/[id] — detalle + actuaciones ordenadas', () => {
  it('devuelve el expediente y sus actuaciones en orden ascendente de fecha', async () => {
    store.set('expedientes/e1', { id: 'e1', tenantId: 'SEC_PLANEACION' });
    store.set('expedientes/e1/actuaciones/a2', { id: 'a2', fecha: '2026-06-02T00:00:00.000Z', tipo: 'respuesta-subsanacion' });
    store.set('expedientes/e1/actuaciones/a1', { id: 'a1', fecha: '2026-06-01T00:00:00.000Z', tipo: 'acta-observaciones' });

    const res = await detalleGET(req(null, 'GET'), ctx('e1'));
    const data = await res.json();

    expect(data.expediente.id).toBe('e1');
    expect(data.actuaciones.map((a: { id: string }) => a.id)).toEqual(['a1', 'a2']);
  });

  it('expediente inexistente → 404', async () => {
    const res = await detalleGET(req(null, 'GET'), ctx('no-existe'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/licencias/expedientes/[id]/actuaciones — acta única + transición', () => {
  beforeEach(() => {
    store.set('expedientes/e1', {
      id: 'e1', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION',
    });
  });

  const DETALLE_OK = 'Falta el certificado de tradición y libertad actualizado del predio.';

  it('primera acta-observaciones → 200, transiciona a CON_ACTA_DE_OBSERVACIONES', async () => {
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.estadoJuridico).toBe('CON_ACTA_DE_OBSERVACIONES');
    expect(store.get('expedientes/e1')?.estadoJuridico).toBe('CON_ACTA_DE_OBSERVACIONES');
  });

  it('acta ÚNICA: una segunda acta-observaciones → 409, no vuelve a escribir', async () => {
    await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    const escriturasTrasActa1 = escrituras.length;

    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(409);
    expect(escrituras.length).toBe(escriturasTrasActa1); // sin nueva escritura
  });

  it('respuesta-subsanacion tras el acta → 200, transiciona a EN_VIABILIDAD', async () => {
    await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    const res = await actuacionPOST(req({ tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }), ctx('e1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.estadoJuridico).toBe('EN_VIABILIDAD');
  });

  it('respuesta-subsanacion SIN acta previa → 409', async () => {
    const res = await actuacionPOST(req({ tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(409);
  });

  it('tipo no permitido → 400, no escribe', async () => {
    const res = await actuacionPOST(req({ tipo: 'acto-viabilidad', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(400);
    expect(escrituras).toHaveLength(0);
  });

  it('expediente inexistente → 404', async () => {
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('no-existe'));
    expect(res.status).toBe(404);
  });

  it('FUNCIONARIO de otro tenant → 403', async () => {
    sesion = { uid: 'u1', nombre: 'X', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' };
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('e1'));
    expect(res.status).toBe(403);
  });
});
