import { describe, it, expect, vi, beforeEach } from 'vitest';

/* A1 — ejecución REAL del handler (no solo grep de cableado): mockea
   fronteras (firebase-admin, mailer, logger, evento de negocio) e invoca
   el GET real. Sigue el patrón de mocking de
   __tests__/resumen-diario.test.ts y __tests__/subsanacion-rutas-ejecucion.test.ts. */

const {
  mockCounterGet,
  mockCollectionGet,
  mockEnviarEmail,
  mockLogError,
  mockRegistrarEventoNegocio,
} = vi.hoisted(() => ({
  mockCounterGet:            vi.fn(),
  mockCollectionGet:         vi.fn(),
  mockEnviarEmail:           vi.fn(async (params: { to: string; subject: string; html: string }) => { void params; }),
  mockLogError:              vi.fn(),
  mockRegistrarEventoNegocio: vi.fn(),
}));

/* Roadmap P1.4 — auditoria-consecutivos ahora lee cada serie por lotes con
   cursor (`leerTodosLosIds`: .orderBy(FieldPath.documentId()).limit().get()`,
   con `.startAfter()` entre páginas) en vez de un único `.get()`. El mock de
   `collection()` debe soportar esa cadena; como los fixtures de este archivo
   siempre caben en una sola página (< TAMANO_LOTE_BARRIDA), basta con que
   cada eslabón devuelva el mismo query encadenable y el `.get()` final
   resuelva `mockCollectionGet(name)` — MISMO comportamiento observable que
   antes (un único snapshot por colección), solo con la forma de la cadena. */
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({
    doc: (path: string) => ({ get: () => mockCounterGet(path) }),
    collection: (name: string) => {
      const query = {
        orderBy: () => query,
        limit: () => query,
        startAfter: () => query,
        get: () => mockCollectionGet(name),
      };
      return query;
    },
  }),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldPath: { documentId: () => 'documentId-mock' },
}));

vi.mock('@/lib/email/mailer', () => ({ enviarEmail: mockEnviarEmail }));
vi.mock('@/lib/logger', () => ({ logError: mockLogError }));
vi.mock('@/lib/observabilidad/eventos-negocio', () => ({
  registrarEventoNegocio: mockRegistrarEventoNegocio,
}));

import { GET } from '@/app/api/cron/auditoria-consecutivos/route';

const ENV_ORIGINAL = { ...process.env };

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/auditoria-consecutivos', { headers });
}

function reqConSecreto(secreto = 'secreto-real'): Request {
  return req({ authorization: `Bearer ${secreto}` });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ENV_ORIGINAL };
  delete process.env.CRON_SECRET;
  delete process.env.AUDITORIA_ALERTA_EMAIL;
  process.env.EMAIL_USER = 'notificaciones@simacota.gov.co';

  // Por defecto: contador en 0 y colecciones vacías (sin hallazgos).
  mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 0 }) });
  mockCollectionGet.mockResolvedValue({ docs: [] });
});

describe('cron/auditoria-consecutivos — autorización (patrón de crons existentes)', () => {
  it('503 si CRON_SECRET no está configurado', async () => {
    const res = await GET(reqConSecreto());
    expect(res.status).toBe(503);
    expect(mockCollectionGet).not.toHaveBeenCalled();
  });

  it('401 sin header Authorization (con CRON_SECRET configurado)', async () => {
    process.env.CRON_SECRET = 'secreto-real';
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('401 con token incorrecto', async () => {
    process.env.CRON_SECRET = 'secreto-real';
    const res = await GET(reqConSecreto('otro-token'));
    expect(res.status).toBe(401);
  });

  it('200 con el token correcto', async () => {
    process.env.CRON_SECRET = 'secreto-real';
    const res = await GET(reqConSecreto('secreto-real'));
    expect(res.status).toBe(200);
  });
});

describe('cron/auditoria-consecutivos — sin hallazgos (silencio = todo bien)', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'secreto-real';
  });

  it('responde ok con hallazgos:0 y NO llama enviarEmail', async () => {
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 2 }) });
    mockCollectionGet.mockResolvedValue({
      docs: [
        { id: `1-110-${new Date().getFullYear()}-00000001` },
        { id: `1-110-${new Date().getFullYear()}-00000002` },
      ],
    });

    const res = await GET(reqConSecreto());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.hallazgos).toBe(0);
    expect(mockEnviarEmail).not.toHaveBeenCalled();
  });

  it('registra el evento de negocio de la corrida (operacion auditoria_consecutivos, resultado ok)', async () => {
    const res = await GET(reqConSecreto());
    expect(res.status).toBe(200);
    expect(mockRegistrarEventoNegocio).toHaveBeenCalledWith(
      expect.objectContaining({
        operacion: 'auditoria_consecutivos',
        resultado:  'ok',
        actorRol:   'CRON',
      }),
    );
  });
});

