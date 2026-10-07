/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dobles = vi.hoisted(() => ({
  auth: vi.fn(),
  db: vi.fn(() => { throw new Error('No se debe acceder a Firestore.'); }),
  storage: vi.fn(() => { throw new Error('No se debe acceder a Storage.'); }),
}));

vi.mock('@/lib/firebase-admin', () => ({ getFirebaseAdminDb: dobles.db, getFirebaseAdminStorage: dobles.storage }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/server/internal-auth', () => ({
  requireActiveInternalUser: dobles.auth,
  InternalAuthError: class extends Error { status = 401; },
  canOperateTenant: (usuario: { rol: string }) => usuario.rol === 'ADMIN',
}));

import { POST as radicacionPublica } from '@/app/api/radicacion/route';
import { POST as registroExpres } from '@/app/api/dependencias/registro-expres/route';
import { POST as radicacionLicencia } from '@/app/api/licencias/expedientes/[id]/radicar/route';
import { InternalAuthError } from '@/lib/server/internal-auth';
import { CONTINGENCIA_STORAGE_ACTIVA } from '@/lib/recepcion/contingencia-storage';

beforeEach(() => {
  vi.clearAllMocks();
  dobles.auth.mockResolvedValue({ uid: 'sintetico', nombre: 'Prueba local', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA' });
});

describe('contingencia: ningún emisor alternativo consume o reserva la serie', () => {
  it('el gate real del código está activo (no se mockea la constante)', () => {
    expect(CONTINGENCIA_STORAGE_ACTIVA).toBe(true);
  });

  it.each(['publica', 'expres', 'licencia'] as const)('%s responde503 antes de leer body, Storage o Firestore', async (ruta) => {
    const request = new Request('https://stage.invalid/api/prueba', { method: 'POST', body: 'no-es-json-ni-formdata' });
    const response = ruta === 'publica' ? await radicacionPublica(request)
      : ruta === 'expres' ? await registroExpres(request)
        : await radicacionLicencia(request, { params: Promise.resolve({ id: 'sintetico' }) });
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty('error');
    expect(dobles.db).not.toHaveBeenCalled();
    expect(dobles.storage).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });

  it.each(['expres', 'licencia'] as const)('%s conserva401 sin sesión', async (ruta) => {
    dobles.auth.mockRejectedValue(new InternalAuthError('Sesión requerida.', 401));
    const request = new Request('https://stage.invalid/api/prueba', { method: 'POST' });
    const response = ruta === 'expres' ? await registroExpres(request)
      : await radicacionLicencia(request, { params: Promise.resolve({ id: 'sintetico' }) });
    expect(response.status).toBe(401);
    expect(dobles.db).not.toHaveBeenCalled();
  });

  it.each(['expres', 'licencia'] as const)('%s conserva403 con rol ajeno', async (ruta) => {
    dobles.auth.mockResolvedValue({ uid: 'sintetico', rol: 'CONTROL_INTERNO' });
    const request = new Request('https://stage.invalid/api/prueba', { method: 'POST' });
    const response = ruta === 'expres' ? await registroExpres(request)
      : await radicacionLicencia(request, { params: Promise.resolve({ id: 'sintetico' }) });
    expect(response.status).toBe(403);
    expect(dobles.db).not.toHaveBeenCalled();
  });
});
