/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalUserSession } from '@/lib/server/internal-auth';

type Escritura = { ruta: string; datos: Record<string, unknown> };
type Referencia = { ruta: string; id: string };

const mocks = vi.hoisted(() => ({
  autenticarUsuarioInterno: vi.fn(),
  logError: vi.fn(),
  batch: vi.fn(),
  commit: vi.fn(),
  agregar: vi.fn(),
  lecturas: [] as string[],
  escrituras: [] as Escritura[],
  documentos: new Map<string, Record<string, unknown>>(),
}));

vi.mock('@/lib/server/internal-auth-http', () => ({
  autenticarUsuarioInterno: mocks.autenticarUsuarioInterno,
}));
vi.mock('@/lib/logger', () => ({ logError: mocks.logError }));
vi.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: () => null,
  getClientIp: () => '127.0.0.1',
  rateLimitHeaders: () => ({}),
}));
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (ruta: string) => ({
      ruta,
      get: async () => {
        mocks.lecturas.push(ruta);
        return { exists: mocks.documentos.has(ruta), data: () => mocks.documentos.get(ruta) };
      },
    }),
    collection: (coleccion: string) => ({
      doc: () => ({ id: 'id-auto', ruta: `${coleccion}/id-auto` }),
      add: (datos: Record<string, unknown>) => mocks.agregar(coleccion, datos),
    }),
    batch: mocks.batch,
  }),
}));

import { POST as feedbackIa } from '@/app/api/ai/feedback/route';
import { POST as feedbackSimi } from '@/app/api/simi/feedback/route';

const RADICADO_ID = '1-110-202609-00000028';
const RUTA_RADICADO = `ventanilla_radicados/${RADICADO_ID}`;
const USUARIO: InternalUserSession = {
  uid: 'actor-real', nombre: 'Funcionaria', email: 'funcionaria@example.test',
  rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO', activo: true,
};
const BODY_IA = { radicadoId: RADICADO_ID, puntuacion: 'CORREGIDO' };
const BODY_SIMI = { radicadoId: RADICADO_ID, accion: 'RESUMIR_RADICADO', util: true };

