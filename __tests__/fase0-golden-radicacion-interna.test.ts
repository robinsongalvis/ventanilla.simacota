/**
 * FASE 0 (docs/CRONOGRAMA_PIEZA_ANGULAR.md) — LÍNEA BASE DE PARIDAD.
 * Superficie INTERNA: `lib/actions/radicarVentanilla.ts` (`radicarInstitucionalmente`).
 *
 * Congela la forma EXACTA en disco del documento `VentanillaRadicado` que
 * produce HOY esta acción. Es la red de seguridad de la Fase 1 (constructor
 * compartido): estos golden tests deben seguir pasando SIN EDITARLOS y sin
 * diff. Si Fase 1 cambia el shape aquí capturado, es una regresión de
 * comportamiento — no un test desactualizado que haya que "arreglar".
 *
 * NO se unifica nada aquí (eso es Fase 1): esta suite documenta la forma
 * real de la superficie interna tal cual es HOY, incluidas sus asimetrías
 * frente a la pública (`app/api/radicacion/route.ts`) que ya señaló la
 * revisión de datos — por ejemplo: aquí `termino.fechaVencimiento` y
 * `detalle.asunto/numeroFolios` los calcula el LLAMADOR (no la acción), y
 * `control.horaRadicado` NO lleva segundos ni `hour12` explícito.
 *
 * Determinismo:
 *  - Fecha del sistema congelada con `vi.useFakeTimers` + `vi.setSystemTime`
 *    (nunca `new Date()` libre en las aserciones: se reusa la constante
 *    `AHORA`).
 *  - Zona horaria fijada con `process.env.TZ` (afecta `toLocaleTimeString`).
 *  - Contador (`counters/radicados-{año}`) reiniciado en cada test
 *    (`beforeEach`).
 *  - Sin archivos adjuntos (`archivos: []`): evita `subirArchivos`/Storage
 *    no determinista y mantiene el caso enfocado en el shape del
 *    documento. `@/lib/storage` se mockea para lanzar si por error se
 *    invoca — defensa explícita de ese supuesto.
 *  - El resto de la lógica de negocio (clasificación inicial, serie
 *    documental, catálogo de tipos de solicitud, formateo del id) corre
 *    REAL, sin mockear — solo se mockea la frontera del SDK cliente de
 *    Firebase (`firebase/firestore`, `@/lib/firebase`), igual que
 *    `h3-consecutivo-fantasma.repro.test.ts`.
 */
process.env.TZ = 'America/Bogota';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcularFechaVencimiento, TIPOS_SOLICITUD } from '@/lib/tiempos-radicado';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import { sugerirSerieDocumental } from '@/lib/catalogos/series-documentales';
import { construirClasificacionInicial } from '@/lib/recepcion/clasificacion-inicial';
import type { DatosNoAportados, VentanillaRadicado } from '@/src/types/ventanilla';

const AHORA = new Date('2026-03-10T09:15:00.000Z');
const YEAR = AHORA.getFullYear();
const COUNTER_PATH = `counters/radicados-${YEAR}`;

interface RefFake {
  path: string;
}

/**
 * `SolicitanteRadicado.datosNoAportados` está tipado como
 * `DatosNoAportados | undefined` — pero `sanitizeFirestoreData` (la propia
 * acción bajo prueba) convierte el `undefined` explícito en `null` antes de
 * escribir a Firestore. Es una divergencia real tipo↔runtime de HOY, no un
 * error de este test: se documenta con este alias local en vez de forzar
 * un `as unknown as VentanillaRadicado` que apagaría el chequeo estricto
 * del resto del fixture.
 */
type RadicadoInternoEsperado = Omit<VentanillaRadicado, 'solicitante'> & {
  solicitante: Omit<VentanillaRadicado['solicitante'], 'datosNoAportados'> & {
    datosNoAportados: DatosNoAportados | null;
  };
};

let contador: { ultimo: number };
let radicadoPersistido: { path: string; data: VentanillaRadicado } | null;

function refFor(segs: string[]): RefFake {
  return { path: segs.join('/') };
}

vi.mock('@/lib/firebase', () => ({ getDb: () => ({}) }));

vi.mock('@/lib/storage', () => ({
  subirArchivos: vi.fn(async () => {
    throw new Error('golden Fase 0: no debería subir archivos (archivos: [])');
  }),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segs: string[]) => refFor(segs),
  collection: (_db: unknown, ...segs: string[]) => refFor(segs),
  getDoc: async (ref: RefFake) => ({
    data: () => (ref.path === COUNTER_PATH ? { ultimo: contador.ultimo } : undefined),
  }),
  addDoc: async () => ({ id: 'trz' }),
  runTransaction: async (_db: unknown, cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { ref: RefFake; data: unknown }[] = [];
    const tx = {
      get: async (ref: RefFake) => ({
        data: () => (ref.path === COUNTER_PATH ? { ultimo: contador.ultimo } : undefined),
      }),
      set: (ref: RefFake, data: unknown) => {
        buffer.push({ ref, data });
      },
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.ref.path === COUNTER_PATH) {
        contador.ultimo = (w.data as { ultimo: number }).ultimo;
      } else {
        radicadoPersistido = { path: w.ref.path, data: w.data as VentanillaRadicado };
      }
    }
    return result;
  },
}));

