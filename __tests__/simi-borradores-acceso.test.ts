/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalUserSession } from '@/lib/server/internal-auth';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), radicado: vi.fn(), versiones: vi.fn(), guardar: vi.fn(), aprobacion: vi.fn(),
}));
vi.mock('@/lib/server/internal-auth-http', () => ({ autenticarUsuarioInterno: mocks.auth }));
vi.mock('@/lib/server/radicados-security', () => {
  class RadicadoActionError extends Error {
    constructor(message: string, readonly status: number) { super(message); }
  }
  return { getRadicadoOrFail: mocks.radicado, RadicadoActionError };
});
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({ collection: () => ({ doc: () => ({ get: mocks.aprobacion }) }) }),
}));
vi.mock('@/lib/simi-juridico/borradorVersiones', () => ({
  getVersionesBorrador: mocks.versiones, guardarVersionBorrador: mocks.guardar,
}));
import { GET, POST } from '@/app/api/simi/borradores/route';
import { RadicadoActionError } from '@/lib/server/radicados-security';

let usuario: InternalUserSession;
function solicitud(body: object = { radicadoId: 'RAD-1', contenido: 'Borrador de prueba' }) {
  return new Request('https://ventanilla.test/api/simi/borradores?radicadoId=RAD-1', {
    method: 'POST', body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  usuario = { uid: 'interno', nombre: 'Prueba', email: 'prueba@example.test',
    rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO', activo: true };
  mocks.auth.mockResolvedValue({ ok: true, usuario });
  mocks.radicado.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_GOBIERNO' } });
  mocks.versiones.mockResolvedValue([]);
  mocks.guardar.mockResolvedValue({ versionId: 'v1', numeroVersion: 1 });
  mocks.aprobacion.mockResolvedValue({ exists: true, data: () => ({ radicadoId: 'RAD-1' }) });
});

describe('Borradores: el radicado autoriza el acceso y sus vínculos', () => {
  it.each(['GET', 'POST'] as const)('%s rechaza tenant ajeno antes de leer o escribir versiones', async (metodo) => {
    mocks.radicado.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
    const res = await (metodo === 'GET' ? GET(solicitud()) : POST(solicitud()));
    expect(res.status).toBe(403);
    expect(mocks.versiones).not.toHaveBeenCalled();
    expect(mocks.guardar).not.toHaveBeenCalled();
    expect(mocks.aprobacion).not.toHaveBeenCalled();
  });
  it('ADMIN conserva alcance global y guarda el tenant del radicado, no el propio', async () => {
    usuario.rol = 'ADMIN';
    mocks.radicado.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
    expect((await POST(solicitud())).status).toBe(200);
    expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'SEC_HACIENDA', usuarioId: 'interno' }));
  });
  it('permite leer las versiones del expediente propio', async () => {
    expect((await GET(solicitud())).status).toBe(200);
    expect(mocks.versiones).toHaveBeenCalledWith('RAD-1');
  });
  it('rechaza aprobación vinculada a otro radicado sin guardar', async () => {
    mocks.aprobacion.mockResolvedValue({ exists: true, data: () => ({ radicadoId: 'RAD-2' }) });
    expect((await POST(solicitud({ radicadoId: 'RAD-1', contenido: 'Prueba', approvalId: 'a1' }))).status).toBe(403);
    expect(mocks.guardar).not.toHaveBeenCalled();
  });
  it('acepta aprobación del mismo radicado aunque ADMIN la haya originado desde otra dependencia', async () => {
    mocks.aprobacion.mockResolvedValue({ exists: true, data: () => ({ radicadoId: 'RAD-1', tenantId: 'VENTANILLA_UNICA' }) });
    expect((await POST(solicitud({ radicadoId: 'RAD-1', contenido: 'Prueba', approvalId: 'a1' }))).status).toBe(200);
  });
  it('radicado inexistente devuelve 404 sin versiones', async () => {
    mocks.radicado.mockRejectedValue(new RadicadoActionError('Radicado no encontrado.', 404));
    expect((await GET(solicitud())).status).toBe(404);
    expect(mocks.versiones).not.toHaveBeenCalled();
  });
  it.each(['GET', 'POST'] as const)('%s no presenta como éxito un fallo de Firestore', async (metodo) => {
    mocks.versiones.mockRejectedValue(new Error('fallo privado'));
    mocks.guardar.mockRejectedValue(new Error('fallo privado'));
    const res = await (metodo === 'GET' ? GET(solicitud()) : POST(solicitud()));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('fallo privado');
  });
  it.each([
    { radicadoId: 'col/doc', contenido: 'Prueba' },
    { radicadoId: 'RAD-1', contenido: {}, approvalId: 'a1' },
    { radicadoId: 'RAD-1', contenido: 'Prueba', approvalId: 'col/doc' },
  ])('rechaza payload inválido antes de Firebase: %j', async (body) => {
    expect((await POST(solicitud(body))).status).toBe(400);
    expect(mocks.radicado).not.toHaveBeenCalled();
  });
});
