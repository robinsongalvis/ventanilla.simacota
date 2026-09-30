import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

// Frontera Firestore simulada: los documentos tienen campos heterogéneos.
type Documento = Record<string, unknown>;
type Referencia = { path: string; get: () => Promise<Snapshot> };
type Snapshot = { exists: boolean; data: () => Documento | undefined };
type Transaccion = {
  get: (ref: Referencia) => Promise<Snapshot>;
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

const usuario = { uid: 'admin-controlado', nombre: 'Administración de prueba', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA' };
let documentos: Map<string, Documento>;
let auditoriaId: number;

function solicitud(ultimoDelSistemaAnterior: number = 1744, motivo = 'Relevo autorizado según libro externo'): Request {
  return new Request('http://localhost/api/interno/consecutivo-radicacion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ultimoDelSistemaAnterior, motivo }),
  });
}

function snapshot(path: string): Snapshot {
  return { exists: documentos.has(path), data: () => documentos.get(path) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-29T17:00:00.000Z'));
  documentos = new Map([['counters/radicados-2026', { ultimo: 27, historico: 'conservar' }]]);
  auditoriaId = 0;
  mocks.autenticar.mockResolvedValue({ ok: true, usuario });
  mocks.obtenerDb.mockReturnValue({
    collection: (nombre: string) => ({
      doc: (id = `auditoria-${++auditoriaId}`): Referencia => ({
        path: `${nombre}/${id}`,
        get: async () => snapshot(`${nombre}/${id}`),
      }),
    }),
    runTransaction: mocks.runTransaction,
  });
  mocks.runTransaction.mockImplementation(async (operacion: (tx: Transaccion) => Promise<Documento>) => {
    const pendientes: Array<() => void> = [];
    const tx: Transaccion = {
      get: async (ref) => {
        mocks.get(ref.path);
        return snapshot(ref.path);
      },
      set: (ref, valor, opciones) => {
        mocks.set(ref.path, valor, opciones);
        pendientes.push(() => documentos.set(ref.path, { ...documentos.get(ref.path), ...valor }));
      },
      create: (ref, valor) => {
        mocks.create(ref.path, valor);
        if (documentos.has(ref.path)) throw new Error('ALREADY_EXISTS');
        pendientes.push(() => documentos.set(ref.path, valor));
      },
    };
    const resultado = await operacion(tx);
    pendientes.forEach((confirmar) => confirmar());
    return resultado;
  });
});

afterEach(() => vi.useRealTimers());

describe('consecutivo-radicacion: autenticación antes de leer o escribir', () => {
  it.each([401, 403, 500])('conserva la respuesta %s del guard en GET y POST', async (status) => {
    mocks.autenticar.mockImplementation(async () => ({
      ok: false, status, mensaje: 'Acceso rechazado',
      respuesta: NextResponse.json({ error: 'Acceso rechazado' }, { status }),
    }));
    expect((await GET()).status).toBe(status);
    expect((await POST(solicitud())).status).toBe(status);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });

  it.each(['RECEPCIONISTA', 'SECRETARIO', 'JEFE', 'CONTRATISTA', 'SUPER_ADMIN', 'DESARROLLADOR'])('rechaza el rol %s', async (rol) => {
    mocks.autenticar.mockResolvedValue({ ok: true, usuario: { ...usuario, rol } });
    expect((await GET()).status).toBe(403);
    expect((await POST(solicitud())).status).toBe(403);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });
});

describe('consecutivo-radicacion: integridad y auditoría atómica', () => {
  it('ADMIN consulta sin escrituras y ajusta con historial inmutable en la misma transacción', async () => {
    const consulta = await GET();
    expect(await consulta.json()).toMatchObject({ ok: true, ultimo: 27, proximoRadicado: '1-110-202609-00000028' });
    expect(mocks.runTransaction).not.toHaveBeenCalled();

    const primera = await POST(solicitud());
    expect(primera.status).toBe(200);
    expect(await primera.json()).toMatchObject({ anterior: 27, ultimo: 1744, proximoRadicado: '1-110-202609-00001745' });
    expect(documentos.get('admin_auditoria/auditoria-1')).toMatchObject({
      accion: 'CONSECUTIVO_RADICACION_AJUSTADO', actorUid: usuario.uid, actorRol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA', fecha: '2026-09-29T17:00:00.000Z',
      metadata: { anio: 2026, anterior: 27, nuevo: 1744, motivo: 'Relevo autorizado según libro externo' },
    });
    const primeraAuditoria = documentos.get('admin_auditoria/auditoria-1');
    expect((await POST(solicitud(1780))).status).toBe(200);
    expect(documentos.get('admin_auditoria/auditoria-1')).toEqual(primeraAuditoria);
    expect(documentos.get('admin_auditoria/auditoria-2')).toMatchObject({ metadata: { anterior: 1744, nuevo: 1780 } });
    expect(documentos.get('counters/radicados-2026')).toMatchObject({ ultimo: 1780, historico: 'conservar' });
    expect(mocks.runTransaction).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it('si falla la creación de auditoría, no confirma el contador ni simula éxito', async () => {
    mocks.create.mockImplementation(() => { throw new Error('auditoria no persistida'); });
    expect((await POST(solicitud())).status).toBe(500);
    expect(documentos.get('counters/radicados-2026')?.ultimo).toBe(27);
    expect([...documentos.keys()]).toEqual(['counters/radicados-2026']);
  });

  it.each([NaN, Infinity, -1, 1.5, '27', null, undefined])('rechaza el contador persistido inválido %s sin efectos', async (ultimo) => {
    documentos.set('counters/radicados-2026', { ultimo });
    expect((await GET()).status).toBe(409);
    expect((await POST(solicitud())).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([27, 26])('rechaza igualdad o retroceso a %s sin auditoría de éxito', async (nuevo) => {
    expect((await POST(solicitud(nuevo))).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rechaza una colisión con el siguiente radicado sin avanzar el contador', async () => {
    documentos.set('ventanilla_radicados/1-110-202609-00001745', { id: 'ya-emitido' });
    expect((await POST(solicitud())).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(['null', '[]', '{'])('rechaza el cuerpo inválido %s antes de acceder a Firestore', async (body) => {
    expect((await POST(new Request('http://localhost/api/interno/consecutivo-radicacion', { method: 'POST', body }))).status).toBe(400);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });

  it('rechaza un motivo insuficiente antes de acceder a Firestore', async () => {
    expect((await POST(solicitud(1744, 'cambio'))).status).toBe(400);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });
});

describe('consecutivo-radicacion: calendario America/Bogota', () => {
  it.each([
    ['2026-10-01T04:59:59.999Z', 2026, '202609'],
    ['2026-10-01T05:00:00.000Z', 2026, '202610'],
    ['2027-01-01T04:59:59.999Z', 2026, '202612'],
    ['2027-01-01T05:00:00.000Z', 2027, '202701'],
  ])('consulta y escritura acuerdan año y mes en %s', async (iso, anio, prefijo) => {
    vi.setSystemTime(new Date(iso));
    documentos.set(`counters/radicados-${anio}`, { ultimo: 27 });
    const consulta = await GET();
    expect(await consulta.json()).toMatchObject({ anio, proximoRadicado: `1-110-${prefijo}-00000028` });
    const respuesta = await POST(solicitud());
    expect(await respuesta.json()).toMatchObject({ anio, proximoRadicado: `1-110-${prefijo}-00001745` });
    expect(mocks.get).toHaveBeenCalledWith(`counters/radicados-${anio}`);
    expect(mocks.get).toHaveBeenCalledWith(`ventanilla_radicados/1-110-${prefijo}-00001745`);
    expect(documentos.get(`counters/radicados-${anio}`)?.ultimo).toBe(1744);
  });
});
