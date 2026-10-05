import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

type Documento = Record<string, unknown>;
type Referencia = {
  tipo: 'documento';
  path: string;
  id: string;
  get: () => Promise<Snapshot>;
};
type Consulta = { tipo: 'consulta'; path: string };
type Snapshot = { exists: boolean; data: () => Documento | undefined };
type DocumentoConsulta = { id: string; data: () => Documento };
type SnapshotConsulta = { docs: DocumentoConsulta[] };
type Lectura = Referencia | Consulta;
type Escritura =
  | { tipo: 'set'; ref: Referencia; valor: Documento; merge: boolean }
  | { tipo: 'create'; ref: Referencia; valor: Documento };
type Transaccion = {
  get: (ref: Lectura) => Promise<Snapshot | SnapshotConsulta>;
  set: (ref: Referencia, valor: Documento, opciones: { merge: boolean }) => void;
  create: (ref: Referencia, valor: Documento) => void;
};

const mocks = vi.hoisted(() => ({
  autenticar: vi.fn(),
  obtenerDb: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  create: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('@/lib/server/internal-auth-http', () => ({ autenticarUsuarioInterno: mocks.autenticar }));
vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: mocks.obtenerDb }));

import { GET, POST } from '@/app/api/interno/consecutivo-radicacion/route';

const usuario = {
  uid: 'admin-controlado',
  nombre: 'Administración de prueba',
  rol: 'ADMIN',
  tenantId: 'VENTANILLA_UNICA',
};
let documentos: Map<string, Documento>;
let secuenciaAuditoria: number;
let revision: number;
let fallarCreate: boolean;

function solicitud(primerNumero: unknown = 1745): Request {
  return new Request('http://localhost/api/interno/consecutivo-radicacion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ primerNumero }),
  });
}

function referencia(path: string): Referencia {
  return {
    tipo: 'documento',
    path,
    id: path.split('/').at(-1) ?? '',
    get: async () => snapshot(path),
  };
}

function snapshot(path: string): Snapshot {
  return { exists: documentos.has(path), data: () => documentos.get(path) };
}

function snapshotConsulta(path: string): SnapshotConsulta {
  const prefijo = `${path}/`;
  return {
    docs: [...documentos.entries()]
      .filter(([key]) => key.startsWith(prefijo) && !key.slice(prefijo.length).includes('/'))
      .map(([key, data]) => ({ id: key.slice(prefijo.length), data: () => data })),
  };
}

function crearDb() {
  return {
    doc: (path: string) => referencia(path),
    collection: (path: string) => ({
      tipo: 'consulta' as const,
      path,
      doc: (id = `auditoria-${++secuenciaAuditoria}`) => referencia(`${path}/${id}`),
    }),
    runTransaction: mocks.runTransaction,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-29T17:00:00.000Z'));
  documentos = new Map([['counters/radicados-2026', { ultimo: 27, historico: 'conservar' }]]);
  secuenciaAuditoria = 0;
  revision = 0;
  fallarCreate = false;
  mocks.autenticar.mockResolvedValue({ ok: true, usuario });
  mocks.obtenerDb.mockImplementation(crearDb);
  mocks.runTransaction.mockImplementation(async (
    operacion: (tx: Transaccion) => Promise<Documento>,
  ) => {
    for (;;) {
      const revisionLeida = revision;
      const escrituras: Escritura[] = [];
      const tx: Transaccion = {
        get: async (entrada) => {
          mocks.get(entrada.path);
          return entrada.tipo === 'consulta'
            ? snapshotConsulta(entrada.path)
            : snapshot(entrada.path);
        },
        set: (ref, valor, opciones) => {
          mocks.set(ref.path, valor, opciones);
          escrituras.push({ tipo: 'set', ref, valor, merge: opciones.merge });
        },
        create: (ref, valor) => {
          mocks.create(ref.path, valor);
          escrituras.push({ tipo: 'create', ref, valor });
        },
      };
      const resultado = await operacion(tx);
      // Simula el retry optimista de Firestore cuando otra transacción cambió
      // el counter entre la lectura y el commit.
      if (revision !== revisionLeida) continue;
      if (fallarCreate && escrituras.some((e) => e.tipo === 'create')) {
        throw new Error('auditoría no persistida');
      }
      for (const escritura of escrituras) {
        if (escritura.tipo === 'create' && documentos.has(escritura.ref.path)) {
          throw new Error('ALREADY_EXISTS');
        }
      }
      for (const escritura of escrituras) {
        if (escritura.tipo === 'set') {
          documentos.set(
            escritura.ref.path,
            escritura.merge
              ? { ...documentos.get(escritura.ref.path), ...escritura.valor }
              : escritura.valor,
          );
        } else {
          documentos.set(escritura.ref.path, escritura.valor);
        }
      }
      if (escrituras.length > 0) revision += 1;
      return resultado;
    }
  });
});

