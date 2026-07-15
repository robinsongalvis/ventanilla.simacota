/**
 * BM-B33 pieza (5) — ejecución REAL de las rutas (cierra el hueco de QA: los
 * guards de grep no verifican comportamiento). Mockea solo fronteras (auth,
 * radicados-security, firebase-admin, correo) e invoca el handler POST real;
 * las funciones de decisión (lib/server/subsanacion) corren de verdad.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let sesion: { uid: string; nombre: string; rol: string; tenantId: string };
let radicadoFixture: unknown;
let lastUpdate: Record<string, unknown> | null;

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: class extends Error { status = 401; },
  requireActiveInternalUser: vi.fn(async () => sesion),
  // Lógica real (pura) inlined para el test:
  canOperateTenant: (u: { rol: string; tenantId: string }, t: string) =>
    u.rol === 'ADMIN' || u.rol === 'RECEPCIONISTA' || (u.rol === 'FUNCIONARIO' && u.tenantId === t),
  canConfirmarDesistimiento: (u: { rol: string; tenantId: string }, t: string) =>
    u.rol === 'ADMIN' || (u.rol === 'JEFE_DEPENDENCIA' && u.tenantId === t),
}));

vi.mock('@/lib/server/radicados-security', () => ({
  RadicadoActionError: class extends Error { status: number; constructor(m: string, s: number) { super(m); this.status = s; } },
  getRadicadoOrFail: vi.fn(async () => radicadoFixture),
  assertNotClosed: () => {},
  appendTrazabilidadAdmin: vi.fn(async () => {}),
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({ doc: () => ({ update: async (u: Record<string, unknown>) => { lastUpdate = u; } }) }),
}));

vi.mock('@/lib/email/mailer', () => ({ enviarEmail: vi.fn(async () => {}) }));
vi.mock('@/lib/email/debe-notificar-ciudadano', () => ({ debeNotificarCiudadano: () => true }));
vi.mock('@/lib/trazabilidad/notificacion', () => ({ registrarTrazabilidadNotificacion: vi.fn(async () => {}) }));
vi.mock('@/lib/logger', () => ({ logError: () => {} }));

import { POST as reactivarPOST } from '@/app/api/radicados/[radicadoId]/reactivar-subsanacion/route';
import { POST as desistimientoPOST } from '@/app/api/radicados/[radicadoId]/desistimiento/route';

function req(body: unknown): Request {
  return new Request('http://x', { method: 'POST', body: JSON.stringify(body) });
}
const ctx = { params: Promise.resolve({ radicadoId: 'R1' }) };
function suspensionActiva(fechaLimite: string) {
  return { activa: true, fechaRequerimiento: '', fechaNotificacion: '2026-06-03T12:00:00Z',
    fechaLimiteSubsanacion: fechaLimite, diasHabilesRestantes: 5, motivo: 'x',
    requeridoPor: { uid: 'u', nombre: 'M' }, prorroga: null };
}

beforeEach(() => {
  lastUpdate = null;
  sesion = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO', tenantId: 'VENTANILLA_UNICA' };
});

describe('reactivar-subsanacion — estrictez de "suficiente" (regresión de seguridad)', () => {
  beforeEach(() => {
    radicadoFixture = { estadoActual: 'EN_SUBSANACION', clasificacion: { oficinaDestino: 'VENTANILLA_UNICA' },
      termino: { suspension: suspensionActiva('2026-07-03T12:00:00Z') } };
  });

  it('suficiente === true → reactiva (EN_PROCESO)', async () => {
    const res = await reactivarPOST(req({ suficiente: true }), ctx);
    expect(res.status).toBe(200);
    expect(lastUpdate?.estadoActual).toBe('EN_PROCESO');
  });

  it('suficiente = "true" (string truthy) → NO reactiva (400)', async () => {
    const res = await reactivarPOST(req({ suficiente: 'true' }), ctx);
    expect(res.status).toBe(400);
    expect(lastUpdate).toBeNull(); // no escribió nada
  });

  it('sin suficiente → NO reactiva (400)', async () => {
    const res = await reactivarPOST(req({}), ctx);
    expect(res.status).toBe(400);
  });
});

describe('desistimiento — permiso por rol (acto administrativo)', () => {
  beforeEach(() => {
    // Fecha límite claramente pasada → siempre vencido, sin depender del reloj real.
    radicadoFixture = { estadoActual: 'EN_SUBSANACION', canalRespuesta: 'PRESENCIAL',
      clasificacion: { oficinaDestino: 'VENTANILLA_UNICA' }, solicitante: { email: null },
      termino: { suspension: suspensionActiva('2020-01-01T12:00:00Z') } };
  });

  it('FUNCIONARIO no puede confirmar desistimiento → 403', async () => {
    sesion = { uid: 'u1', nombre: 'María', rol: 'FUNCIONARIO', tenantId: 'VENTANILLA_UNICA' };
    const res = await desistimientoPOST(req({ motivo: 'El ciudadano no aportó lo requerido en el plazo.' }), ctx);
    expect(res.status).toBe(403);
    expect(lastUpdate).toBeNull();
  });

  it('JEFE_DEPENDENCIA del tenant + plazo vencido → DESISTIDO', async () => {
    sesion = { uid: 'j1', nombre: 'Jefe', rol: 'JEFE_DEPENDENCIA', tenantId: 'VENTANILLA_UNICA' };
    // ahora (fecha del test) es real y muy posterior a 2026-07-03 → vencido.
    const res = await desistimientoPOST(req({ motivo: 'El ciudadano no aportó lo requerido en el plazo.' }), ctx);
    expect(res.status).toBe(200);
    expect(lastUpdate?.estadoActual).toBe('DESISTIDO');
  });
});
