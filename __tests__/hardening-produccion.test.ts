import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { autorizarCron } from '@/lib/seguridad/autorizar-cron';
import {
  construirAiLogSeguro,
  validarTamanoPayloadAiLog,
  MAX_AI_LOG_PAYLOAD_BYTES,
} from '@/lib/seguridad/ai-log-seguro';

const mocks = vi.hoisted(() => {
  class MockInternalAuthError extends Error {
    constructor(message: string, public readonly status: 401 | 403 = 401) {
      super(message);
    }
  }

  return {
    MockInternalAuthError,
    requireActiveInternalUser: vi.fn(),
    checkRateLimit: vi.fn(),
    rateLimitHeaders: vi.fn((): HeadersInit => ({ 'X-RateLimit-Limit': '30' })),
    auditAdd: vi.fn(),
    logSet: vi.fn(),
    docFn: vi.fn(),
    collectionFn: vi.fn(),
  };
});

vi.mock('@/lib/server/internal-auth', () => ({
  InternalAuthError: mocks.MockInternalAuthError,
  requireActiveInternalUser: mocks.requireActiveInternalUser,
}));

vi.mock('@/lib/ai/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitHeaders: mocks.rateLimitHeaders,
}));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    collection: mocks.collectionFn,
  }),
}));

function usuario(rol = 'ADMIN') {
  return {
    uid: 'uid-1',
    email: 'admin@simacota.gov.co',
    nombre: 'Admin',
    rol,
    tenantId: 'VENTANILLA_UNICA',
    activo: true,
  };
}

function requestJson(body: unknown): Request {
  return new Request('http://localhost/api/ai/log', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('H-05 autorizarCron', () => {
  it('sin CRON_SECRET no ejecuta', () => {
    const decision = autorizarCron({ authorization: 'Bearer correcto', secret: undefined });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(503);
      expect(decision.mensaje).not.toContain('correcto');
    }
  });

  it('sin Authorization no ejecuta', () => {
    const decision = autorizarCron({ authorization: null, secret: 'secreto' });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.status).toBe(401);
  });

  it('token incorrecto no ejecuta y no filtra el secreto', () => {
    const decision = autorizarCron({ authorization: 'Bearer incorrecto', secret: 'secreto-real' });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.status).toBe(401);
      expect(JSON.stringify(decision)).not.toContain('secreto-real');
      expect(JSON.stringify(decision)).not.toContain('incorrecto');
    }
  });

  it('token correcto sí ejecuta', () => {
    expect(autorizarCron({ authorization: 'Bearer secreto-real', secret: 'secreto-real' })).toEqual({ ok: true });
  });

  it('todos los cron usan el helper y no conservan fail-open', () => {
    const cronFiles = [
      'app/api/cron/alertas-vencimiento/route.ts',
      'app/api/cron/simi/alertas-vencimiento/route.ts',
    ];

    for (const file of cronFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain("from '@/lib/seguridad/autorizar-cron'");
      expect(source).toContain('autorizarCron');
      expect(source).not.toContain('if (cronSecret &&');
    }
  });
});

describe('H-04 payload seguro de /api/ai/log', () => {
  it('payload inválido recibe rechazo', () => {
    const result = construirAiLogSeguro(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.motivo).toBe('PAYLOAD_INVALIDO');
  });

  it('payload demasiado grande se rechaza', () => {
    const result = validarTamanoPayloadAiLog('x'.repeat(MAX_AI_LOG_PAYLOAD_BYTES + 1));
    expect(result?.ok).toBe(false);
    if (result && !result.ok) expect(result.motivo).toBe('PAYLOAD_DEMASIADO_GRANDE');
  });

  it('no acepta campos sensibles o desconocidos', () => {
    const result = construirAiLogSeguro({
      endpoint: 'chat',
      latenciaMs: 123,
      email: 'persona@example.com',
      documento: '123456',
      prompt: 'texto completo',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.motivo).toBe('CAMPO_DESCONOCIDO');
  });

  it('no guarda prompt completo ni error con PII', () => {
    const result = construirAiLogSeguro({
      endpoint: 'chat',
      latenciaMs: 321,
      radicadoId: '1-WEB-2026-00000001',
      error: 'falló para persona@example.com tel 3001234567',
      fallbackActivo: true,
      promptVersion: 'simi:v1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        endpoint: 'chat',
        latenciaMs: 321,
        radicadoId: '1-WEB-2026-00000001',
        errorPresente: true,
        errorCategoria: 'ERROR_REGISTRADO',
        fallbackActivo: true,
        promptVersion: 'simi:v1',
      });
      expect(JSON.stringify(result.data)).not.toContain('persona@example.com');
      expect(JSON.stringify(result.data)).not.toContain('3001234567');
    }
  });
});