afterEach(() => vi.useRealTimers());

describe('apertura de radicados: autenticación antes de leer o escribir', () => {
  it.each([401, 403, 500])('conserva la respuesta %s del guard en GET y POST', async (status) => {
    mocks.autenticar.mockImplementation(async () => ({
      ok: false,
      respuesta: NextResponse.json({ error: 'Acceso rechazado' }, { status }),
    }));
    expect((await GET()).status).toBe(status);
    expect((await POST(solicitud())).status).toBe(status);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });

  it.each(['RECEPCIONISTA', 'SECRETARIO', 'JEFE', 'CONTRATISTA', 'SUPER_ADMIN'])('rechaza el rol %s', async (rol) => {
    mocks.autenticar.mockResolvedValue({ ok: true, usuario: { ...usuario, rol } });
    expect((await GET()).status).toBe(403);
    expect((await POST(solicitud())).status).toBe(403);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });
});

describe('apertura única: integridad, bloqueo y auditoría atómica', () => {
  it('GET no escribe y sugiere 1745 sobre el contador 27', async () => {
    const respuesta = await GET();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      ok: true,
      anio: 2026,
      ultimo: 27,
      proximoRadicado: '1-110-202609-00000028',
      openingAlreadyExists: false,
      primerNumeroSugerido: 1745,
    });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([1745, 1755])('abre en %s dejando N disponible, bloqueada y auditada', async (primerNumero) => {
    const respuesta = await POST(solicitud(primerNumero));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({
      ok: true,
      ultimo: primerNumero - 1,
      primerNumeroSugerido: primerNumero,
      proximoRadicado: `1-110-202609-${String(primerNumero).padStart(8, '0')}`,
      openingAlreadyExists: true,
      idempotente: false,
      apertura: {
        version: 1,
        estado: 'BLOQUEADA',
        primerNumero,
        abiertoEn: primerNumero,
        veniaDe: 27,
        ultimoInicial: primerNumero - 1,
        actorUid: usuario.uid,
        actorRol: 'ADMIN',
        tenantId: 'VENTANILLA_UNICA',
        fecha: '2026-09-29T17:00:00.000Z',
        fechaHoraBogota: '2026-09-29T12:00:00.000-05:00',
      },
    });
    expect(documentos.get('counters/radicados-2026')).toMatchObject({
      ultimo: primerNumero - 1,
      historico: 'conservar',
      apertura: { estado: 'BLOQUEADA', primerNumero },
    });
    expect([...documentos.keys()].filter((k) => k.startsWith('admin_auditoria/'))).toHaveLength(1);
    expect([...documentos.keys()].some((k) => k.startsWith('ventanilla_radicados/'))).toBe(false);
    expect([...documentos.keys()].some((k) => k.startsWith('unicidad_radicados/'))).toBe(false);
  });

  it('repetir exactamente N es idempotente y no crea segunda escritura ni auditoría', async () => {
    expect((await POST(solicitud(1745))).status).toBe(200);
    const setDespuesPrimera = mocks.set.mock.calls.length;
    const createDespuesPrimera = mocks.create.mock.calls.length;
    const segunda = await POST(solicitud(1745));
    expect(segunda.status).toBe(200);
    expect(await segunda.json()).toMatchObject({ idempotente: true, ultimo: 1744 });
    expect(mocks.set).toHaveBeenCalledTimes(setDespuesPrimera);
    expect(mocks.create).toHaveBeenCalledTimes(createDespuesPrimera);
    expect([...documentos.keys()].filter((k) => k.startsWith('admin_auditoria/'))).toHaveLength(1);
  });

  it('bloquea cualquier N distinto después de confirmar la apertura', async () => {
    expect((await POST(solicitud(1745))).status).toBe(200);
    const respuesta = await POST(solicitud(1755));
    expect(respuesta.status).toBe(409);
    expect(await respuesta.json()).toMatchObject({ error: expect.stringContaining('ya fue abierta') });
    expect(documentos.get('counters/radicados-2026')?.ultimo).toBe(1744);
    expect([...documentos.keys()].filter((k) => k.startsWith('admin_auditoria/'))).toHaveLength(1);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rechaza primer número no seguro %s sin efectos', async (numero) => {
    expect((await POST(solicitud(numero))).status).toBe(400);
    expect(documentos.get('counters/radicados-2026')?.ultimo).toBe(27);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('rechaza N igual o inferior al contador vigente', async () => {
    expect((await POST(solicitud(27))).status).toBe(409);
    expect((await POST(solicitud(26))).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -1, 1.5, '27', null])('falla cerrado ante contador corrupto %s', async (ultimo) => {
    documentos.set('counters/radicados-2026', { ultimo });
    expect((await GET()).status).toBe(409);
    expect((await POST(solicitud())).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('falla cerrado ante apertura parcial/corrupta', async () => {
    documentos.set('counters/radicados-2026', { ultimo: 1744, apertura: { abiertoEn: 1745 } });
    expect((await GET()).status).toBe(409);
    expect((await POST(solicitud())).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('si falla tx.create de auditoría, el contador completo hace rollback', async () => {
    fallarCreate = true;
    expect((await POST(solicitud())).status).toBe(500);
    expect(documentos.get('counters/radicados-2026')).toEqual({ ultimo: 27, historico: 'conservar' });
    expect([...documentos.keys()]).toEqual(['counters/radicados-2026']);
  });

  it.each([
    ['ventanilla_radicados/1-110-202610-00001745', { control: { consecutivo: 1745, fechaRadicado: '2026-10-03T15:00:00.000Z' } }],
    ['ventanilla_radicados/1-WEB-2026-00001760', { control: { consecutivo: 1760, fechaRadicado: '2026-02-03T15:00:00.000Z' } }],
    ['unicidad_radicados/1-110-202611-00001746', { consecutivo: 1746 }],
  ])('rechaza documento/reserva anual igual o posterior: %s', async (path, data) => {
    documentos.set(path, data);
    const respuesta = await POST(solicitud());
    expect(respuesta.status).toBe(409);
    expect(documentos.get('counters/radicados-2026')?.ultimo).toBe(27);
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('una ocupación de otro año no bloquea la serie anual actual', async () => {
    documentos.set('unicidad_radicados/1-110-202509-00001760', { consecutivo: 1760 });
    expect((await POST(solicitud())).status).toBe(200);
  });

  it('dos solicitudes concurrentes iguales producen una sola apertura y una sola auditoría', async () => {
    const [a, b] = await Promise.all([POST(solicitud(1745)), POST(solicitud(1745))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const cuerpos = await Promise.all([a.json(), b.json()]);
    expect(cuerpos.map((c) => c.idempotente).sort()).toEqual([false, true]);
    expect([...documentos.keys()].filter((k) => k.startsWith('admin_auditoria/'))).toHaveLength(1);
  });

  it('dos solicitudes concurrentes diferentes: solo una gana y la otra recibe 409', async () => {
    const respuestas = await Promise.all([POST(solicitud(1745)), POST(solicitud(1755))]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect([...documentos.keys()].filter((k) => k.startsWith('admin_auditoria/'))).toHaveLength(1);
  });

  it.each(['null', '[]', '{'])('rechaza cuerpo inválido %s antes de Firestore', async (body) => {
    const respuesta = await POST(new Request('http://localhost/api/interno/consecutivo-radicacion', {
      method: 'POST',
      body,
    }));
    expect(respuesta.status).toBe(400);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });
});

describe('apertura única: calendario America/Bogota', () => {
  it.each([
    ['2026-10-01T04:59:59.999Z', 2026, '202609'],
    ['2026-10-01T05:00:00.000Z', 2026, '202610'],
    ['2027-01-01T04:59:59.999Z', 2026, '202612'],
    ['2027-01-01T05:00:00.000Z', 2027, '202701'],
  ])('abre y proyecta el período institucional correcto en %s', async (iso, anio, prefijo) => {
    vi.setSystemTime(new Date(iso));
    documentos.set(`counters/radicados-${anio}`, { ultimo: 27 });
    const respuesta = await POST(solicitud());
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({
      anio,
      proximoRadicado: `1-110-${prefijo}-00001745`,
      apertura: { anio },
    });
    expect(documentos.get(`counters/radicados-${anio}`)?.ultimo).toBe(1744);
  });
});
