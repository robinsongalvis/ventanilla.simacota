/**
 * Auditoría de seguridad — hallazgo M-3 (Roadmap P2.6).
 *
 * `app/api/simi/notificaciones/whatsapp/route.ts` validaba el gate de tenant
 * del USUARIO pero nunca cargaba el radicado para confirmar que `radicadoId`
 * le pertenece, y el `telefono` destino era un valor arbitrario del body.
 * Un funcionario autenticado podía notificar CUALQUIER radicado a un número
 * que él controlara (fuga/suplantación de PII).
 *
 * Estrategia: solo se mockean fronteras (cookies/sesión, Admin SDK,
 * radicados-security, el proveedor de WhatsApp); el handler POST real se
 * invoca de punta a punta, igual que en subsanacion-rutas-ejecucion.test.ts.
 * `isValidWhatsAppPhone`/`normalizePhone` corren con su implementación real
 * (son funciones puras sin dependencias externas).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';

/* ── Estado mutable de los fixtures (leído por los mocks) ─────────── */

let cookieValue: string | undefined;
let userDoc: {
  nombre?: string;
  rol?: string;
  tenantId?: string;
  activo?: boolean;
  archivado?: boolean;
} | null;
let radicadoFixture: {
  clasificacion: { oficinaDestino: string };
  solicitante: { telefonoMovil?: string | null; telefono?: string | null };
} | null;
let sendResult: { ok: boolean; provider: string; simulated?: boolean; messageId?: string; error?: string };
let sendCalls: Array<Record<string, unknown>>;

/* ── Mocks de fronteras ─────────────────────────────────────────── */

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieValue !== undefined && name === SESSION_COOKIE_NAME ? { value: cookieValue } : undefined,
  })),
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: vi.fn(async (sc: string) => {
      if (sc !== 'valid-cookie') throw new Error('Sesión inválida.');
      return { uid: 'u1', email: 'funcionario@simacota.gov.co' };
    }),
  }),
  getFirebaseAdminDb: () => ({
    doc: (path: string) => ({
      get: async () => {
        if (path === 'users/u1' && userDoc) {
          return { exists: true, data: () => userDoc };
        }
        return { exists: false, data: () => undefined };
      },
    }),
  }),
}));

vi.mock('@/lib/server/radicados-security', () => {
  class RadicadoActionError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    RadicadoActionError,
    getRadicadoOrFail: vi.fn(async () => {
      if (!radicadoFixture) throw new RadicadoActionError('Radicado no encontrado.', 404);
      return radicadoFixture;
    }),
  };
});

vi.mock('@/lib/simi-juridico/sendCitizenWhatsAppNotification', () => ({
  sendCitizenWhatsAppNotification: vi.fn(async (params: Record<string, unknown>) => {
    sendCalls.push(params);
    return sendResult;
  }),
}));

import { POST } from '@/app/api/simi/notificaciones/whatsapp/route';
import { sendCitizenWhatsAppNotification } from '@/lib/simi-juridico/sendCitizenWhatsAppNotification';

/* ── Helpers ────────────────────────────────────────────────────── */

function req(body: unknown): Request {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
}

const BODY_BASE = {
  radicadoId: 'r1',
  telefono: '3101234567',
  eventType: 'radicado_recibido' as const,
  consentimiento: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  cookieValue = 'valid-cookie';
  userDoc = { nombre: 'Ana Funcionaria', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO', activo: true };
  radicadoFixture = {
    clasificacion: { oficinaDestino: 'SEC_GOBIERNO' },
    solicitante: { telefonoMovil: '3101234567' },
  };
  sendResult = { ok: true, provider: 'mock', simulated: true, messageId: 'msg_1' };
  sendCalls = [];
});

describe('POST /api/simi/notificaciones/whatsapp — pertenencia radicado-tenant y teléfono del solicitante', () => {
  it('caso feliz — radicado propio + teléfono del solicitante → envía y usa el teléfono REGISTRADO', async () => {
    const res = await POST(req(BODY_BASE));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(sendCitizenWhatsAppNotification).toHaveBeenCalledOnce();
    expect(sendCalls[0]).toMatchObject({
      radicadoId: 'R1',
      tenantId: 'SEC_GOBIERNO',
      to: '3101234567',
    });
  });

  it('radicado de otro tenant — FUNCIONARIO de otro tenant → 403, no envía', async () => {
    userDoc = { nombre: 'Ana', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA', activo: true };
    // radicadoFixture sigue en SEC_GOBIERNO: fuera del alcance del usuario.
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(403);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('ADMIN puede notificar un radicado de cualquier tenant (si el teléfono coincide) → 200', async () => {
    userDoc = { nombre: 'Root', rol: 'ADMIN', tenantId: 'SEC_HACIENDA', activo: true };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(200);
    expect(sendCitizenWhatsAppNotification).toHaveBeenCalledOnce();
  });

  it('teléfono que no coincide con el solicitante → rechazado (403), no envía', async () => {
    const res = await POST(req({ ...BODY_BASE, telefono: '3009999999' }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toMatch(/no coincide/i);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('teléfono con formato distinto pero mismo número (con +57) → coincide y envía', async () => {
    const res = await POST(req({ ...BODY_BASE, telefono: '+57 310 123 4567' }));
    expect(res.status).toBe(200);
    expect(sendCitizenWhatsAppNotification).toHaveBeenCalledOnce();
  });

  it('radicado inexistente → 404, no envía', async () => {
    radicadoFixture = null;
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(404);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('radicado sin teléfono móvil registrado del solicitante → 422, no envía', async () => {
    radicadoFixture = { clasificacion: { oficinaDestino: 'SEC_GOBIERNO' }, solicitante: {} };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(422);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('compatibilidad — usa el `telefono` legado del solicitante si no hay `telefonoMovil`', async () => {
    radicadoFixture = {
      clasificacion: { oficinaDestino: 'SEC_GOBIERNO' },
      solicitante: { telefono: '3101234567' },
    };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(200);
    expect(sendCalls[0]).toMatchObject({ to: '3101234567' });
  });

  it('sin consentimiento en el body → 422, no envía (comportamiento preexistente)', async () => {
    const res = await POST(req({ ...BODY_BASE, consentimiento: false }));

    expect(res.status).toBe(422);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });

  it('sin sesión → 401', async () => {
    cookieValue = undefined;
    const res = await POST(req(BODY_BASE));
    expect(res.status).toBe(401);
  });

  it('rol sin permiso (CONTROL_INTERNO) → 403 antes de tocar el radicado', async () => {
    userDoc = { nombre: 'Aud', rol: 'CONTROL_INTERNO', tenantId: 'SEC_GOBIERNO', activo: true };
    const res = await POST(req(BODY_BASE));

    expect(res.status).toBe(403);
    expect(sendCitizenWhatsAppNotification).not.toHaveBeenCalled();
  });
});