describe('H-04 ruta /api/ai/log', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireActiveInternalUser.mockReset();
    mocks.checkRateLimit.mockReset();
    mocks.rateLimitHeaders.mockReset().mockReturnValue({ 'X-RateLimit-Limit': '30', 'Retry-After': '60' } as HeadersInit);
    mocks.auditAdd.mockReset().mockResolvedValue({ id: 'audit-1' });
    mocks.logSet.mockReset().mockResolvedValue(undefined);
    mocks.docFn.mockReset().mockReturnValue({ id: 'log-1', set: mocks.logSet });
    mocks.collectionFn.mockReset().mockImplementation((name: string) => {
      if (name === 'ai_logs') return { doc: mocks.docFn };
      return { add: mocks.auditAdd };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usuario sin sesión recibe 401', async () => {
    mocks.requireActiveInternalUser.mockRejectedValue(new mocks.MockInternalAuthError('No autorizado.', 401));
    const { POST } = await import('@/app/api/ai/log/route');

    const response = await POST(requestJson({ endpoint: 'chat', latenciaMs: 1 }));

    expect(response.status).toBe(401);
    expect(mocks.logSet).not.toHaveBeenCalled();
  });

  it('rol no autorizado recibe 403', async () => {
    mocks.requireActiveInternalUser.mockResolvedValue(usuario('FUNCIONARIO'));
    const { POST } = await import('@/app/api/ai/log/route');

    const response = await POST(requestJson({ endpoint: 'chat', latenciaMs: 1 }));

    expect(response.status).toBe(403);
    expect(mocks.logSet).not.toHaveBeenCalled();
  });

  it('payload inválido recibe 400', async () => {
    mocks.requireActiveInternalUser.mockResolvedValue(usuario('ADMIN'));
    mocks.checkRateLimit.mockReturnValue(null);
    const { POST } = await import('@/app/api/ai/log/route');

    const response = await POST(requestJson({ endpoint: 'chat', latenciaMs: 1, prompt: 'no permitido' }));

    expect(response.status).toBe(400);
    expect(mocks.logSet).not.toHaveBeenCalled();
  });

  it('rate limit bloquea abuso', async () => {
    mocks.requireActiveInternalUser.mockResolvedValue(usuario('ADMIN'));
    mocks.checkRateLimit.mockReturnValue({ retryAfterSeconds: 60 });
    const { POST } = await import('@/app/api/ai/log/route');

    const response = await POST(requestJson({ endpoint: 'chat', latenciaMs: 1 }));

    expect(response.status).toBe(429);
    expect(mocks.logSet).not.toHaveBeenCalled();
  });

  it('guarda solo campos sanitizados', async () => {
    mocks.requireActiveInternalUser.mockResolvedValue(usuario('CONTROL_INTERNO'));
    mocks.checkRateLimit.mockReturnValue(null);
    const { POST } = await import('@/app/api/ai/log/route');

    const response = await POST(requestJson({
      endpoint: 'chat',
      latenciaMs: 55,
      error: 'stack con correo persona@example.com',
      promptVersion: 'copilot:v2',
    }));

    expect(response.status).toBe(200);
    expect(mocks.logSet).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'chat',
      latenciaMs: 55,
      errorPresente: true,
      errorCategoria: 'ERROR_REGISTRADO',
      actorRol: 'CONTROL_INTERNO',
    }));
    expect(JSON.stringify(mocks.logSet.mock.calls[0][0])).not.toContain('persona@example.com');
  });

  it('error de Firestore no expone stack ni detalles técnicos', async () => {
    mocks.requireActiveInternalUser.mockResolvedValue(usuario('ADMIN'));
    mocks.checkRateLimit.mockReturnValue(null);
    mocks.logSet.mockRejectedValue(new Error('Firestore stack secreto'));
    const { POST } = await import('@/app/api/ai/log/route');

    const response = await POST(requestJson({ endpoint: 'chat', latenciaMs: 1 }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('Firestore');
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});

describe('H-07 cabeceras de seguridad', () => {
  it('next.config define cabeceras mínimas y CSP Report-Only', () => {
    const source = readFileSync('next.config.ts', 'utf8');

    expect(source).toContain('poweredByHeader: false');
    expect(source).toContain('X-Content-Type-Options');
    expect(source).toContain('Referrer-Policy');
    expect(source).toContain('X-Frame-Options');
    expect(source).toContain('Permissions-Policy');
    expect(source).toContain('Strict-Transport-Security');
    expect(source).toContain('Content-Security-Policy-Report-Only');
    expect(source).toContain('generativelanguage.googleapis.com');
    expect(source).toContain('firestore.googleapis.com');
    expect(source).toContain('*.ingest.sentry.io');
  });
});