import {
  radicarInstitucionalmente,
  type DatosRadicacionInstitucional,
  type ActorRadicacion,
} from '@/lib/actions/radicarVentanilla';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
  contador = { ultimo: 40 };
  radicadoPersistido = null;
});

afterEach(() => {
  vi.useRealTimers();
});

const FECHA_VENCIMIENTO = calcularFechaVencimiento(AHORA, 'PETICION_GENERAL').fechaVencimiento;

describe('FASE 0 — golden de paridad: radicación interna (lib/actions/radicarVentanilla.ts)', () => {
  it('caso completo: todos los campos del solicitante diligenciados', async () => {
    const datos: DatosRadicacionInstitucional = {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1098765432',
      nombreCompleto: 'Ana María Torres',
      email: 'ana.torres@example.com',
      telefono: '3009876543',
      direccion: 'Carrera 5 # 10-20',
      pais: 'Colombia',
      departamento: 'Santander',
      municipio: 'Simacota',
      medioRecepcion: 'PRESENCIAL',
      tipoSolicitudId: 'PETICION_GENERAL',
      asunto: 'Solicitud de certificado de residencia',
      descripcion: 'El ciudadano solicita certificado de residencia para trámite bancario.',
      numeroFolios: 1,
      anexosDescripcion: '1 copia de cédula',
      archivos: [],
      fechaVencimiento: FECHA_VENCIMIENTO,
      origenIngreso: 'VENTANILLA_FISICA',
      tipoEntrada: 'SOLICITUD_CIUDADANA',
      telefonoMovil: '3009876543',
      telefonoFijo: '6076541234',
      barrio: 'Centro',
      numeroAnexos: 1,
      observacionesAnexos: 'Copia legible y completa',
      canalRespuesta: 'PRESENCIAL',
      noAportaDocumento: false,
      noAportaCorreo: false,
      noAportaTelefono: false,
      noAportaDireccion: false,
      oficinaDestino: 'VENTANILLA_UNICA',
      tipoPresentacion: 'IDENTIFICADA',
      areaResponsable: '',
    };
    const actor: ActorRadicacion = {
      uid: 'func-recepcion-01',
      nombre: 'Laura Recepción',
      tenantId: 'VENTANILLA_UNICA',
    };

    const resultado = await radicarInstitucionalmente(datos, actor);
    expect(resultado.consecutivo).toBe(41);

    const radicadoId = formatearRadicadoInstitucional(41, AHORA);
    expect(resultado.radicadoId).toBe(radicadoId);
    expect(radicadoPersistido?.path).toBe(`ventanilla_radicados/${radicadoId}`);

    const tipoSolicitud = TIPOS_SOLICITUD.PETICION_GENERAL;
    const serie = sugerirSerieDocumental('PETICION_GENERAL', 'VENTANILLA_UNICA');
    const clasifBase = construirClasificacionInicial('VENTANILLA_UNICA', actor.uid);

    const esperado: RadicadoInternoEsperado = {
      radicadoId,
      estadoActual: 'PENDIENTE',
      ultimaActualizacion: AHORA.toISOString(),
      prioridad: tipoSolicitud.prioridadSugerida,
      canalRespuesta: 'PRESENCIAL',
      tipoPresentacion: 'IDENTIFICADA',
      esAnonimo: false,
      identidadReservada: false,
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
        horaRadicado: AHORA.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        medioRecepcion: 'PRESENCIAL',
        origen: 'FISICO_ESCANER',
        origenIngreso: 'VENTANILLA_FISICA',
        tipoEntrada: 'SOLICITUD_CIUDADANA',
      },
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: tipoSolicitud.nombre,
        diasRespuesta: tipoSolicitud.diasRespuesta,
        unidad: tipoSolicitud.unidad,
        fechaVencimiento: FECHA_VENCIMIENTO,
        prorrogasAplicadas: 0,
      },
      clasificacion: {
        ...clasifBase,
        ...(serie ? { serieDocumental: serie } : {}),
      },
      detalle: {
        asunto: 'Solicitud de certificado de residencia',
        descripcion: 'El ciudadano solicita certificado de residencia para trámite bancario.',
        numeroFolios: 1,
        anexosDescripcion: '1 copia de cédula',
        numeroAnexos: 1,
        observacionesAnexos: 'Copia legible y completa',
      },
      archivos: [],
    };

    expect(radicadoPersistido?.data).toEqual(esperado);

    // Blindaje explícito (Fase 0): `areaResponsable` NO se marcó (cadena
    // vacía) → la propia acción la omite por diseño (spread condicional,
    // no `|| null`). Documentamos que aquí queda AUSENTE, no `null` —
    // asimetría real frente a otros campos opcionales de esta misma acción.
    const clasificacion = radicadoPersistido!.data.clasificacion as unknown as Record<string, unknown>;
    expect('areaResponsable' in clasificacion).toBe(false);
  });

  it('caso incompleto: campos opcionales NO diligenciados → null explícito', async () => {
    const datos: DatosRadicacionInstitucional = {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1098765432',
      nombreCompleto: 'Carlos Ramírez',
      email: '',
      telefono: '',
      direccion: '',
      pais: 'Colombia',
      departamento: 'Santander',
      municipio: 'Simacota',
      medioRecepcion: 'PRESENCIAL',
      tipoSolicitudId: 'PETICION_GENERAL',
      asunto: 'Solicitud de certificado de residencia',
      descripcion: 'El ciudadano solicita certificado de residencia para trámite bancario.',
      numeroFolios: 0,
      anexosDescripcion: '',
      archivos: [],
      fechaVencimiento: FECHA_VENCIMIENTO,
      // origenIngreso, tipoEntrada, telefonoMovil, telefonoFijo, barrio,
      // numeroAnexos, observacionesAnexos, canalRespuesta, noAporta*,
      // oficinaDestino, tipoPresentacion, areaResponsable: sin diligenciar
      // (ausentes) — ejercita las ramas `??`/`|| null` por defecto.
    };
    const actor: ActorRadicacion = {
      uid: 'func-recepcion-02',
      nombre: 'Recepción',
      tenantId: 'VENTANILLA_UNICA',
    };

    const resultado = await radicarInstitucionalmente(datos, actor);
    expect(resultado.consecutivo).toBe(41);

    const radicadoId = formatearRadicadoInstitucional(41, AHORA);
    const tipoSolicitud = TIPOS_SOLICITUD.PETICION_GENERAL;
    const serie = sugerirSerieDocumental('PETICION_GENERAL', 'VENTANILLA_UNICA');
    const clasifBase = construirClasificacionInicial('VENTANILLA_UNICA', actor.uid);

    const esperado: RadicadoInternoEsperado = {
      radicadoId,
      estadoActual: 'PENDIENTE',
      ultimaActualizacion: AHORA.toISOString(),
      prioridad: tipoSolicitud.prioridadSugerida,
      canalRespuesta: null,
      tipoPresentacion: 'IDENTIFICADA',
      esAnonimo: false,
      identidadReservada: false,
      solicitante: {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'CC',
        numeroDocumento: '1098765432',
        nombreCompleto: 'Carlos Ramírez',
        email: null,
        telefono: null,
        telefonoMovil: null,
        telefonoFijo: null,
        direccion: null,
        ubicacion: {
          pais: 'Colombia',
          departamento: 'Santander',
          municipio: 'Simacota',
          barrio: null,
        },
        datosNoAportados: null,
      },
      control: {
        radicadoId,
        consecutivo: 41,
        fechaRadicado: AHORA.toISOString(),
        horaRadicado: AHORA.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        medioRecepcion: 'PRESENCIAL',
        origen: 'FISICO_ESCANER',
        origenIngreso: 'PQRSD_WEB_OFICIAL',
        tipoEntrada: 'PQRSD',
      },
      termino: {
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoSolicitudNombre: tipoSolicitud.nombre,
        diasRespuesta: tipoSolicitud.diasRespuesta,
        unidad: tipoSolicitud.unidad,
        fechaVencimiento: FECHA_VENCIMIENTO,
        prorrogasAplicadas: 0,
      },
      clasificacion: {
        ...clasifBase,
        ...(serie ? { serieDocumental: serie } : {}),
      },
      detalle: {
        asunto: 'Solicitud de certificado de residencia',
        descripcion: 'El ciudadano solicita certificado de residencia para trámite bancario.',
        numeroFolios: 0,
        anexosDescripcion: null,
        numeroAnexos: 0,
        observacionesAnexos: null,
      },
      archivos: [],
    };

    expect(radicadoPersistido?.data).toEqual(esperado);

    // Condición 2 del propietario: las claves EXISTEN con valor `null` —
    // nunca ausentes ni `undefined`. `toEqual` normaliza `undefined` como
    // ausente, así que esta aserción `in` es la que de verdad blinda la
    // intención (no solo la captura en el fixture de arriba). Incluye
    // `datosNoAportados`, que llega a `null` vía `sanitizeFirestoreData`
    // (convierte el `undefined` explícito del código fuente) — el caso
    // concreto que exige esta fase para la superficie interna.
    const solicitante = radicadoPersistido!.data.solicitante as unknown as Record<string, unknown>;
    for (const campo of ['telefono', 'telefonoMovil', 'telefonoFijo', 'direccion', 'datosNoAportados']) {
      expect(campo in solicitante).toBe(true);
      expect(solicitante[campo]).toBeNull();
    }
    const ubicacion = radicadoPersistido!.data.solicitante.ubicacion as unknown as Record<string, unknown>;
    expect('barrio' in ubicacion).toBe(true);
    expect(ubicacion.barrio).toBeNull();
  });
});
