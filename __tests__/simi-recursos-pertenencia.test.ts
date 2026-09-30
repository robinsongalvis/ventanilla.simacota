/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { InternalUserSession } from '@/lib/server/internal-auth';

const mocks = vi.hoisted(() => ({
  autenticarUsuarioInterno: vi.fn(),
  getFirebaseAdminDb: vi.fn(),
  getRadicadoOrFail: vi.fn(),
}));

vi.mock('@/lib/server/internal-auth-http', () => ({
  autenticarUsuarioInterno: mocks.autenticarUsuarioInterno,
}));
vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: mocks.getFirebaseAdminDb }));
vi.mock('@/lib/server/radicados-security', () => {
  class RadicadoActionError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  }
  return { getRadicadoOrFail: mocks.getRadicadoOrFail, RadicadoActionError };
});

import * as notificaciones from '@/app/api/simi/notificaciones/route';
import * as normograma from '@/app/api/simi/normograma/route';
import * as trazabilidad from '@/app/api/simi/reportes/trazabilidad/[radicadoId]/route';
import { RadicadoActionError } from '@/lib/server/radicados-security';

// Forma abierta deliberada: fixtures que representan documentos Firestore y
// payloads no confiables, incluidos campos ausentes o de tipos incorrectos.
type Datos = Record<string, unknown>;
interface Referencia { id: string; path: string }
interface Snapshot { id: string; exists: boolean; data: () => Datos | undefined }
interface Transaccion {
  getAll: (...refs: Referencia[]) => Promise<Snapshot[]>;
  update: (ref: Referencia, data: Datos) => void;
}

let usuario: InternalUserSession;
let documentos: Map<string, Datos>;
let falloCommit: boolean;
let coleccionFallida: string | undefined;
const lecturas = vi.fn();
const escrituras = vi.fn<(ref: Referencia, data: Datos) => void>();
const lecturasTransaccion = vi.fn();

function consulta(path: string, filtros: Array<[string, unknown]> = []) {
  return {
    where(campo: string, _operador: string, valor: unknown) {
      return consulta(path, [...filtros, [campo, valor]]);
    },
    orderBy: () => consulta(path, filtros),
    limit: () => consulta(path, filtros),
    doc(id: string) {
      return { id, path: `${path}/${id}`, collection: (nombre: string) => consulta(`${path}/${id}/${nombre}`) };
    },
    async get() {
      lecturas(path, filtros);
      if (path === coleccionFallida) throw new Error('Consulta no disponible o índice faltante');
      return {
        docs: [...documentos.entries()]
          .filter(([key, data]) => key.slice(0, key.lastIndexOf('/')) === path
            && filtros.every(([campo, valor]) => data[campo] === valor))
          .map(([key, data]) => ({ id: key.slice(key.lastIndexOf('/') + 1), data: () => data })),
      };
    },
  };
}

const runTransaction = vi.fn(async (operacion: (transaction: Transaccion) => Promise<void>) => {
  const pendientes: Array<[Referencia, Datos]> = [];
  await operacion({
    async getAll(...refs) {
      lecturasTransaccion(refs);
      return refs.map((ref) => ({ id: ref.id, exists: documentos.has(ref.path), data: () => documentos.get(ref.path) }));
    },
    update(ref, data) {
      escrituras(ref, data);
      pendientes.push([ref, data]);
    },
  });
  if (falloCommit) throw new Error('Fallo de commit simulado');
  for (const [ref, data] of pendientes) documentos.set(ref.path, { ...documentos.get(ref.path), ...data });
});

function iniciarSesion(rol: InternalUserSession['rol'] = 'JEFE_DEPENDENCIA') {
  usuario = { uid: 'jefe-1', nombre: 'Prueba', email: 'prueba@example.test', rol, tenantId: 'SEC_GOBIERNO', activo: true };
  mocks.autenticarUsuarioInterno.mockResolvedValue({ ok: true, usuario });
}

function notificacion(id: string, cambios: Datos = {}) {
  documentos.set(`simi_notificaciones/${id}`, {
    tenantId: usuario.tenantId,
    destinatarioRol: usuario.rol,
    leida: false,
    createdAt: '2026-09-29T12:00:00Z',
    ...cambios,
  });
}

function solicitud(body: unknown): Request {
  return new Request('https://ventanilla.test/api/simi/notificaciones', { method: 'PATCH', body: JSON.stringify(body) });
}