describe('cron/auditoria-consecutivos — con hallazgos', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'secreto-real';
  });

  it('detecta un hueco (contador en 3, falta el 2) y SÍ llama enviarEmail', async () => {
    const anio = new Date().getFullYear();
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 3 }) });
    mockCollectionGet.mockResolvedValue({
      docs: [
        { id: `1-110-${anio}-00000001` },
        { id: `1-110-${anio}-00000003` }, // falta el consecutivo 2
      ],
    });

    const res = await GET(reqConSecreto());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hallazgos).toBeGreaterThan(0);
    expect(data.correoEnviado).toBe(true);
    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);

    const llamada = mockEnviarEmail.mock.calls[0]![0] as { to: string; subject: string; html: string };
    expect(llamada.to).toBe('notificaciones@simacota.gov.co');
    expect(llamada.subject).toContain('[AUDITORÍA]');
    expect(llamada.subject).toContain(String(anio));
    expect(llamada.html).toContain('radicados');
  });

  it('usa AUDITORIA_ALERTA_EMAIL cuando está configurado, en vez de EMAIL_USER', async () => {
    process.env.AUDITORIA_ALERTA_EMAIL = 'gestion-documental@simacota.gov.co';
    const anio = new Date().getFullYear();
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 2 }) });
    mockCollectionGet.mockResolvedValue({ docs: [{ id: `1-110-${anio}-00000002` }] }); // falta el 1

    await GET(reqConSecreto());

    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);
    const llamada = mockEnviarEmail.mock.calls[0]![0] as { to: string };
    expect(llamada.to).toBe('gestion-documental@simacota.gov.co');
  });

  it('detecta un duplicado (mismo consecutivo en 2 documentos) como hallazgo', async () => {
    const anio = new Date().getFullYear();
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 2 }) });
    mockCollectionGet.mockResolvedValue({
      docs: [
        { id: `1-110-${anio}-00000001` },
        { id: `1-110-${anio}-00000001` }, // duplicado del 1
        { id: `1-110-${anio}-00000002` },
      ],
    });

    const res = await GET(reqConSecreto());
    const data = await res.json();

    expect(data.hallazgos).toBeGreaterThan(0);
    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);
  });

  it('sin destinatario configurado (ni AUDITORIA_ALERTA_EMAIL ni EMAIL_USER): no envía correo y registra el error', async () => {
    delete process.env.EMAIL_USER;
    const anio = new Date().getFullYear();
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 2 }) });
    mockCollectionGet.mockResolvedValue({ docs: [{ id: `1-110-${anio}-00000001` }] }); // falta el 2

    const res = await GET(reqConSecreto());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.correoEnviado).toBe(false);
    expect(mockEnviarEmail).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('si enviarEmail falla, la ruta no se cae: responde 200 con correoEnviado:false y registra el error', async () => {
    mockEnviarEmail.mockRejectedValueOnce(new Error('SMTP caído'));
    const anio = new Date().getFullYear();
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 2 }) });
    mockCollectionGet.mockResolvedValue({ docs: [{ id: `1-110-${anio}-00000001` }] });

    const res = await GET(reqConSecreto());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.correoEnviado).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });
});

describe('cron/auditoria-consecutivos — errores fatales', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'secreto-real';
  });

  it('si Firestore falla, responde 500 y registra el error (nunca deja pasar la excepción)', async () => {
    mockCounterGet.mockRejectedValueOnce(new Error('Firestore no disponible'));

    const res = await GET(reqConSecreto());
    expect(res.status).toBe(500);
    expect(mockLogError).toHaveBeenCalled();
  });
});
