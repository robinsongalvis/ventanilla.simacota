/** @vitest-environment node */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { InternalUserSession } from '@/lib/server/internal-auth';

// Documentos y payloads heterogéneos deliberados para simular datos no confiables.
type Datos = Record<string, unknown>;
interface Referencia { id: string; path: string }
interface Snapshot { exists: boolean; data: () => Datos | undefined }
interface Transaccion {
  get: (ref: Referencia) => Promise<Snapshot>;
  create: (ref: Referencia, datos: Datos) => void;
  update: (ref: Referencia, datos: Datos) => void;
}

const mocks = vi.hoisted(() => ({ autenticar: vi.fn(), obtenerDb: vi.fn() }));
vi.mock('@/lib/server/internal-auth-http', () => ({ autenticarUsuarioInterno: mocks.autenticar }));
vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: mocks.obtenerDb }));

import { POST } from '@/app/api/simi/respuestas/firma/route';
import { createFinalSignature, FirmaValidationError } from '@/lib/simi-juridico/createFinalSignature';

let usuario: InternalUserSession;
let documentos: Map<string, Datos>;
let falloCommit: boolean;
let falloLectura: boolean;
const lecturas = vi.fn();
const escrituras = vi.fn();
const runTransaction = vi.fn(async (operacion: (tx: Transaccion) => Promise<unknown>) => {
  const pendientes: Array<() => void> = [];
  const resultado = await operacion({
    async get(ref) {
      lecturas(ref.path);
      if (falloLectura) throw new Error('Firestore no disponible: detalle privado');
      return { exists: documentos.has(ref.path), data: () => documentos.get(ref.path) };
    },
    create(ref, datos) {
      escrituras('create', ref.path, datos);
      if (documentos.has(ref.path)) throw new Error('ALREADY_EXISTS');
      pendientes.push(() => documentos.set(ref.path, datos));
    },
    update(ref, datos) {
      escrituras('update', ref.path, datos);
      pendientes.push(() => documentos.set(ref.path, { ...documentos.get(ref.path), ...datos }));
    },
  });
  if (falloCommit) throw new Error('Commit no disponible: detalle privado');
  pendientes.forEach((confirmar) => confirmar());
  return resultado;
});

function sesion(rol: InternalUserSession['rol'] = 'JEFE_DEPENDENCIA') {
  usuario = { uid: 'jefe-1', email: 'prueba@example.test', nombre: 'Jefe de prueba', rol, tenantId: 'SEC_GOBIERNO', activo: true };
  mocks.autenticar.mockResolvedValue({ ok: true, usuario });
}

function solicitud(cambios: Datos = {}): Request {
  return new Request('http://localhost/api/simi/respuestas/firma', {
    method: 'POST', body: JSON.stringify({ radicadoId: 'RAD-1', aprobacionId: 'APR-1', textoRespuestaFinal: 'Texto sintético aprobado', ...cambios }),
  });
}

function cambiarAprobacion(cambios: Datos) {
  documentos.set('simi_aprobaciones_respuesta/APR-1', { ...documentos.get('simi_aprobaciones_respuesta/APR-1'), ...cambios });
}

beforeEach(() => {
  vi.clearAllMocks();
  falloCommit = false;
  falloLectura = false;
  sesion();
  documentos = new Map([
    ['ventanilla_radicados/RAD-1', { clasificacion: { oficinaDestino: 'SEC_GOBIERNO' } }],
    ['simi_aprobaciones_respuesta/APR-1', {
      radicadoId: 'RAD-1', tenantId: 'SEC_GOBIERNO', estado: 'aprobado_por_jefe',
      nivelRiesgo: 'bajo', aprobadoPor: 'aprobador-humano', aprobadoPorRol: 'JEFE_DEPENDENCIA',
      historial: [{ estado: 'aprobado_por_jefe', usuarioId: 'aprobador-humano' }],
    }],
  ]);
  mocks.obtenerDb.mockReturnValue({
    collection: (nombre: string) => ({ doc: (id = 'FIRMA-1') => ({ id, path: `${nombre}/${id}` }) }),
    runTransaction,
  });
});

