/** @vitest-environment node */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), add: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    collection: () => ({
      where: () => ({ orderBy: () => ({ limit: () => ({ get: mocks.get }) }) }),
      add: mocks.add,
    }),
  }),
}));
import { getVersionesBorrador, guardarVersionBorrador } from '@/lib/simi-juridico/borradorVersiones';

beforeEach(() => { vi.clearAllMocks(); });
it('no inventa versión1 ni escribe cuando falla la lectura de versiones previas', async () => {
  mocks.get.mockRejectedValue(new Error('Fallo de índice simulado'));
  await expect(guardarVersionBorrador({
    radicadoId: 'RAD-1', tenantId: 'SEC_GOBIERNO', contenido: 'Prueba',
    generadoPorSimi: false, editadoPorHumano: true,
    usuarioId: 'interno', usuarioNombre: 'Prueba', usuarioRol: 'FUNCIONARIO',
  })).rejects.toThrow('Fallo de índice simulado');
  expect(mocks.add).not.toHaveBeenCalled();
});
it('no devuelve historial vacío cuando falla Firestore', async () => {
  mocks.get.mockRejectedValue(new Error('Fallo simulado'));
  await expect(getVersionesBorrador('RAD-1')).rejects.toThrow('Fallo simulado');
});
it('historial realmente vacío sí es un resultado válido', async () => {
  mocks.get.mockResolvedValue({ docs: [], empty: true });
  expect(await getVersionesBorrador('RAD-1')).toEqual([]);
});
