/**
 * @vitest-environment node
 *
 * `@vitest-environment node`: el entorno global del proyecto es `jsdom`
 * (vitest.config.mts), cuyo `File` es de un realm distinto al `File` que
 * espera el `formData()` de `Request` en Node — mismo ajuste que
 * `radicacion-interna-magic-bytes.test.ts` (este golden sube adjuntos PDF
 * reales para cubrir el borde de N adjuntos).
 *
 * FASE 2 (docs/CRONOGRAMA_PIEZA_ANGULAR.md) — golden del endpoint NUEVO
 * `app/api/radicacion/interna`.
 *
 * Fija la forma EXACTA en disco del `VentanillaRadicado` que produce el
 * endpoint servidor, con la política de sanitización **null explícito**
 * (`sanitizeFirestoreData`, decisión del propietario para esta ruta NUEVA
 * — a diferencia de la pública, que usa `removeUndefinedDeep`). Cubre los
 * bordes que exige el blueprint (§Pruebas, tabla "Golden/paridad"):
 * anónimo, identidad reservada, 0/1/N adjuntos, sin correo, solicitante
 * sin datos aportados.
 *
 * También LOCKEA una asimetría deliberada frente a la superficie pública:
 * la ruta interna NUNCA fija `cumplioTermino`/`consultaTokenHash`/
 * `analisisIa`/`solicitante.razonSocial` — esas claves deben estar
 * AUSENTES (no `null`), porque el constructor puro las agrega con spread
 * condicional y esta ruta no las pasa (ver cabecera de
 * `lib/recepcion/construir-radicado.ts`).
 *
 * Determinismo: `vi.useFakeTimers` + `vi.setSystemTime` (reloj fijo,
 * América/Bogotá vía `timeZone` explícita en `horaRadicado` — no depende
 * de `process.env.TZ`). Adjuntos con firma binaria real (magic-bytes)
 * para no chocar con H-08.
 *
 * Maneja el handler POST real; solo mockea la frontera Admin SDK.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcularFechaVencimiento, TIPOS_SOLICITUD } from '@/lib/tiempos-radicado';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import { sugerirSerieDocumental } from '@/lib/catalogos/series-documentales';
import { construirClasificacionInicial } from '@/lib/recepcion/clasificacion-inicial';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

// El endpoint exige FIREBASE_STORAGE_BUCKET configurado (bucketStorage())
// antes de tocar el mock de Storage — a diferencia de los tests de
// magic-bytes/staging-falla (que solo verifican rutas de ERROR, donde la
// ausencia de la variable produce igualmente un 500/400 esperado), este
// golden necesita el camino FELIZ (200) con adjuntos reales.
process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket.appspot.com';

const AHORA = new Date('2026-03-10T14:15:00.000Z');
const YEAR = AHORA.getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

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
    requireActiveInternalUser: vi.fn(async () => ({
      uid: 'func-recepcion-01', nombre: 'Laura Recepción', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA', activo: true,
    })),
  };
});

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

let contador: number;
let radicadoPersistido: { path: string; data: Record<string, unknown> } | null;
const rutasSubidas: string[] = [];
const rutasMovidas: { origen: string; destino: string }[] = [];

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { path: string; data: Record<string, unknown> }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => (ref.path === COUNTER ? { ultimo: contador } : undefined),
      }),
      create: (ref: { path: string }, data: Record<string, unknown>) => buffer.push({ path: ref.path, data }),
      set: (ref: { path: string }, data: Record<string, unknown>) => buffer.push({ path: ref.path, data }),
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.path === COUNTER) {
        contador = (w.data as { ultimo: number }).ultimo;
      } else if (w.path.startsWith('ventanilla_radicados/') && !w.path.includes('/trazabilidad/')) {
        radicadoPersistido = { path: w.path, data: w.data };
      }
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        save: async () => { rutasSubidas.push(path); },
        move: async (destino: string) => { rutasMovidas.push({ origen: path, destino }); },
      }),
    }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

function archivoPdf(nombre: string): File {
  return new File([PDF_BYTES], nombre, { type: 'application/pdf' });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
  contador = 40;
  radicadoPersistido = null;
  rutasSubidas.length = 0;
  rutasMovidas.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

const FECHA_VENCIMIENTO = calcularFechaVencimiento(AHORA, 'PETICION_GENERAL').fechaVencimiento;
const TIPO = TIPOS_SOLICITUD.PETICION_GENERAL;
const SERIE = sugerirSerieDocumental('PETICION_GENERAL', 'VENTANILLA_UNICA');
const CLASIF_BASE = construirClasificacionInicial('VENTANILLA_UNICA', 'func-recepcion-01');
const HORA_RADICADO_ESPERADA = AHORA.toLocaleTimeString('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

/** Claves que la ruta interna NUNCA debe fijar (exclusivas de la
 *  superficie pública o derivadas que el body no puede forjar). */
