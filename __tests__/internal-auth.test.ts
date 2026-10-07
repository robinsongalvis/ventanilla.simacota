/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieValue: 'cookie-valida' as string | undefined,
  verifySessionCookie: vi.fn(),
  leerUsuario: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => mocks.cookieValue === undefined ? undefined : { value: mocks.cookieValue },
  }),
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({ verifySessionCookie: mocks.verifySessionCookie }),
  getFirebaseAdminDb: () => ({
    doc: () => ({ get: mocks.leerUsuario }),
  }),
}));

import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { RolInterno } from '@/lib/hooks/useAuth';

const PERFIL_VALIDO = {
  rol: 'FUNCIONARIO',
  tenantId: 'SEC_GOBIERNO',
  activo: true,
  nombre: 'Funcionaria de prueba',
  email: 'funcionaria@example.test',
};

function documentoUsuario(
  data: Record<string, unknown> = PERFIL_VALIDO,
  exists = true,
) {
  return { exists, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookieValue = 'cookie-valida';
  mocks.verifySessionCookie.mockResolvedValue({
    uid: 'uid-interno',
    email: 'token@example.test',
  });
  mocks.leerUsuario.mockResolvedValue(documentoUsuario());
});

describe('requireActiveInternalUser', () => {
  it('responde 401 cuando falta la cookie sin consultar Firebase', async () => {
    mocks.cookieValue = undefined;

    await expect(requireActiveInternalUser()).rejects.toMatchObject({
      message: 'No autorizado.',
      status: 401,
    });
    expect(mocks.verifySessionCookie).not.toHaveBeenCalled();
    expect(mocks.leerUsuario).not.toHaveBeenCalled();
  });

  it.each([
    'auth/argument-error',
    'auth/session-cookie-expired',
    'auth/session-cookie-revoked',
    'auth/user-disabled',
    'auth/user-not-found',
  ])('convierte %s en una sesión inválida 401', async (code) => {
    mocks.verifySessionCookie.mockRejectedValue(Object.assign(new Error('rechazada'), { code }));

    await expect(requireActiveInternalUser()).rejects.toMatchObject({
      message: 'Sesión inválida o expirada.',
      status: 401,
    });
    expect(mocks.leerUsuario).not.toHaveBeenCalled();
  });

  it('no disfraza un fallo inesperado de Auth como credencial inválida', async () => {
    const error = Object.assign(new Error('servicio no disponible'), { code: 'auth/internal-error' });
    mocks.verifySessionCookie.mockRejectedValue(error);

    await expect(requireActiveInternalUser()).rejects.toBe(error);
  });

  it('no disfraza una credencial de Admin SDK inválida como sesión del usuario', async () => {
    const error = Object.assign(new Error('Firebase Admin mal configurado'), {
      code: 'auth/invalid-credential',
    });
    mocks.verifySessionCookie.mockRejectedValue(error);

    await expect(requireActiveInternalUser()).rejects.toBe(error);
  });

  it('no disfraza una caída de Firestore como credencial inválida', async () => {
    const error = new Error('Firestore no disponible');
    mocks.leerUsuario.mockRejectedValue(error);

    await expect(requireActiveInternalUser()).rejects.toBe(error);
  });

  it('rechaza con 403 una sesión válida sin perfil interno', async () => {
    mocks.leerUsuario.mockResolvedValue(documentoUsuario({}, false));

    await expect(requireActiveInternalUser()).rejects.toMatchObject({
      message: 'Usuario interno no registrado.',
      status: 403,
    });
  });

  it.each([
    ['inactivo', { ...PERFIL_VALIDO, activo: false }],
    ['archivado', { ...PERFIL_VALIDO, archivado: true }],
  ])('rechaza con 403 un usuario %s', async (_caso, perfil) => {
    mocks.leerUsuario.mockResolvedValue(documentoUsuario(perfil));

    await expect(requireActiveInternalUser()).rejects.toMatchObject({
      message: 'Usuario inactivo o archivado.',
      status: 403,
    });
  });

  it.each([
    ['rol no oficial', { ...PERFIL_VALIDO, rol: 'SUPER_ADMIN' }],
    ['tenant ausente', { ...PERFIL_VALIDO, tenantId: undefined }],
    ['tenant no oficial', { ...PERFIL_VALIDO, tenantId: 'TENANT_INVENTADO' }],
  ])('rechaza con 403 un perfil con %s', async (_caso, perfil) => {
    mocks.leerUsuario.mockResolvedValue(documentoUsuario(perfil));

    await expect(requireActiveInternalUser()).rejects.toMatchObject({
      message: 'Usuario interno sin permisos válidos.',
      status: 403,
    });
  });

  it.each<RolInterno>([
    'ADMIN',
    'RECEPCIONISTA',
    'FUNCIONARIO',
    'JEFE_DEPENDENCIA',
    'CONTROL_INTERNO',
  ])('admite el rol interno %s con tenant oficial', async (rol) => {
    mocks.leerUsuario.mockResolvedValue(documentoUsuario({ ...PERFIL_VALIDO, rol }));

    await expect(requireActiveInternalUser()).resolves.toMatchObject({
      uid: 'uid-interno',
      rol,
      tenantId: 'SEC_GOBIERNO',
      activo: true,
    });
  });

  it('incluye un cargo real y no inventa uno cuando falta', async () => {
    mocks.leerUsuario.mockResolvedValueOnce(documentoUsuario({
      ...PERFIL_VALIDO,
      cargo: '  Secretaria de Gobierno  ',
    }));

    await expect(requireActiveInternalUser()).resolves.toMatchObject({
      cargo: 'Secretaria de Gobierno',
    });

    const sinCargo = await requireActiveInternalUser();
    expect(sinCargo).not.toHaveProperty('cargo');
  });

  it('los rechazos de dominio siguen siendo InternalAuthError', async () => {
    mocks.cookieValue = undefined;

    await expect(requireActiveInternalUser()).rejects.toBeInstanceOf(InternalAuthError);
  });
});