afterEach(() => vi.restoreAllMocks());

describe('Firma HTTP: autenticación y validación antes de los recursos', () => {
  it.each([401, 403, 500])('conserva %s del guard sin leer ni escribir', async (status) => {
    mocks.autenticar.mockResolvedValue({ ok: false, respuesta: NextResponse.json({ error: 'Rechazo' }, { status }) });
    expect((await POST(solicitud())).status).toBe(status);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });

  it.each(['RECEPCIONISTA', 'FUNCIONARIO', 'CONTROL_INTERNO'] as const)('rechaza %s sin recursos', async (rol) => {
    sesion(rol);
    expect((await POST(solicitud())).status).toBe(403);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });

  it.each([
    { radicadoId: null }, { radicadoId: 'a/b' }, { aprobacionId: 17 },
    { aprobacionId: '' }, { borradorVersionId: 'a/b' }, { textoRespuestaFinal: {} },
    { emailCiudadano: 17 }, { canalEnvio: 'canal-arbitrario' },
  ])('rechaza payload inválido %# sin Firestore', async (body) => {
    expect((await POST(solicitud(body))).status).toBe(400);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });

  it.each(['null', '[]', '{'])('rechaza cuerpo %s sin Firestore', async (body) => {
    expect((await POST(new Request('http://localhost/api', { method: 'POST', body }))).status).toBe(400);
    expect(mocks.obtenerDb).not.toHaveBeenCalled();
  });
});

