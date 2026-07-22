/**
 * Pieza angular (P2.1, Fase 2) — matriz de AUTORIZACIÓN del endpoint nuevo
 * `app/api/radicacion/interna`.
 *
 * `requireActiveInternalUser()` NO basta: admite FUNCIONARIO/
 * JEFE_DEPENDENCIA/CONTROL_INTERNO además de ADMIN/RECEPCIONISTA. La regla
 * que hoy protege el `create` de `ventanilla_radicados`
 * (`firestore.rules:143`) solo permite ADMIN o RECEPCIONISTA — el endpoint
 * debe replicar ese gate EXPLÍCITAMENTE (blueprint §Reimplementación de
 * autorización). Sin sesión → 401 (InternalAuthError propagado desde
 * `requireActiveInternalUser`).
 *
 * Maneja el handler POST real; solo mockea las fronteras (Admin SDK,
 * sesión). No toca Firebase real ni el emulador.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RolInterno } from '@/lib/hooks/useAuth';

let rolSimulado: RolInterno | 'SIN_SESION' = 'ADMIN';

vi.mock('@/lib/server/internal-auth', () => {
  class InternalAuthError extends Error {
    status: 401 | 403;
    constructor(message: string, status: 401 | 403 = 401) {
      super(message);
      this.status = status;
    }
  }
  return {
    InternalAuthError,
    requireActiveInternalUser: vi.fn(async () => {
      if (rolSimulado === 'SIN_SESION') {
        throw new InternalAuthError('No autorizado.', 401);
      }
      return {
        uid: 'u1', nombre: 'Actor de prueba', rol: rolSimulado, tenantId: 'VENTANILLA_UNICA', activo: true,
      };
    }),
  };
});

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (path: string) => ({ path, id: path.split('/').pop() }),
    runTransaction: async () => { throw new Error('la tx no debe alcanzarse en 401/403'); },
  }),
  getFirebaseAdminStorage: () => ({
    bucket: () => ({ file: () => ({ save: async () => {}, move: async () => {} }) }),
  }),
}));

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

import { POST } from '@/app/api/radicacion/interna/route';

function formularioMinimo(): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', 'Juan Perez');
  f.append('numeroDocumento', '123456');
  f.append('asunto', 'Asunto de prueba');
  f.append('descripcion', 'Descripcion de prueba para el radicado interno.');
  return f;
}

beforeEach(() => {
  rolSimulado = 'ADMIN';
});

async function llamar(): Promise<Response> {
  const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: formularioMinimo() });
  return POST(req);
}

describe('api/radicacion/interna — matriz de autorización', () => {
  it('sin sesión → 401', async () => {
    rolSimulado = 'SIN_SESION';
    const res = await llamar();
    expect(res.status).toBe(401);
  });

  it('FUNCIONARIO → 403 (regresión de authz: requireActiveInternalUser NO basta)', async () => {
    rolSimulado = 'FUNCIONARIO';
    const res = await llamar();
    expect(res.status).toBe(403);
  });

  it('JEFE_DEPENDENCIA → 403', async () => {
    rolSimulado = 'JEFE_DEPENDENCIA';
    const res = await llamar();
    expect(res.status).toBe(403);
  });

  it('CONTROL_INTERNO → 403', async () => {
    rolSimulado = 'CONTROL_INTERNO';
    const res = await llamar();
    expect(res.status).toBe(403);
  });

  it('ADMIN → pasa el gate de rol (no 401/403)', async () => {
    rolSimulado = 'ADMIN';
    const res = await llamar();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('RECEPCIONISTA → pasa el gate de rol (no 401/403)', async () => {
    rolSimulado = 'RECEPCIONISTA';
    const res = await llamar();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