function assertClavesAusentes(radicado: Record<string, unknown>) {
  for (const clave of ['cumplioTermino', 'consultaTokenHash', 'analisisIa']) {
    expect(Object.prototype.hasOwnProperty.call(radicado, clave)).toBe(false);
  }
  const solicitante = radicado.solicitante as Record<string, unknown>;
  expect(Object.prototype.hasOwnProperty.call(solicitante, 'razonSocial')).toBe(false);
}

describe('FASE 2 — golden del endpoint nuevo: api/radicacion/interna', () => {
  it('caso base: IDENTIFICADA, con correo, N=2 adjuntos, todos los datos', async () => {
    const f = new FormData();
    f.append('tipoSolicitudId', 'PETICION_GENERAL');
    f.append('tipoPresentacion', 'IDENTIFICADA');
    f.append('tipoPersona', 'NATURAL');
    f.append('tipoDocumento', 'CC');
    f.append('medioRecepcion', 'PRESENCIAL');
    f.append('origenIngreso', 'VENTANILLA_FISICA');
    f.append('tipoEntrada', 'SOLICITUD_CIUDADANA');
    f.append('nombreCompleto', 'Ana María Torres');
    f.append('numeroDocumento', '1098765432');
    f.append('email', 'ana.torres@example.com');
    f.append('telefono', '3009876543');
    f.append('telefonoMovil', '3009876543');
    f.append('telefonoFijo', '6076541234');
    f.append('direccion', 'Carrera 5 # 10-20');
    f.append('barrio', 'Centro');
    f.append('asunto', 'Solicitud de certificado de residencia');
    f.append('descripcion', 'El ciudadano solicita certificado de residencia para trámite bancario.');
    f.append('numeroFolios', '2');
    f.append('numeroAnexos', '2');
    f.append('anexosDescripcion', '2 copias adjuntas');
    f.append('observacionesAnexos', 'Copias legibles');
    f.append('canalRespuesta', 'CORREO');
    f.append('archivos', archivoPdf('cedula.pdf'));
    f.append('archivos', archivoPdf('recibo.pdf'));

    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.consecutivo).toBe(41);

    const radicadoId = formatearRadicadoInstitucional(41, AHORA);
    expect(radicadoPersistido?.path).toBe(`ventanilla_radicados/${radicadoId}`);
    const radicado = radicadoPersistido!.data as unknown as VentanillaRadicado;

    expect(radicado).toEqual({
      radicadoId,
      estadoActual: 'PENDIENTE',
      ultimaActualizacion: AHORA.toISOString(),
      prioridad: TIPO.prioridadSugerida,
      esAnonimo: false,
      tipoPresentacion: 'IDENTIFICADA',
      identidadReservada: false,
      canalRespuesta: 'CORREO',
      solicitante: {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'CC',
        numeroDocumento: '1098765432',
        nombreCompleto: 'Ana María Torres',
        email: 'ana.torres@example.com',
        telefono: '3009876543',
        telefonoMovil: '3009876543',
        telefonoFijo: '6076541234',
        direccion: 'Carrera 5 # 10-20',
        ubicacion: {
          pais: 'Colombia',
          departamento: 'Santander',
          municipio: 'Simacota',
          barrio: 'Centro',
        },
        datosNoAportados: null,
      },
      control: {
        radicadoId,
        consecutivo: 41,
        fechaRadicado: AHORA.toISOString(),
        horaRadicado: HORA_RADICADO_ESPERADA,
        medioRecepcion: 'PRESENCIAL',
        origen: 'FISICO_ESCANER',
        origenIngreso: 'VENTANILLA_FISICA',
        tipoEntrada: 'SOLICITUD_CIUDADANA',
      },
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: TIPO.nombre,
        diasRespuesta: TIPO.diasRespuesta,
        unidad: TIPO.unidad,
        fechaVencimiento: FECHA_VENCIMIENTO,
        prorrogasAplicadas: 0,
      },
      clasificacion: {
        ...CLASIF_BASE,
        ...(SERIE ? { serieDocumental: SERIE } : {}),
      },
      detalle: {
        asunto: 'Solicitud de certificado de residencia',
        descripcion: 'El ciudadano solicita certificado de residencia para trámite bancario.',
        numeroFolios: 2,
        anexosDescripcion: '2 copias adjuntas',
        numeroAnexos: 2,
        observacionesAnexos: 'Copias legibles',
      },
      archivos: [
        { nombre: 'cedula.pdf', url: '', path: expect.stringMatching(new RegExp(`^radicados/${radicadoId}/.*cedula\\.pdf$`)), tipo: 'application/pdf', tamanioKB: expect.any(Number), orden: 1 },
        { nombre: 'recibo.pdf', url: '', path: expect.stringMatching(new RegExp(`^radicados/${radicadoId}/.*recibo\\.pdf$`)), tipo: 'application/pdf', tamanioKB: expect.any(Number), orden: 2 },
      ],
    });
    assertClavesAusentes(radicado as unknown as Record<string, unknown>);
    expect(rutasSubidas).toHaveLength(2);
    expect(rutasMovidas).toHaveLength(2);
  });

  it('borde: ANÓNIMA, 0 adjuntos, solicitante sin ningún dato aportado', async () => {
    const f = new FormData();
    f.append('tipoSolicitudId', 'PETICION_GENERAL');
    f.append('tipoPresentacion', 'ANONIMA');
    f.append('tipoPersona', 'NO_IDENTIFICADO');
    f.append('tipoDocumento', 'OTRO');
    f.append('medioRecepcion', 'PRESENCIAL');
    f.append('asunto', 'Queja anónima');
    f.append('descripcion', 'El ciudadano anónimo radica una queja sin dejar datos de contacto.');
    f.append('noAportaDocumento', 'true');
    f.append('noAportaCorreo', 'true');
    f.append('noAportaTelefono', 'true');
    f.append('noAportaDireccion', 'true');

    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const radicadoId = formatearRadicadoInstitucional(41, AHORA);
    const radicado = radicadoPersistido!.data as unknown as VentanillaRadicado;

    expect(radicado.esAnonimo).toBe(true);
    expect(radicado.identidadReservada).toBe(false);
    expect(radicado.tipoPresentacion).toBe('ANONIMA');
    expect(radicado.canalRespuesta).toBeNull();
    expect(radicado.archivos).toEqual([]);
    expect(radicado.solicitante).toEqual({
      tipoPersona: 'NO_IDENTIFICADO',
      tipoDocumento: 'OTRO',
      numeroDocumento: '',
      nombreCompleto: 'Ciudadano anonimo',
      email: null,
      telefono: null,
      telefonoMovil: null,
      telefonoFijo: null,
      direccion: null,
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota', barrio: null },
      datosNoAportados: { documento: true, correo: true, telefono: true, direccion: true },
    });
    expect(radicadoPersistido?.path).toBe(`ventanilla_radicados/${radicadoId}`);
    assertClavesAusentes(radicado as unknown as Record<string, unknown>);
    expect(rutasSubidas).toHaveLength(0);
  });

  it('borde: RESERVADA, 1 adjunto, sin correo (canal PRESENCIAL)', async () => {
    const f = new FormData();
    f.append('tipoSolicitudId', 'PETICION_GENERAL');
    f.append('tipoPresentacion', 'RESERVADA');
    f.append('tipoPersona', 'NATURAL');
    f.append('tipoDocumento', 'CC');
    f.append('medioRecepcion', 'PRESENCIAL');
    f.append('nombreCompleto', 'Reservado Confidencial');
    f.append('numeroDocumento', '1000111222');
    f.append('asunto', 'Solicitud con identidad reservada');
    f.append('descripcion', 'El solicitante pide reserva de identidad (Ley 1755/2015 art. 14).');
    f.append('canalRespuesta', 'PRESENCIAL');
    f.append('noAportaCorreo', 'true');
    f.append('archivos', archivoPdf('soporte.pdf'));

    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const radicado = radicadoPersistido!.data as unknown as VentanillaRadicado;
    expect(radicado.esAnonimo).toBe(false);
    expect(radicado.identidadReservada).toBe(true);
    expect(radicado.tipoPresentacion).toBe('RESERVADA');
    expect(radicado.solicitante.email).toBeNull();
    expect(radicado.solicitante.datosNoAportados).toEqual({
      documento: false, correo: true, telefono: false, direccion: false,
    });
    expect(radicado.archivos).toHaveLength(1);
    assertClavesAusentes(radicado as unknown as Record<string, unknown>);
    expect(rutasSubidas).toHaveLength(1);
    expect(rutasMovidas).toHaveLength(1);
  });
});
