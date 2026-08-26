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

import { GET, auditarCounterExpedientes } from '@/app/api/cron/auditoria-consecutivos/route';

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

describe('auditarCounterExpedientes — lógica pura (PASO 6, Fase 2 arranque)', () => {
  it('counter inexistente (data undefined) → SIN_ABRIR', () => {
    expect(auditarCounterExpedientes(undefined)).toEqual({ estado: 'SIN_ABRIR' });
  });

  it('counter con ultimo entero >= 0 → PARCIAL, con el valor y el motivo', () => {
    expect(auditarCounterExpedientes({ ultimo: 19 })).toEqual({
      estado: 'PARCIAL', ultimo: 19, motivo: 'auditoría de continuidad pendiente de colección (Fase 1)',
    });
  });

  it('ultimo=0 (contador recién creado, aún válido) → PARCIAL', () => {
    expect(auditarCounterExpedientes({ ultimo: 0 })).toMatchObject({ estado: 'PARCIAL', ultimo: 0 });
  });

  it('ultimo no entero (3.5) → CORRUPTO', () => {
    expect(auditarCounterExpedientes({ ultimo: 3.5 }).estado).toBe('CORRUPTO');
  });

  it('ultimo negativo → CORRUPTO', () => {
    expect(auditarCounterExpedientes({ ultimo: -2 }).estado).toBe('CORRUPTO');
  });

  it('ultimo ausente en un documento existente (data={}) → CORRUPTO (NaN no es entero)', () => {
    expect(auditarCounterExpedientes({}).estado).toBe('CORRUPTO');
  });
});

describe('cron/auditoria-consecutivos — rama "expedientes" (PASO 6) SIEMPRE en el reporte', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'secreto-real';
  });

  function mockCounterPorPath(porPath: Record<string, { ultimo?: unknown } | undefined>) {
    mockCounterGet.mockImplementation((path: string) => {
      const anio = new Date().getFullYear();
      if (path === `counters/expedientes-${anio}`) {
        const data = porPath.expedientes;
        return Promise.resolve({ data: () => data });
      }
      return Promise.resolve({ data: () => ({ ultimo: 0 }) });
    });
  }

  it('sin hallazgos en las 3 series legadas: "expedientes" (SIN_ABRIR) igual aparece en el reporte', async () => {
    mockCounterPorPath({ expedientes: undefined });
    const res = await GET(reqConSecreto());
    const data = await res.json();
    expect(data.series.expedientes).toEqual({ estado: 'SIN_ABRIR' });
    expect(mockEnviarEmail).not.toHaveBeenCalled(); // SIN_ABRIR no es hallazgo
  });

  it('counter de expedientes sembrado (PARCIAL) aparece en el reporte y NO dispara correo por sí solo', async () => {
    mockCounterPorPath({ expedientes: { ultimo: 19 } });
    const res = await GET(reqConSecreto());
    const data = await res.json();
    expect(data.series.expedientes).toMatchObject({ estado: 'PARCIAL', ultimo: 19 });
    expect(data.hallazgos).toBe(0);
    expect(mockEnviarEmail).not.toHaveBeenCalled();
  });

  it('counter de expedientes CORRUPTO: aparece en el reporte, cuenta como hallazgo, dispara correo y se loguea', async () => {
    mockCounterPorPath({ expedientes: { ultimo: -5 } });
    const res = await GET(reqConSecreto());
    const data = await res.json();
    expect(data.series.expedientes.estado).toBe('CORRUPTO');
    expect(data.hallazgos).toBeGreaterThan(0);
    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'cron/auditoria-consecutivos/expedientes' }),
    );
  });

  it('el correo por CORRUPTO en expedientes no incluye una fila "expedientes" en el HTML (plantilla no extendida, ver JSDoc)', async () => {
    mockCounterPorPath({ expedientes: { ultimo: -5 } });
    await GET(reqConSecreto());
    const llamada = mockEnviarEmail.mock.calls[0]![0] as { html: string };
    expect(llamada.html).not.toContain('expedientes');
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

describe('cron/auditoria-consecutivos — vigilancia de coherencia con la apertura', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'secreto-real';
  });

  /* El caso que motiva la vigilancia: el contador declara haberse abierto en
     1600 y está en 27. No hay huecos ni duplicados que ver —los documentos de
     la serie ni siquiera existen todavía— así que las dos capas anteriores
     callan y solo esta lo nota. */
  it('detecta un contador movido hacia atrás por fuera y lo reporta como hallazgo', async () => {
    mockCounterGet.mockImplementation(async (path: string) =>
      path.startsWith('counters/radicados-')
        ? {
            data: () => ({
              ultimo: 27,
              apertura: {
                abiertoEn: 1600,
                autorizadoPor: 'Secretaría General',
                fecha: '2026-09-01T13:00:00.000Z',
              },
            }),
          }
        : { data: () => ({ ultimo: 0 }) },
    );

    const res = await GET(reqConSecreto());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.contadoresIncoherentes).toHaveLength(1);
    expect(data.contadoresIncoherentes[0]).toMatch(/radicados/);
    expect(data.contadoresIncoherentes[0]).toMatch(/1600/);
    expect(data.contadoresIncoherentes[0]).toMatch(/27/);
    // Cuenta como hallazgo: si no contara, el cron guardaría silencio.
    expect(data.hallazgos).toBeGreaterThanOrEqual(1);
    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);
    // Y queda en el registro de errores aunque el correo falle.
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'cron/auditoria-consecutivos/coherencia-apertura' }),
    );
  });

  it('el correo nombra la incoherencia en su cuerpo', async () => {
    mockCounterGet.mockImplementation(async (path: string) =>
      path.startsWith('counters/salidas-')
        ? { data: () => ({ ultimo: 3, apertura: { abiertoEn: 900, autorizadoPor: 'Planeación' } }) }
        : { data: () => ({ ultimo: 0 }) },
    );

    await GET(reqConSecreto());

    const html = mockEnviarEmail.mock.calls[0][0].html;
    expect(html).toMatch(/contador\(es\) incoherente\(s\)/i);
    expect(html).toMatch(/900/);
  });

  /* Sin registro de apertura no hay historia contra la cual contradecirse:
     una serie que nunca se abrió no debe generar ruido semanal. */
  it('un contador SIN registro de apertura no produce hallazgo', async () => {
    mockCounterGet.mockResolvedValue({ data: () => ({ ultimo: 5 }) });
    mockCollectionGet.mockResolvedValue({
      docs: Array.from({ length: 5 }, (_, i) => ({
        id: `1-110-${new Date().getFullYear()}-${String(i + 1).padStart(8, '0')}`,
      })),
    });

    const res = await GET(reqConSecreto());
    const data = await res.json();
    expect(data.contadoresIncoherentes).toEqual([]);
  });
});