describe('Firma: permiso y coherencia del recurso dentro de la transacción', () => {
  it('JEFE ajeno al radicado no alcanza la aprobación ni realiza escrituras', async () => {
    documentos.set('ventanilla_radicados/RAD-1', { clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
    expect((await POST(solicitud())).status).toBe(403);
    expect(lecturas.mock.calls).toEqual([['ventanilla_radicados/RAD-1']]);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it.each(['JEFE_DEPENDENCIA', 'ADMIN'] as const)('%s no puede vincular aprobación de otro radicado', async (rol) => {
    sesion(rol);
    cambiarAprobacion({ radicadoId: 'RAD-AJENO' });
    expect((await POST(solicitud())).status).toBe(403);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it('JEFE no puede usar aprobación de otro tenant aunque tenga el mismo radicado', async () => {
    cambiarAprobacion({ tenantId: 'SEC_HACIENDA' });
    expect((await POST(solicitud())).status).toBe(403);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it('ADMIN conserva alcance global con aprobación histórica del tenant actor', async () => {
    sesion('ADMIN');
    documentos.set('ventanilla_radicados/RAD-1', { clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
    cambiarAprobacion({ tenantId: 'VENTANILLA_UNICA' });
    expect((await POST(solicitud({ tenantId: 'TENANT-FORJADO', dependencia: 'DEPENDENCIA-FORJADA' }))).status).toBe(200);
    expect(documentos.get('simi_respuestas_firma/FIRMA-1')).toMatchObject({ tenantId: 'SEC_HACIENDA', dependencia: 'SEC_HACIENDA' });
  });

  it.each(['ventanilla_radicados/RAD-1', 'simi_aprobaciones_respuesta/APR-1'])('recurso ausente %s devuelve 404 sin escrituras', async (path) => {
    documentos.delete(path);
    expect((await POST(solicitud())).status).toBe(404);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it('radicado sin tenant válido devuelve 422 sin inventar dependencia', async () => {
    documentos.set('ventanilla_radicados/RAD-1', { clasificacion: {} });
    expect((await POST(solicitud())).status).toBe(422);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it.each([
    { radicadoId: 'RAD-AJENO', approvalId: 'APR-1' },
    { radicadoId: 'RAD-1', approvalId: 'APR-AJENA' },
  ])('borrador ajeno %# no permite firma', async (datos) => {
    documentos.set('simi_borrador_versiones/BOR-1', datos);
    expect((await POST(solicitud({ borradorVersionId: 'BOR-1' }))).status).toBe(403);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it('borrador inexistente devuelve 404 sin escritura', async () => {
    expect((await POST(solicitud({ borradorVersionId: 'BOR-1' }))).status).toBe(404);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it.each([undefined, 'APR-1'])('acepta borrador del radicado con vínculo opcional %s', async (approvalId) => {
    documentos.set('simi_borrador_versiones/BOR-1', { radicadoId: 'RAD-1', approvalId });
    expect((await POST(solicitud({ borradorVersionId: 'BOR-1' }))).status).toBe(200);
  });
});

describe('Firma: aprobación humana, hash real y persistencia atómica', () => {
  it.each([
    { estado: 'pendiente_revision_jefe' },
    { estado: 'devuelto_para_ajustes' },
    { aprobadoPor: undefined },
    { nivelRiesgo: 'alto', estado: 'aprobado_por_jefe' },
  ])('mantiene el bloqueo humano existente %#', async (datos) => {
    cambiarAprobacion(datos);
    expect((await POST(solicitud())).status).toBe(422);
    expect(escrituras).not.toHaveBeenCalled();
  });

  it('firma legítima preserva aprobador, historial y SHA; confirma ambos documentos juntos', async () => {
    const response = await POST(solicitud());
    expect(response.status).toBe(200);
    const hashDocumento = createHash('sha256').update('Texto sintético aprobado').digest('hex').slice(0, 16).toUpperCase();
    expect(await response.json()).toMatchObject({ ok: true, firmaId: 'FIRMA-1', estado: 'firmado', hashDocumento });
    expect(documentos.get('simi_respuestas_firma/FIRMA-1')).toMatchObject({
      aprobadoPor: 'aprobador-humano', aprobadoPorRol: 'JEFE_DEPENDENCIA', firmadoPor: usuario.nombre,
      tenantId: 'SEC_GOBIERNO', dependencia: 'SEC_GOBIERNO', hashDocumento,
    });
    expect(documentos.get('simi_aprobaciones_respuesta/APR-1')).toMatchObject({
      estado: 'listo_para_envio', aprobadoPor: 'aprobador-humano',
      historial: [{ estado: 'aprobado_por_jefe', usuarioId: 'aprobador-humano' }],
    });
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(escrituras).toHaveBeenCalledTimes(2);
  });

  it.each(['lectura', 'commit', 'crypto'])('fallo de %s responde 500 genérico sin firma ni transición parcial', async (fallo) => {
    falloLectura = fallo === 'lectura';
    falloCommit = fallo === 'commit';
    if (fallo === 'crypto') vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Crypto falló: detalle privado'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await POST(solicitud());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('detalle privado');
    expect(documentos.has('simi_respuestas_firma/FIRMA-1')).toBe(false);
    expect(documentos.get('simi_aprobaciones_respuesta/APR-1')?.estado).toBe('aprobado_por_jefe');
    if (fallo !== 'commit') expect(escrituras).not.toHaveBeenCalled();
  });

  it('caller servidor E2E sin actor sigue validando relaciones y deriva tenant del recurso', async () => {
    const params = {
      radicadoId: 'RAD-1', aprobacionId: 'APR-1', firmadoPor: 'E2E controlado',
      dependencia: 'valor-ignorado', tenantId: 'valor-ignorado', textoRespuestaFinal: 'Texto sintético aprobado',
    };
    cambiarAprobacion({ radicadoId: 'RAD-AJENO' });
    await expect(createFinalSignature(params)).rejects.toBeInstanceOf(FirmaValidationError);
    expect(escrituras).not.toHaveBeenCalled();
    cambiarAprobacion({ radicadoId: 'RAD-1' });
    await expect(createFinalSignature(params)).resolves.toMatchObject({ estado: 'firmado' });
    expect(documentos.get('simi_respuestas_firma/FIRMA-1')).toMatchObject({ tenantId: 'SEC_GOBIERNO', dependencia: 'SEC_GOBIERNO' });
    expect(mocks.autenticar).not.toHaveBeenCalled();
  });
});
