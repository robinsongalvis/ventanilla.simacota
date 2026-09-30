/** @vitest-environment node */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), radicado: vi.fn(), db: vi.fn(), ia: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/server/internal-auth-http', () => ({ autenticarUsuarioInterno: mocks.auth }));
vi.mock('@/lib/server/radicados-security', () => {
  class RadicadoActionError extends Error { constructor(message: string, readonly status: number) { super(message); } }
  return { getRadicadoOrFail: mocks.radicado, RadicadoActionError };
});
vi.mock('@/lib/firebase', () => ({ getDb: mocks.db }));
vi.mock('@/lib/ai/agents', () => ({ invocarCopilotoEspecializado: mocks.ia }));
vi.mock('@/lib/ai/telemetry', () => ({ registrarLogIA: mocks.log }));
vi.mock('@/lib/ai/rate-limit', () => ({ checkRateLimit: () => null, rateLimitHeaders: () => ({}) }));
import { POST } from '@/app/api/ai/copilot/route';
import { RadicadoActionError } from '@/lib/server/radicados-security';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ ok: true, usuario: { uid: 'interno', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO' } });
  mocks.radicado.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_HACIENDA' } });
});
function solicitud(radicadoId = 'RAD-1') {
  return new Request('https://ventanilla.test/api/ai/copilot', { method: 'POST', body: JSON.stringify({ radicadoId }) });
}
it('deniega expediente ajeno antes de datos de contexto, telemetría o proveedor IA', async () => {
  expect((await POST(solicitud())).status).toBe(403);
  expect(mocks.db).not.toHaveBeenCalled();
  expect(mocks.ia).not.toHaveBeenCalled();
  expect(mocks.log).not.toHaveBeenCalled();
});
it('inexistente devuelve404 sin llamar al proveedor', async () => {
  mocks.radicado.mockRejectedValue(new RadicadoActionError('Radicado no encontrado.', 404));
  expect((await POST(solicitud())).status).toBe(404);
  expect(mocks.db).not.toHaveBeenCalled();
  expect(mocks.ia).not.toHaveBeenCalled();
});
it('id inválido no accede a Firebase', async () => {
  expect((await POST(solicitud('coleccion/documento'))).status).toBe(400);
  expect(mocks.radicado).not.toHaveBeenCalled();
});
it('el fallo del lector de contexto sigue siendo500, nunca una recomendación exitosa', async () => {
  mocks.radicado.mockResolvedValue({ clasificacion: { oficinaDestino: 'SEC_GOBIERNO' } });
  mocks.db.mockImplementation(() => { throw new Error('Fallo privado del lector'); });
  const res = await POST(solicitud());
  expect(res.status).toBe(500);
  expect(await res.text()).not.toContain('Fallo privado');
  expect(mocks.ia).not.toHaveBeenCalled();
});
