/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActiveInternalUser: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/lib/server/internal-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/internal-auth')>();
  return {
    ...actual,
    requireActiveInternalUser: mocks.requireActiveInternalUser,
  };
});

vi.mock('@/lib/logger', () => ({ logError: mocks.logError }));

import { autenticarUsuarioInterno } from '@/lib/server/internal-auth-http';
import { InternalAuthError, type InternalUserSession } from '@/lib/server/internal-auth';

const USUARIO: InternalUserSession = {
  uid: 'u-1',
  email: 'usuario@simacota.gov.co',
  nombre: 'Usuario de prueba',
  rol: 'FUNCIONARIO',
  tenantId: 'SEC_GOBIERNO',
  activo: true,
};

beforeEach(() => vi.clearAllMocks());

describe('autenticarUsuarioInterno', () => {
  it('entrega la sesion valida sin modificarla', async () => {
    mocks.requireActiveInternalUser.mockResolvedValue(USUARIO);

    await expect(autenticarUsuarioInterno()).resolves.toEqual({ ok: true, usuario: USUARIO });
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it.each([401, 403] as const)('conserva el %s de un error de identidad conocido', async (status) => {
    mocks.requireActiveInternalUser.mockRejectedValue(
      new InternalAuthError(status === 401 ? 'No autorizado.' : 'Sin permisos.', status),
    );

    const resultado = await autenticarUsuarioInterno();
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('Se esperaba una denegacion.');

    expect(resultado.status).toBe(status);
    expect(resultado.respuesta.status).toBe(status);
    await expect(resultado.respuesta.json()).resolves.toEqual({ error: resultado.mensaje });
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it('registra y convierte un fallo de infraestructura en 500 generico', async () => {
    const error = new Error('detalle interno que no debe filtrarse');
    mocks.requireActiveInternalUser.mockRejectedValue(error);

    const resultado = await autenticarUsuarioInterno();
    expect(resultado.ok).toBe(false);
    if (resultado.ok) throw new Error('Se esperaba una denegacion.');

    expect(resultado.status).toBe(500);
    expect(resultado.mensaje).toBe('Ocurrió un error interno. Intente de nuevo.');
    await expect(resultado.respuesta.json()).resolves.toEqual({
      error: 'Ocurrió un error interno. Intente de nuevo.',
    });
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({
      modulo: 'autenticacion-interna/verificar-sesion',
      error,
    }));
  });
});