function request(body: unknown): Request {
  return new Request('https://ventanilla.test/api', { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lecturas.length = 0;
  mocks.escrituras.length = 0;
  mocks.documentos.clear();
  mocks.documentos.set(RUTA_RADICADO, { clasificacion: { oficinaDestino: 'SEC_GOBIERNO' } });
  mocks.autenticarUsuarioInterno.mockResolvedValue({ ok: true, usuario: USUARIO });
  mocks.commit.mockResolvedValue(undefined);
  mocks.agregar.mockImplementation(async (coleccion: string, datos: Record<string, unknown>) => {
    mocks.escrituras.push({ ruta: `${coleccion}/id-auto`, datos });
    return { id: 'id-auto' };
  });
  mocks.batch.mockImplementation(() => {
    const pendientes: Escritura[] = [];
    return {
      set: (ref: Referencia, datos: Record<string, unknown>) => pendientes.push({ ruta: ref.ruta, datos }),
      update: (ref: Referencia, datos: Record<string, unknown>) => pendientes.push({ ruta: ref.ruta, datos }),
      commit: async () => {
        await mocks.commit();
        mocks.escrituras.push(...pendientes);
      },
    };
  });
});

describe.each([
  { nombre: 'IA', ejecutar: feedbackIa, body: BODY_IA },
  { nombre: 'SIMI', ejecutar: feedbackSimi, body: BODY_SIMI },
])('Feedback $nombre — alcance del radicado', ({ ejecutar, body }) => {
  it('rechaza otra dependencia con 403 antes de preparar cualquier escritura', async () => {
    mocks.documentos.set(RUTA_RADICADO, { clasificacion: { oficinaDestino: 'SEC_PLANEACION' } });

    const respuesta = await ejecutar(request(body));

    expect(respuesta.status).toBe(403);
    expect(mocks.lecturas).toEqual([RUTA_RADICADO]);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.agregar).not.toHaveBeenCalled();
    expect(mocks.escrituras).toHaveLength(0);
  });

  it('radicado inexistente devuelve 404 sin escribir', async () => {
    mocks.documentos.delete(RUTA_RADICADO);
    expect((await ejecutar(request(body))).status).toBe(404);
    expect(mocks.batch).not.toHaveBeenCalled();
    expect(mocks.agregar).not.toHaveBeenCalled();
    expect(mocks.escrituras).toHaveLength(0);
  });

  it.each([null, [], 23, { ...BODY_IA, radicadoId: 'otro/subcoleccion/documento' }, { ...BODY_SIMI, radicadoId: 123 }])(
    'payload/identificador inválido devuelve 400 sin leer: %j', async (invalido) => {
      expect((await ejecutar(request(invalido))).status).toBe(400);
      expect(mocks.lecturas).toHaveLength(0);
      expect(mocks.escrituras).toHaveLength(0);
    },
  );

  it('JSON malformado devuelve 400 sin leer', async () => {
    const respuesta = await ejecutar(new Request('https://ventanilla.test/api', { method: 'POST', body: '{' }));
    expect(respuesta.status).toBe(400);
    expect(mocks.lecturas).toHaveLength(0);
    expect(mocks.escrituras).toHaveLength(0);
  });

  it.each(['JEFE_DEPENDENCIA', 'CONTROL_INTERNO'] as const)('conserva feedback permitido para %s', async (rol) => {
    mocks.autenticarUsuarioInterno.mockResolvedValue({ ok: true, usuario: { ...USUARIO, rol } });
    expect((await ejecutar(request(body))).status).toBe(200);
    expect(mocks.escrituras.length).toBeGreaterThan(0);
  });

  it('el ADMIN registra tenant y actor reales, no los del body ni su propia oficina', async () => {
    mocks.autenticarUsuarioInterno.mockResolvedValue({
      ok: true, usuario: { ...USUARIO, rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA' },
    });
    const respuesta = await ejecutar(request({ ...body, tenantId: 'SEC_PLANEACION', usuarioId: 'falso', usuarioUid: 'falso' }));
    expect(respuesta.status).toBe(200);
    expect(mocks.escrituras[0].datos.tenantId).toBe('SEC_GOBIERNO');
    expect(mocks.escrituras[0].datos.usuarioId ?? mocks.escrituras[0].datos.usuarioUid).toBe('actor-real');
  });
});

describe('Feedback IA — integridad atómica', () => {
  it.each(['DESCONOCIDO', '', 1, null])('rechaza puntuación inválida %j antes de leer', async (puntuacion) => {
    expect((await feedbackIa(request({ ...BODY_IA, puntuacion }))).status).toBe(400);
    expect(mocks.lecturas).toHaveLength(0);
    expect(mocks.escrituras).toHaveLength(0);
  });

  it('confirma feedback, radicado y auditoría en un solo commit', async () => {
    expect((await feedbackIa(request(BODY_IA))).status).toBe(200);
    expect(mocks.batch).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.escrituras.map(({ ruta }) => ruta)).toEqual([
      'ai_feedback/id-auto', RUTA_RADICADO, 'ai_auditoria/id-auto',
    ]);
    expect(mocks.escrituras[2].datos).toMatchObject({ usuarioId: 'actor-real', tenantId: 'SEC_GOBIERNO' });
  });

  it('si falla el commit devuelve 500 genérico y no persiste ninguna escritura parcial', async () => {
    mocks.commit.mockRejectedValue(new Error('detalle interno privado'));
    const respuesta = await feedbackIa(request(BODY_IA));
    expect(respuesta.status).toBe(500);
    await expect(respuesta.json()).resolves.toEqual({ error: 'Error al registrar feedback de IA.' });
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.escrituras).toHaveLength(0);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});

describe('Feedback SIMI — vínculo de auditoría', () => {
  it('acepta auditoría emitida para el mismo radicado', async () => {
    mocks.documentos.set('simi_auditoria/audit-1', { radicadoId: RADICADO_ID, tenantId: 'VENTANILLA_UNICA' });
    expect((await feedbackSimi(request({ ...BODY_SIMI, auditoriaId: 'audit-1' }))).status).toBe(200);
    expect(mocks.escrituras[0].datos).toMatchObject({ auditoriaId: 'audit-1', tenantId: 'SEC_GOBIERNO' });
  });

  it('rechaza auditoría de otro radicado antes de escribir', async () => {
    mocks.documentos.set('simi_auditoria/audit-1', { radicadoId: 'radicado-ajeno' });
    expect((await feedbackSimi(request({ ...BODY_SIMI, auditoriaId: 'audit-1' }))).status).toBe(403);
    expect(mocks.agregar).not.toHaveBeenCalled();
    expect(mocks.escrituras).toHaveLength(0);
  });

  it('auditoría inexistente devuelve 404 y no escribe', async () => {
    expect((await feedbackSimi(request({ ...BODY_SIMI, auditoriaId: 'audit-1' }))).status).toBe(404);
    expect(mocks.escrituras).toHaveLength(0);
  });

  it.each([123, 'otro/sub/documento'])('auditoriaId inválido %j devuelve 400 antes de leer', async (auditoriaId) => {
    expect((await feedbackSimi(request({ ...BODY_SIMI, auditoriaId }))).status).toBe(400);
    expect(mocks.lecturas).toHaveLength(0);
    expect(mocks.escrituras).toHaveLength(0);
  });

  it('fallo al persistir devuelve 500 genérico sin éxito ficticio', async () => {
    mocks.agregar.mockRejectedValue(new Error('detalle interno privado'));
    const respuesta = await feedbackSimi(request(BODY_SIMI));
    expect(respuesta.status).toBe(500);
    await expect(respuesta.json()).resolves.toEqual({ error: 'No se pudo guardar el feedback.' });
    expect(mocks.escrituras).toHaveLength(0);
    expect(mocks.logError).toHaveBeenCalledOnce();
  });
});
