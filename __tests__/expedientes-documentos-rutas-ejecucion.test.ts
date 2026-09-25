/**
 * Bloque A·A2 — ejecución REAL de las rutas de documentos/descarga con
 * dobles de Firestore/Storage (mismo patrón que
 * `__tests__/expedientes-licencias-rutas-ejecucion.test.ts` /
 * `__tests__/subsanacion-rutas-ejecucion.test.ts`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

let sesion: { uid: string; nombre: string; rol: string; tenantId: string };
let store: Map<string, Record<string, unknown>>;
let storageArchivos: Map<string, Buffer>;
let escrituras: { path: string; tipo: 'set' | 'update' | 'create'; data: Record<string, unknown> }[];

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
      escrituras.push({ path, tipo: 'update', data });
    },
  };
}
function collectionRef(basePath: string) {
  return {
    doc: (id?: string) => docRef(`${basePath}/${id ?? `auto-${Math.random().toString(36).slice(2)}`}`),
    where: (campo: string, _op: string, valor: unknown) => ({
      get: async () => {
        const docs = [...store.entries()]
          .filter(([p, d]) => p.startsWith(`${basePath}/`) && p.slice(basePath.length + 1).split('/').length === 1 && (d as Record<string, unknown>)[campo] === valor)
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
  };
}

function fakeDb() {
  return {
    doc: (path: string) => docRef(path),
    collection: (name: string) => collectionRef(name),
    batch: () => ({
      set: (ref: { path: string }, data: Record<string, unknown>) => { store.set(ref.path, data); escrituras.push({ path: ref.path, tipo: 'set', data }); },
      update: (ref: { path: string }, data: Record<string, unknown>) => { store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data }); escrituras.push({ path: ref.path, tipo: 'update', data }); },
      commit: async () => {},
    }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: async (ref: { path: string }) => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        create: (ref: { path: string }, data: Record<string, unknown>) => {
          if (store.has(ref.path)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
          store.set(ref.path, data);
          escrituras.push({ path: ref.path, tipo: 'create', data });
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
          escrituras.push({ path: ref.path, tipo: 'update', data });
        },
      };
      return fn(tx);
    },
  };
}

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb(),
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        save: async (buffer: Buffer) => { storageArchivos.set(path, buffer); },
        move: async (destino: string) => {
          const bytes = storageArchivos.get(path);
          if (bytes) { storageArchivos.set(destino, bytes); storageArchivos.delete(path); }
        },
        download: async () => {
          const bytes = storageArchivos.get(path);
          if (!bytes) throw new Error(`NOT_FOUND: ${path}`);
          return [bytes];
        },
        getSignedUrl: async () => ['https://signed.example/x'],
      }),
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/seguridad/auditoria-descargas', () => ({ registrarDescargaAuditoria: vi.fn(async () => {}) }));
vi.mock('@/lib/ai/rate-limit', () => ({ getClientIp: () => '127.0.0.1' }));

import { POST as documentosPOST } from '@/app/api/licencias/expedientes/[id]/documentos/route';
import { PATCH as contextoPATCH } from '@/app/api/licencias/expedientes/[id]/contexto/route';
import { GET as archivoGET } from '@/app/api/interno/archivo/route';

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const PDF_BUFFER = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(50, 0x20)]);

/**
 * Devuelve un objeto tipo `Request` cuyo `.formData()` entrega el
 * `FormData` construido AQUÍ MISMO, sin serializar/reparsear bytes
 * multipart reales — `Request`/`FormData` de jsdom (entorno de este
 * proyecto, `vitest.config.ts`) no reconstruye instancias de `File`
 * consistentes al ida-y-vuelta a través de un body multipart real (el
 * `File` que sale de `request.formData()` no es `instanceof` el mismo
 * `File` global tras la serialización). Evitar esa serialización deja el
 * mismo `File`/`FormData` que la ruta recibe, sin depender de un detalle
 * de implementación de jsdom ajeno a lo que se está probando.
 */
