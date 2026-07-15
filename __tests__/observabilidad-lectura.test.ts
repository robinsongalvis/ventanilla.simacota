/* ══════════════════════════════════════════════════════════════
   Señal de observabilidad de LECTURA (ADR-0011, incremento 2B)

   Control de regresión de `busqueda-avanzada/route.ts`: la consulta debe
   emitir un evento de negocio con `docsLeidos` (nº de documentos que
   Firestore devolvió) y `latenciaMs`, y ese evento — igual que las 4
   escrituras (ADR-0005) — NUNCA debe transportar PII del solicitante
   (nombre, documento, correo, teléfono, dirección).
══════════════════════════════════════════════════════════════ */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as buscarAvanzada } from '@/app/api/radicados/busqueda-avanzada/route';
import { requireActiveInternalUser } from '@/lib/server/internal-auth';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

/*
 * Mock de la cadena Firestore Admin usada por el escaneo acotado por cursor
 * (ADR-0010 §2.1): collection().orderBy([.where()]).limit([.startAfter()]).get().
 * Cada nivel expone los métodos que el route puede encadenar a continuación.
 */
const mockGet = vi.fn();
const mockStartAfter = vi.fn(() => ({ get: mockGet }));
const mockLimit = vi.fn(() => ({ get: mockGet, startAfter: mockStartAfter }));
const mockWhere = vi.fn(() => ({ limit: mockLimit, get: mockGet }));
const mockOrderBy = vi.fn(() => ({ where: mockWhere, limit: mockLimit, get: mockGet }));
const mockCollection = vi.fn(() => ({ orderBy: mockOrderBy }));

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => ({ collection: mockCollection }),
}));

vi.mock('@/lib/server/internal-auth', () => ({
  requireActiveInternalUser: vi.fn(),
  InternalAuthError: class extends Error {
    constructor(message: string, public status: number = 401) {
      super(message);
    }
  },
}));

/** Datos de ciudadano REALES para probar que jamás llegan al log de observabilidad. */
const PII = {
  nombreCompleto: 'María Fernanda Restrepo Gómez',
  numeroDocumento: '1099888777',
  email: 'maria.restrepo.pii@example.com',
  telefono: '3011234567',
  direccion: 'Calle 10 # 5-23, barrio El Centro',
};

function radicadoConPii(id: string): VentanillaRadicado & { isTest?: boolean } {
  return {
    radicadoId: id,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: new Date().toISOString(),
    prioridad: 'AMARILLO',
    cumplioTermino: null,
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: PII.numeroDocumento,
      nombreCompleto: PII.nombreCompleto,
      email: PII.email,
      telefono: PII.telefono,
      direccion: PII.direccion,
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: id,
      consecutivo: 1,
      fechaRadicado: new Date().toISOString(),
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: new Date().toISOString(),
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: { asunto: 'Asunto', descripcion: 'Descripción', numeroFolios: 0 },
    archivos: [],
    alertaNotificacionFallida: false,
    respuestaOficial: null,
  } as unknown as VentanillaRadicado;
}