function consultarTrazabilidad() {
  return trazabilidad.GET(new Request('https://ventanilla.test/api/simi/reportes/trazabilidad/RAD-1'), {
    params: Promise.resolve({ radicadoId: 'RAD-1' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  documentos = new Map();
  falloCommit = false;
  coleccionFallida = undefined;
  iniciarSesion();
  mocks.getFirebaseAdminDb.mockReturnValue({ collection: consulta, runTransaction });
  mocks.getRadicadoOrFail.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_GOBIERNO' } });
});

describe('Notificaciones: destinatario completo y escritura atómica', () => {
  it('GET solo entrega avisos de su tenant, rol y UID, o avisos generales de su rol', async () => {
    notificacion('general');
    notificacion('propia', { destinatarioUid: usuario.uid });
    notificacion('otro-uid', { destinatarioUid: 'jefe-2' });
    notificacion('otro-tenant', { tenantId: 'SEC_HACIENDA' });
    notificacion('otro-rol', { destinatarioRol: 'ADMIN' });
    notificacion('uid-invalido', { destinatarioUid: null });
    const response = await notificaciones.GET(new Request('https://ventanilla.test/api/simi/notificaciones'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.notificaciones.map((item: { id: string }) => item.id)).toEqual(['general', 'propia']);
    expect(body.sinLeer).toBe(2);
  });

  it('GET noLeidas no incluye avisos ya leídos ni dirigidos a otro UID', async () => {
    notificacion('pendiente');
    notificacion('leida', { leida: true });
    notificacion('otro-uid', { destinatarioUid: 'jefe-2' });
    const response = await notificaciones.GET(new Request('https://ventanilla.test/api/simi/notificaciones?noLeidas=true'));
    const body = await response.json();
    expect(body.notificaciones.map((item: { id: string }) => item.id)).toEqual(['pendiente']);
    expect(body.sinLeer).toBe(1);
  });

  it.each([
    ['tenant ajeno', { tenantId: 'SEC_HACIENDA' }],
    ['rol ajeno', { destinatarioRol: 'ADMIN' }],
    ['UID ajeno', { destinatarioUid: 'jefe-2' }],
    ['UID inválido', { destinatarioUid: null }],
  ])('PATCH lote mixto con %s rechaza todo antes de escribir', async (_nombre, cambios) => {
    notificacion('legitima');
    notificacion('ajena', cambios);
    const response = await notificaciones.PATCH(solicitud({ ids: ['legitima', 'ajena'] }));
    expect(response.status).toBe(403);
    expect(escrituras).not.toHaveBeenCalled();
    expect(documentos.get('simi_notificaciones/legitima')?.leida).toBe(false);
    expect(documentos.get('simi_notificaciones/ajena')?.leida).toBe(false);
  });

  it('PATCH un ID inexistente no permite éxito parcial del lote', async () => {
    notificacion('legitima');
    const response = await notificaciones.PATCH(solicitud({ ids: ['legitima', 'inexistente'] }));
    expect(response.status).toBe(404);
    expect(escrituras).not.toHaveBeenCalled();
    expect(documentos.get('simi_notificaciones/legitima')?.leida).toBe(false);
  });

  it('PATCH marca el lote legítimo en una única transacción y conserva idempotencia', async () => {
    notificacion('general');
    notificacion('propia', { destinatarioUid: usuario.uid });
    const response = await notificaciones.PATCH(solicitud({ ids: ['general', 'propia'] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, marcadas: 2 });
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(lecturasTransaccion).toHaveBeenCalledOnce();
    expect(escrituras).toHaveBeenCalledTimes(2);
    expect(documentos.get('simi_notificaciones/general')?.leida).toBe(true);
    expect(documentos.get('simi_notificaciones/propia')?.leida).toBe(true);
    const repetida = await notificaciones.PATCH(solicitud({ ids: ['general', 'propia'] }));
    expect(repetida.status).toBe(200);
  });

  it('PATCH un fallo de commit responde 500 sin éxito ni persistencia parcial', async () => {
    notificacion('general');
    falloCommit = true;
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await notificaciones.PATCH(solicitud({ ids: ['general'] }));
      expect(response.status).toBe(500);
      expect(await response.json()).not.toHaveProperty('ok', true);
      expect(documentos.get('simi_notificaciones/general')?.leida).toBe(false);
    } finally { log.mockRestore(); }
  });

  it.each([
    null,
    {},
    { ids: [] },
    { ids: ['valida', 'valida'] },
    { ids: ['a/b'] },
    { ids: [17] },
    { ids: ['x'.repeat(129)] },
    { ids: ['valida'], tenantId: 'SEC_HACIENDA' },
    { ids: Array.from({ length: 101 }, (_, index) => `id-${index}`) },
  ])('PATCH rechaza payload no cerrado o inválido %# sin abrir Firestore', async (body) => {
    const response = await notificaciones.PATCH(solicitud(body));
    expect(response.status).toBe(400);
    expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
    expect(escrituras).not.toHaveBeenCalled();
  });

  it('PATCH rechaza JSON malformado antes de Firestore', async () => {
    const response = await notificaciones.PATCH(new Request('https://ventanilla.test/api', { method: 'PATCH', body: '{' }));
    expect(response.status).toBe(400);
    expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
  });
});

describe('Normograma: las plantillas conservan el aislamiento de la ruta canónica', () => {
  it.each(['plantillas_respuesta', 'normatividad_municipal'])('GET %s solo consulta el tenant autenticado', async (coleccion) => {
    documentos.set(`${coleccion}/propia`, { tenantId: 'SEC_GOBIERNO', titulo: 'Propia' });
    documentos.set(`${coleccion}/ajena`, { tenantId: 'SEC_HACIENDA', titulo: 'Ajena' });
    const response = await normograma.GET(new Request(`https://ventanilla.test/api/simi/normograma?coleccion=${coleccion}`));
    expect(response.status).toBe(200);
    expect((await response.json()).docs.map((item: { id: string }) => item.id)).toEqual(['propia']);
    expect(lecturas).toHaveBeenCalledWith(coleccion, [['tenantId', 'SEC_GOBIERNO']]);
  });

  it('GET normatividad nacional mantiene lectura compartida', async () => {
    documentos.set('normatividad_nacional/nacional', { titulo: 'Norma nacional' });
    const response = await normograma.GET(new Request('https://ventanilla.test/api/simi/normograma'));
    expect(response.status).toBe(200);
    expect((await response.json()).total).toBe(1);
  });
});

describe('Trazabilidad: autoriza el radicado antes de subconsultas', () => {
  it('JEFE de otra dependencia recibe 403 sin consultar trazabilidad, borradores, firmas ni auditoría', async () => {
    mocks.getRadicadoOrFail.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
    const response = await consultarTrazabilidad();
    expect(response.status).toBe(403);
    expect(mocks.getRadicadoOrFail).toHaveBeenCalledWith('RAD-1');
    expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
    expect(lecturas).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'CONTROL_INTERNO', 'JEFE_DEPENDENCIA'] as const)('%s legítimo obtiene CSV y las cinco fuentes', async (rol) => {
    iniciarSesion(rol);
    if (rol !== 'JEFE_DEPENDENCIA') {
      mocks.getRadicadoOrFail.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
    }
    documentos.set('ventanilla_radicados/RAD-1/trazabilidad/ev-1', { fecha: '2026-09-29', accion: 'Registro controlado' });
    const response = await consultarTrazabilidad();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(await response.text()).toContain('Registro controlado');
    expect(lecturas).toHaveBeenCalledTimes(5);
  });

  it.each(['RECEPCIONISTA', 'FUNCIONARIO'] as const)('%s no lee siquiera el radicado', async (rol) => {
    iniciarSesion(rol);
    const response = await consultarTrazabilidad();
    expect(response.status).toBe(403);
    expect(mocks.getRadicadoOrFail).not.toHaveBeenCalled();
    expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
  });

  it('radicado ausente devuelve 404 sin subconsultas', async () => {
    mocks.getRadicadoOrFail.mockRejectedValue(new RadicadoActionError('Radicado no encontrado.', 404));
    const response = await consultarTrazabilidad();
    expect(response.status).toBe(404);
    expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
  });

  it('fallo de Firestore devuelve 500 y no fabrica CSV vacío', async () => {
    mocks.getRadicadoOrFail.mockRejectedValue(new Error('Firestore no disponible'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await consultarTrazabilidad();
      expect(response.status).toBe(500);
      expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });

  it.each([
    'ventanilla_radicados/RAD-1/trazabilidad',
    'simi_borrador_versiones',
    'simi_aprobaciones_respuesta',
    'simi_respuestas_firma',
    'simi_juridico_auditoria',
  ])('fallo de la fuente %s responde 500 sin CSV parcial', async (coleccion) => {
    coleccionFallida = coleccion;
    documentos.set('simi_borrador_versiones/version-1', { radicadoId: 'RAD-1', version: 1, motivoCambio: 'Contenido parcial' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await consultarTrazabilidad();
      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toContain('application/json');
      expect(await response.text()).not.toContain('Contenido parcial');
    } finally { log.mockRestore(); }
  });
});

describe('Autenticación antes de los recursos', () => {
  it.each([
    ['notificaciones GET', () => notificaciones.GET(new Request('https://ventanilla.test/api'))],
    ['notificaciones PATCH', () => notificaciones.PATCH(solicitud({ ids: ['id'] }))],
    ['normograma GET', () => normograma.GET(new Request('https://ventanilla.test/api'))],
    ['trazabilidad GET', consultarTrazabilidad],
  ] as const)('%s devuelve 401 sin lecturas ni escrituras', async (_nombre, ejecutar) => {
    mocks.autenticarUsuarioInterno.mockResolvedValue({ ok: false, respuesta: NextResponse.json({ error: 'No autorizado.' }, { status: 401 }) });
    const response = await ejecutar();
    expect(response.status).toBe(401);
    expect(mocks.getFirebaseAdminDb).not.toHaveBeenCalled();
    expect(mocks.getRadicadoOrFail).not.toHaveBeenCalled();
    expect(escrituras).not.toHaveBeenCalled();
  });
});