function multipartRequest(campos: Record<string, string>, archivo?: { nombre: string; buffer: Buffer; tipo: string }): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  if (archivo) {
    fd.set('archivo', new File([new Uint8Array(archivo.buffer)], archivo.nombre, { type: archivo.tipo }));
  }
  return { formData: async () => fd } as unknown as Request;
}

process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket';

beforeEach(() => {
  store = new Map();
  storageArchivos = new Map();
  escrituras = [];
  sesion = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO', tenantId: 'SEC_PLANEACION' };
  store.set('expedientes/exp-1', {
    id: 'exp-1', tenantId: 'SEC_PLANEACION', estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION', aportes: [],
    contexto: {},
  });
});

describe('POST .../documentos — subida feliz (v0001 + espejo + aporte en UNA tx)', () => {
  it('sin requisitoId: crea documento lógico + versión v0001; mueve el binario a la ruta final', async () => {
    const req = multipartRequest({}, { nombre: 'anexo.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.numeroVersion).toBe(1);
    expect(data.documentoNuevo).toBe(true);
    expect(data.hashSha256).toBe(createHash('sha256').update(PDF_BUFFER).digest('hex'));

    // El binario terminó en la ruta FINAL (moverEnStorage), no en staging.
    expect(storageArchivos.has(data.storagePath)).toBe(true);
    expect([...storageArchivos.keys()].some((p) => p.includes('_pendientes'))).toBe(false);
  });

  it('con requisitoId válido: el aporte queda APORTADO enlazado al documento LÓGICO', async () => {
    const req = multipartRequest({ requisitoId: 'certificado-tradicion-libertad' }, { nombre: 'cert.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    const data = await res.json();

    expect(res.status).toBe(201);
    const expediente = store.get('expedientes/exp-1') as { aportes: { requisitoId: string; estado: string; documentoIds: string[] }[] };
    const aporte = expediente.aportes.find((a) => a.requisitoId === 'certificado-tradicion-libertad');
    expect(aporte?.estado).toBe('APORTADO');
    expect(aporte?.documentoIds).toEqual([data.documentoId]);
  });

  it('requisitoId inexistente en la Definición → 400, no escribe nada', async () => {
    const req = multipartRequest({ requisitoId: 'no-existe' }, { nombre: 'x.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    expect(res.status).toBe(400);
    expect(escrituras).toHaveLength(0);
  });

  it('segunda subida con el MISMO requisitoId ya aportado → v0002 sobre el mismo documento lógico', async () => {
    const req1 = multipartRequest({ requisitoId: 'certificado-tradicion-libertad' }, { nombre: 'cert.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res1 = await documentosPOST(req1, ctx('exp-1'));
    const data1 = await res1.json();

    const buffer2 = Buffer.concat([PDF_BUFFER, Buffer.from('v2')]);
    const req2 = multipartRequest({ requisitoId: 'certificado-tradicion-libertad' }, { nombre: 'cert-corregido.pdf', buffer: buffer2, tipo: 'application/pdf' });
    const res2 = await documentosPOST(req2, ctx('exp-1'));
    const data2 = await res2.json();

    expect(res2.status).toBe(201);
    expect(data2.documentoId).toBe(data1.documentoId); // MISMO documento lógico
    expect(data2.numeroVersion).toBe(2);
    expect(data2.documentoNuevo).toBe(false);
  });

  it('archivo con MIME declarado PDF pero bytes falsos (magic-bytes falla) → 400, no escribe', async () => {
    const req = multipartRequest({}, { nombre: 'x.pdf', buffer: Buffer.from('no es un pdf'), tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    expect(res.status).toBe(400);
    expect(escrituras).toHaveLength(0);
  });

  it('expediente EN_FIRME (cerrado) → 409', async () => {
    store.set('expedientes/exp-1', { ...store.get('expedientes/exp-1'), estadoJuridico: 'EN_FIRME' });
    const req = multipartRequest({}, { nombre: 'x.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    expect(res.status).toBe(409);
  });
});

describe('POST .../documentos — revalidación server de NO_APLICA (endurecimiento pre-reunión, defensa en profundidad)', () => {
  // 'poder-apoderado' es CONDICIONAL: IGUAL esApoderado=true (Definición real sembrada).
  const REQUISITO_CONDICIONAL = 'poder-apoderado';

  it('contexto YA registra que el requisito CONDICIONAL no aplica al caso (esApoderado=false) → 422, no escribe nada', async () => {
    store.set('expedientes/exp-1', { ...store.get('expedientes/exp-1'), contexto: { esApoderado: false } });
    const req = multipartRequest({ requisitoId: REQUISITO_CONDICIONAL }, { nombre: 'poder.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toBe('El requisito no aplica al caso según los hechos registrados; ajuste los hechos del caso si corresponde.');
    expect(escrituras).toHaveLength(0);
  });

  it('contexto SIN el hecho definido aún (esApoderado ausente → INDETERMINADO) → permite subir (fail-open deliberado)', async () => {
    // contexto: {} por defecto en beforeEach — la clave "esApoderado" no está definida.
    const req = multipartRequest({ requisitoId: REQUISITO_CONDICIONAL }, { nombre: 'poder.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.documentoNuevo).toBe(true);
  });

  it('contexto SÍ aplica (esApoderado=true) → permite subir normalmente', async () => {
    store.set('expedientes/exp-1', { ...store.get('expedientes/exp-1'), contexto: { esApoderado: true } });
    const req = multipartRequest({ requisitoId: REQUISITO_CONDICIONAL }, { nombre: 'poder.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    expect(res.status).toBe(201);
  });
});

describe('PATCH .../contexto', () => {
  it('clave declarada → 200, contexto actualizado', async () => {
    const req = new Request('http://x', { method: 'PATCH', body: JSON.stringify({ esApoderado: true }) });
    const res = await contextoPATCH(req, ctx('exp-1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.contexto.esApoderado).toBe(true);
  });

  it('clave NO declarada → 400', async () => {
    const req = new Request('http://x', { method: 'PATCH', body: JSON.stringify({ claveInventada: 1 }) });
    const res = await contextoPATCH(req, ctx('exp-1'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/interno/archivo?path=expedientes/... — descarga con validación de hash', () => {
  async function subirDocumentoDePrueba() {
    const req = multipartRequest({}, { nombre: 'anexo.pdf', buffer: PDF_BUFFER, tipo: 'application/pdf' });
    const res = await documentosPOST(req, ctx('exp-1'));
    return res.json();
  }

  it('hash coincide → 200 con los bytes del documento', async () => {
    const subida = await subirDocumentoDePrueba();
    const res = await archivoGET(new Request(`http://x?path=${encodeURIComponent(subida.storagePath)}`));
    expect(res.status).toBe(200);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.equals(PDF_BUFFER)).toBe(true);
  });

  it('hash NO coincide (binario alterado en Storage) → 500, NO entrega bytes', async () => {
    const subida = await subirDocumentoDePrueba();
    storageArchivos.set(subida.storagePath, Buffer.from('bytes manipulados'));
    const res = await archivoGET(new Request(`http://x?path=${encodeURIComponent(subida.storagePath)}`));
    expect(res.status).toBe(500);
  });

  it('otro tenant (FUNCIONARIO de SEC_HACIENDA) → 403 (anti-IDOR por tenant del expediente)', async () => {
    const subida = await subirDocumentoDePrueba();
    sesion = { uid: 'u2', nombre: 'X', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' };
    const res = await archivoGET(new Request(`http://x?path=${encodeURIComponent(subida.storagePath)}`));
    expect(res.status).toBe(403);
  });

  it('ruta de STAGING (_pendientes) → 400 (nunca autoriza, el regex la excluye estructuralmente)', async () => {
    const res = await archivoGET(new Request('http://x?path=expedientes/_pendientes/req-1/archivo.pdf'));
    expect(res.status).toBe(400);
  });

  it('expediente inexistente → 404', async () => {
    const res = await archivoGET(new Request('http://x?path=expedientes/no-existe/doc-1/v0001/archivo.pdf'));
    expect(res.status).toBe(404);
  });
});