function req(body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/radicados/busqueda-avanzada', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Extrae el(los) evento(s) `[ventanilla:evento-negocio]` logueados. */
function eventosEmitidos(logSpy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> {
  return (logSpy.mock.calls as unknown as Array<[string, string]>)
    .filter((call) => call[0] === '[ventanilla:evento-negocio]')
    .map((call) => JSON.parse(call[1]) as Record<string, unknown>);
}

describe('Señal de lectura — busqueda-avanzada/route.ts (ADR-0011, 2B)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGet.mockReset();
    mockStartAfter.mockClear().mockReturnValue({ get: mockGet });
    mockLimit.mockClear().mockReturnValue({ get: mockGet, startAfter: mockStartAfter });
    mockWhere.mockReset().mockReturnValue({ limit: mockLimit, get: mockGet });
    mockOrderBy.mockClear();
    mockCollection.mockClear();
    vi.mocked(requireActiveInternalUser).mockReset().mockResolvedValue({
      uid: 'uid-admin', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA',
    } as Awaited<ReturnType<typeof requireActiveInternalUser>>);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emite un evento de lectura con operacion, docsLeidos y latenciaMs en éxito', async () => {
    const docs = [radicadoConPii('1-110-2026-00000001'), radicadoConPii('1-110-2026-00000002')];
    mockGet.mockResolvedValue({
      size: docs.length,
      docs: docs.map((d) => ({ data: () => d })),
    });

    const res = await buscarAvanzada(req());
    expect(res.status).toBe(200);

    const eventos = eventosEmitidos(logSpy);
    expect(eventos.length).toBe(1);
    const evento = eventos[0];
    expect(evento.operacion).toBe('busqueda_radicados');
    expect(evento.resultado).toBe('ok');
    expect(evento.docsLeidos).toBe(2);
    expect(typeof evento.latenciaMs).toBe('number');
    expect(evento.latenciaMs as number).toBeGreaterThanOrEqual(0);
    expect(evento.radicadoId).toBeNull();
    expect(evento.actorRol).toBe('ADMIN');
    expect(evento.tenant).toBe('VENTANILLA_UNICA');
  });

  it('docsLeidos refleja snap.size (todos los documentos leídos de Firestore), no el total tras filtros/paginación', async () => {
    // 5 documentos leídos por Firestore; la búsqueda no aplica ningún filtro
    // adicional que los excluya, pero el punto es que docsLeidos = snap.size
    // SIEMPRE, incluso si alguno fuera excluido después (isTest, paginación).
    const docs = Array.from({ length: 5 }, (_, i) => radicadoConPii(`1-110-2026-0000000${i + 1}`));
    mockGet.mockResolvedValue({
      size: docs.length,
      docs: docs.map((d) => ({ data: () => d })),
    });

    await buscarAvanzada(req({ pageSize: 25, page: 1 }));

    const evento = eventosEmitidos(logSpy)[0];
    expect(evento.docsLeidos).toBe(5);
  });

  it('el evento de lectura NUNCA transporta PII del ciudadano (nombre, documento, correo, teléfono, dirección)', async () => {
    const docs = [radicadoConPii('1-110-2026-00000009')];
    mockGet.mockResolvedValue({
      size: docs.length,
      docs: docs.map((d) => ({ data: () => d })),
    });

    await buscarAvanzada(req());

    const eventoCrudo = (logSpy.mock.calls as unknown as Array<[string, string]>)
      .find((c) => c[0] === '[ventanilla:evento-negocio]')![1];
    expect(eventoCrudo).not.toContain(PII.nombreCompleto);
    expect(eventoCrudo).not.toContain(PII.numeroDocumento);
    expect(eventoCrudo).not.toContain(PII.email);
    expect(eventoCrudo).not.toContain(PII.telefono);
    expect(eventoCrudo).not.toContain(PII.direccion);

    const evento = JSON.parse(eventoCrudo) as Record<string, unknown>;
    const clavesProhibidas = [
      'nombre', 'nombreCompleto', 'email', 'correo', 'telefono',
      'documento', 'numeroDocumento', 'direccion', 'solicitante', 'items',
    ];
    for (const prohibida of clavesProhibidas) {
      expect(Object.keys(evento)).not.toContain(prohibida);
    }
  });

  it('en fallo de Firestore emite resultado error con latenciaMs, sin docsLeidos y sin PII en el mensaje', async () => {
    mockGet.mockRejectedValue(new Error(
      `Timeout consultando a ${PII.email} / ${PII.telefono} / documento CC ${PII.numeroDocumento}`,
    ));

    const res = await buscarAvanzada(req());
    expect(res.status).toBe(500);

    const evento = eventosEmitidos(logSpy)[0];
    expect(evento.operacion).toBe('busqueda_radicados');
    expect(evento.resultado).toBe('error');
    expect(typeof evento.latenciaMs).toBe('number');
    expect(evento.docsLeidos).toBeUndefined();
    expect(evento.mensaje).toBeDefined();
    expect(evento.mensaje as string).not.toContain(PII.email);
    expect(evento.mensaje as string).not.toContain(PII.telefono);
    expect(evento.mensaje as string).not.toContain(PII.numeroDocumento);
  });

  it('FUNCIONARIO (consulta filtrada por tenant) también emite la señal de lectura', async () => {
    vi.mocked(requireActiveInternalUser).mockResolvedValue({
      uid: 'uid-func', rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA',
    } as Awaited<ReturnType<typeof requireActiveInternalUser>>);
    const docs = [radicadoConPii('1-110-2026-00000020')];
    mockGet.mockResolvedValue({
      size: docs.length,
      docs: docs.map((d) => ({ data: () => d })),
    });

    await buscarAvanzada(req());

    expect(mockWhere).toHaveBeenCalledWith('clasificacion.oficinaDestino', '==', 'SEC_HACIENDA');
    const evento = eventosEmitidos(logSpy)[0];
    expect(evento.docsLeidos).toBe(1);
    expect(evento.tenant).toBe('SEC_HACIENDA');
  });
});
