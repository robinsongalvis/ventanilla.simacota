/**
 * Bloque A·A4/A5 — ejecución REAL de las rutas de handoff y comunicaciones
 * con dobles de Firestore/correo (mismo patrón que
 * `__tests__/expedientes-licencias-rutas-ejecucion.test.ts`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let sesion: { uid: string; nombre: string; rol: string; tenantId: string };
let store: Map<string, Record<string, unknown>>;
let correosEnviados: { to: string; subject: string; html: string }[];
let escrituras: { path: string; tipo: string }[];

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: class extends Error { status = 401; },
  requireActiveInternalUser: vi.fn(async () => sesion),
  canOperateTenant: (u: { rol: string; tenantId: string }, t: string) =>
    u.rol === 'ADMIN' || u.rol === 'RECEPCIONISTA' || (u.rol === 'FUNCIONARIO' && u.tenantId === t),
}));

function docRef(path: string) {
  return {
    path,
    id: path.split('/').pop()!,
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    collection: (sub: string) => collectionRef(`${path}/${sub}`),
    update: async (data: Record<string, unknown>) => {
      store.set(path, { ...(store.get(path) ?? {}), ...data });
      escrituras.push({ path, tipo: 'update' });
    },
  };
}
function collectionRef(basePath: string) {
  return {
    doc: (id?: string) => docRef(`${basePath}/${id ?? `auto-${Math.random().toString(36).slice(2)}`}`),
    where: (campo: string, _op: string, valor: unknown) => ({
      get: async () => {
        const leerRuta = (d: Record<string, unknown>) =>
          campo.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), d);
        const docs = [...store.entries()]
          .filter(([p, d]) => p.startsWith(`${basePath}/`) && p.slice(basePath.length + 1).split('/').length === 1 && leerRuta(d as Record<string, unknown>) === valor)
          .map(([p, d]) => ({ id: p.split('/').pop()!, data: () => d }));
        return { docs, size: docs.length };
      },
    }),
    get: async () => {
      const docs = [...store.entries()]
        .filter(([p]) => p.startsWith(`${basePath}/`) && p.slice(basePath.length + 1).split('/').length === 1)
        .map(([p, d]) => ({ id: p.split('/').pop()!, data: () => d }));
      return { docs, size: docs.length };
    },
    add: async (data: Record<string, unknown>) => {
      const id = `auto-${Math.random().toString(36).slice(2)}`;
      store.set(`${basePath}/${id}`, data);
      escrituras.push({ path: `${basePath}/${id}`, tipo: 'add' });
    },
  };
}
function fakeDb() {
  return {
    doc: (path: string) => docRef(path),
    collection: (name: string) => collectionRef(name),
    batch: () => ({
      set: (ref: { path: string }, data: Record<string, unknown>) => { store.set(ref.path, data); escrituras.push({ path: ref.path, tipo: 'set' }); },
      update: (ref: { path: string }, data: Record<string, unknown>) => { store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data }); escrituras.push({ path: ref.path, tipo: 'update' }); },
      commit: async () => {},
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        create: (ref: { path: string }, data: Record<string, unknown>) => {
          if (store.has(ref.path)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
          store.set(ref.path, data);
          escrituras.push({ path: ref.path, tipo: 'create' });
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
          escrituras.push({ path: ref.path, tipo: 'update' });
        },
      };
      return fn(tx);
    },
  };
}

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: () => fakeDb() }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/email/mailer', () => ({
  enviarEmail: vi.fn(async (p: { to: string; subject: string; html: string }) => { correosEnviados.push(p); }),
}));

import { POST as desdeRadicadoPOST } from '@/app/api/licencias/expedientes/desde-radicado/route';
import { GET as candidatosGET } from '@/app/api/licencias/radicados-candidatos/route';
import { POST as actuacionPOST } from '@/app/api/licencias/expedientes/[id]/actuaciones/route';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';

function req(body: unknown): Request {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function radicadoDoc(overrides: Record<string, unknown> = {}) {
  return {
    radicadoId: '1-110-202608-00000042',
    estadoActual: 'EN_PROCESO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    clasificacion: { oficinaDestino: 'SEC_PLANEACION' },
    solicitante: { nombreCompleto: 'Juan Pérez', numeroDocumento: '12345678', tipoDocumento: 'CC', email: 'juan@example.com' },
    control: { fechaRadicado: '2026-08-01T12:00:00.000Z' },
    vinculoExpediente: null,
    ...overrides,
  };
}

beforeEach(() => {
  store = new Map();
  correosEnviados = [];
  escrituras = [];
  sesion = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO', tenantId: 'SEC_PLANEACION' };
});

describe('POST .../expedientes/desde-radicado', () => {
  it('feliz: crea expediente + actuación + vínculo del radicado en la MISMA tx, y envía la constancia', async () => {
    store.set('ventanilla_radicados/1-110-202608-00000042', radicadoDoc());

    const res = await desdeRadicadoPOST(req({ radicadoId: '1-110-202608-00000042', subtipos: ['CONSTRUCCION'] }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.expediente.radicadoId).toBe('1-110-202608-00000042');
    expect(data.constanciaEnviada).toBe(true);

    const radicadoActualizado = store.get('ventanilla_radicados/1-110-202608-00000042') as { vinculoExpediente?: { expedienteId: string } };
    expect(radicadoActualizado.vinculoExpediente?.expedienteId).toBe(data.expediente.id);

    expect(correosEnviados).toHaveLength(1);
    expect(correosEnviados[0]!.to).toBe('juan@example.com');
    expect(correosEnviados[0]!.subject).toContain(data.expediente.numeroExpediente.numero);
  });

  it('SEGUNDA vinculación sobre el mismo radicado → 409, sin crear un segundo expediente', async () => {
    store.set('ventanilla_radicados/1-110-202608-00000042', radicadoDoc());
    await desdeRadicadoPOST(req({ radicadoId: '1-110-202608-00000042', subtipos: ['CONSTRUCCION'] }));
    const totalExpedientesTrasElPrimero = [...store.keys()].filter((k) => k.startsWith('expedientes/') && !k.includes('/actuaciones/')).length;

    const res2 = await desdeRadicadoPOST(req({ radicadoId: '1-110-202608-00000042', subtipos: ['CONSTRUCCION'] }));
    expect(res2.status).toBe(409);

    const totalExpedientesFinal = [...store.keys()].filter((k) => k.startsWith('expedientes/') && !k.includes('/actuaciones/')).length;
    expect(totalExpedientesFinal).toBe(totalExpedientesTrasElPrimero); // no creció
  });

  it('radicado SIN email → crea el expediente pero NO envía constancia', async () => {
    store.set('ventanilla_radicados/1-110-202608-00000042', radicadoDoc({ solicitante: { nombreCompleto: 'Juan Pérez', numeroDocumento: '12345678', tipoDocumento: 'CC', email: null } }));
    const res = await desdeRadicadoPOST(req({ radicadoId: '1-110-202608-00000042', subtipos: ['CONSTRUCCION'] }));
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.constanciaEnviada).toBe(false);
    expect(correosEnviados).toHaveLength(0);
  });

  it('radicado de OTRA dependencia → 400, no escribe nada', async () => {
    store.set('ventanilla_radicados/r-otra', radicadoDoc({ radicadoId: 'r-otra', clasificacion: { oficinaDestino: 'SEC_HACIENDA' } }));
    const res = await desdeRadicadoPOST(req({ radicadoId: 'r-otra', subtipos: ['CONSTRUCCION'] }));
    expect(res.status).toBe(400);
    expect(escrituras).toHaveLength(0);
  });

  it('radicado inexistente → 404', async () => {
    const res = await desdeRadicadoPOST(req({ radicadoId: 'no-existe', subtipos: ['CONSTRUCCION'] }));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/licencias/radicados-candidatos', () => {
  it('excluye vinculados, cerrados y de otro tenant', async () => {
    store.set('ventanilla_radicados/r1', radicadoDoc({ radicadoId: 'r1' })); // candidato
    store.set('ventanilla_radicados/r2', radicadoDoc({ radicadoId: 'r2', vinculoExpediente: { expedienteId: 'e1', numeroExpediente: 'DEMO-26-x', fecha: '2026-08-01T00:00:00.000Z' } })); // ya vinculado
    store.set('ventanilla_radicados/r3', radicadoDoc({ radicadoId: 'r3', estadoActual: 'RESUELTO' })); // cerrado
    store.set('ventanilla_radicados/r4', radicadoDoc({ radicadoId: 'r4', clasificacion: { oficinaDestino: 'SEC_HACIENDA' } })); // otro tenant

    const res = await candidatosGET();
    const data = await res.json();
    expect(data.radicados.map((r: { radicadoId: string }) => r.radicadoId)).toEqual(['r1']);
  });
});

describe('POST .../actuaciones — aviso de acta con/sin fechaComunicacion', () => {
  const DETALLE_OK = 'Falta el certificado de tradición y libertad actualizado del predio.';

  beforeEach(() => {
    store.set('expedientes/exp-1', {
      id: 'exp-1', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION',
      radicadoId: '1-110-202608-00000042', tramiteId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
      solicitanteNombre: 'Juan Pérez', numeroExpediente: { numero: 'DEMO-26-aaaa1111', serieId: 'demo', año: 2026 },
    });
    store.set('ventanilla_radicados/1-110-202608-00000042', radicadoDoc());
  });

  it('acta CON fechaComunicacion → envía aviso con fecha límite impresa', async () => {
    const res = await actuacionPOST(
      req({ tipo: 'acta-observaciones', detalle: DETALLE_OK, fechaComunicacion: '2026-08-05T12:00:00.000Z' }),
      ctx('exp-1'),
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.avisoEnviado).toBe(true);
    expect(correosEnviados).toHaveLength(1);
    expect(correosEnviados[0]!.html).toContain('Según la comunicación del acta, su plazo vence el');
  });

  it('acta SIN fechaComunicacion → envía aviso, pero sin fecha límite impresa', async () => {
    const res = await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('exp-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.avisoEnviado).toBe(true);
    expect(correosEnviados[0]!.html).not.toContain('su plazo vence el');
  });

  it('respuesta-subsanacion NO dispara el aviso de acta (solo acta-observaciones lo hace)', async () => {
    await actuacionPOST(req({ tipo: 'acta-observaciones', detalle: DETALLE_OK }), ctx('exp-1'));
    correosEnviados = [];
    const res = await actuacionPOST(req({ tipo: 'respuesta-subsanacion', detalle: DETALLE_OK }), ctx('exp-1'));
    expect(res.status).toBe(200);
    expect(correosEnviados).toHaveLength(0);
  });
});
