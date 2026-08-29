/**
 * FASE 0 (docs/CRONOGRAMA_PIEZA_ANGULAR.md) — LÍNEA BASE DE PARIDAD.
 * Superficie PÚBLICA: `app/api/radicacion/route.ts`.
 *
 * ⚠ HALLAZGO BLOQUEANTE (evidencia de esta fase, Principio 13 — medición
 * antes que opinión): AL EJECUTAR el handler POST real contra esta suite,
 * `app/api/radicacion/route.ts:429` llama
 * `confirmarConsecutivosLegales(tx, ahora, [consecRadicado])` con un
 * ARRAY NUEVO (`[consecRadicado]`), no la MISMA referencia que devolvió
 * `leerConsecutivosLegales` un poco antes (línea 348, destructurada como
 * `const [consecRadicado] = await leerConsecutivosLegales(...)`).
 * `confirmarConsecutivosLegales` (lib/server/consecutivo-legal.ts) exige
 * por contrato la MISMA referencia de arreglo (`WeakSet.has` es por
 * identidad, no por contenido — verificado de forma aislada con
 * `node -e` antes de reportar esto). Resultado: TODA solicitud a este
 * endpoint público lanza `confirmarConsecutivosLegales exige el arreglo
 * devuelto por leerConsecutivosLegales sobre la misma transacción.` y
 * responde 500 — el radicado NUNCA se persiste. `app/api/salidas/registrar/route.ts:133`
 * tiene el MISMO patrón roto (`const [consec] = await leerConsecutivosLegales(...)`
 * seguido de `confirmarConsecutivosLegales(tx, ahora, [consec])`).
 * `app/api/dependencias/registro-expres/route.ts` y
 * `app/api/planillas/generar/route.ts` SÍ pasan la referencia correcta
 * (la variable devuelta, sin volver a envolverla) — son la prueba de que
 * el patrón correcto ya existe en el repo.
 *
 * Los tests `*-atomicidad.test.ts` existentes (incluida
 * `radicacion-ciudadana-atomicidad.test.ts`) NO detectan esto porque solo
 * ejercitan la RUTA DE FALLO (`fallaPersistencia = true` todo el tiempo):
 * el 500 esperado ahí se solapa con el 500 de este bug, así que la
 * aserción de invariante ("si avanzó el consecutivo, existe el documento")
 * pasa igual sin importar la causa real del error.
 *
 * Por instrucción explícita de esta tarea (Fase 0 = SOLO tests, NINGÚN
 * cambio de código de producción) NO se corrige aquí. Se deja evidencia
 * reproducible (primer `describe` de abajo) y las 2 superficies del golden
 * quedan en `describe.skip` hasta que se resuelva — no hay "forma exitosa
 * en disco" que capturar hoy para esta ruta: el handler nunca llega a
 * `tx.set` del radicado.
 *
 * Congela la forma EXACTA en disco del documento `VentanillaRadicado` que
 * produce HOY esta ruta. Es la red de seguridad de la Fase 1 (constructor
 * compartido): estos golden tests deben seguir pasando SIN EDITARLOS y sin
 * diff. Si Fase 1 cambia el shape aquí capturado, es una regresión de
 * comportamiento — no un test desactualizado que haya que "arreglar".
 *
 * NO se unifica nada aquí (eso es Fase 1): solo se documenta la forma real
 * de esta superficie, incluida cualquier asimetría frente a la interna
 * (`radicarVentanilla.ts`) que ya identificó la revisión de datos.
 *
 * Determinismo:
 *  - Fecha del sistema congelada con `vi.useFakeTimers` + `vi.setSystemTime`
 *    (nunca `new Date()` libre en las aserciones: se reusa la constante
 *    `AHORA`).
 *  - Zona horaria fijada con `process.env.TZ` (afecta `toLocaleTimeString`).
 *  - Contador de consecutivo reiniciado en cada test (`beforeEach`).
 *  - Sin archivos adjuntos: evita Storage/`randomUUID` no determinista y
 *    mantiene el caso enfocado en el shape del documento, que es lo que
 *    exige esta fase.
 *  - El correo del solicitante SIEMPRE va diligenciado (en los dos casos):
 *    así `consultaToken`/`generarTokenConsulta` (aleatorio, `crypto`) nunca
 *    se ejercita — no hace falta mockear `node:crypto` para lograr un
 *    snapshot estable.
 *  - Envío de correo mockeado (`@/lib/email/mailer`) — no depende de SMTP
 *    real ni de variables de entorno EMAIL_*.
 *  - El resto de la lógica de negocio (término legal, serie documental,
 *    formateo del id) corre REAL, sin mockear — solo se mockea la frontera
 *    Admin SDK (Firestore/Storage) y el envío de correo, igual que el resto
 *    de la suite `*-atomicidad.test.ts`.
 */
process.env.TZ = 'America/Bogota';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcularFechaVencimiento, TIPOS_SOLICITUD } from '@/lib/tiempos-radicado';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import { sugerirSerieDocumental } from '@/lib/catalogos/series-documentales';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

const AHORA = new Date('2026-03-10T14:05:00.000Z');
const YEAR = AHORA.getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;
const DESCRIPCION = 'Solicito información sobre el trámite de certificado de residencia.';

interface RefFake {
  path: string;
  id: string;
}

let contadores: Record<string, number>;
let radicadoPersistido: { path: string; data: VentanillaRadicado } | null;

const fakeDb = {
  doc: (path: string): RefFake => ({ path, id: path.split('/').pop() ?? '' }),
  collection: () => ({ add: async () => ({ id: 'trz' }) }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { ref: RefFake; data: unknown }[] = [];
    const reservas: string[] = [];
    const tx = {
      get: async (ref: RefFake) => ({
        data: () => (contadores[ref.path] === undefined ? undefined : { ultimo: contadores[ref.path] }),
      }),
      set: (ref: RefFake, data: unknown) => {
        buffer.push({ ref, data });
      },
      /* Reserva de unicidad. No entra al buffer: el buffer distingue contadores
         de "el radicado persistido", y una reserva no es ninguno de los dos —
         mezclarla haría que la reserva se hiciera pasar por el radicado. */
      create: (ref: RefFake) => {
        if (reservas.includes(ref.path)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
        reservas.push(ref.path);
      },
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.ref.path.startsWith('counters/')) {
        contadores[w.ref.path] = (w.data as { ultimo: number }).ultimo;
      } else {
        radicadoPersistido = { path: w.ref.path, data: w.data as VentanillaRadicado };
      }
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({ file: () => ({ save: async () => {}, move: async () => {} }) }),
  }),
}));

vi.mock('@/lib/email/mailer', () => ({
  enviarEmail: vi.fn(async () => {}),
}));

import { POST } from '@/app/api/radicacion/route';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AHORA);
  contadores = { [COUNTER]: 40 };
  radicadoPersistido = null;
});

afterEach(() => {
  vi.useRealTimers();
});

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

/** Construye el `VentanillaRadicado` esperado con la MISMA fórmula que usa
 *  la ruta real para las piezas derivadas (término legal, serie documental,
 *  id) — así el fixture no depende de copiar a mano un cálculo de días
 *  hábiles o de un catálogo TRD que puede evolucionar por razones ajenas a
 *  esta fase. Lo que SÍ queda literal y explícito es la FORMA del documento:
 *  qué claves existen, cuáles son `null` y cuáles están ausentes.
 */
function construirEsperado(overrides: {
  radicadoId: string;
  consecutivo: number;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
}): VentanillaRadicado {
  const tipoSolicitud = TIPOS_SOLICITUD.PETICION_GENERAL;
  const termino = calcularFechaVencimiento(AHORA, 'PETICION_GENERAL');
  const serie = sugerirSerieDocumental('PETICION_GENERAL', 'VENTANILLA_UNICA');
  const asunto = `${tipoSolicitud.nombre}: ${DESCRIPCION.slice(0, 90)}${DESCRIPCION.length > 90 ? '...' : ''}`;

  return {
    radicadoId: overrides.radicadoId,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: AHORA.toISOString(),
    prioridad: tipoSolicitud.prioridadSugerida,
    cumplioTermino: null,
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'OTRO',
      numeroDocumento: '',
      nombreCompleto: overrides.nombre,
      razonSocial: null,
      email: overrides.email,
      telefono: overrides.telefono,
      direccion: overrides.direccion,
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: overrides.radicadoId,
      consecutivo: overrides.consecutivo,
      fechaRadicado: AHORA.toISOString(),
      horaRadicado: AHORA.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL',
      tipoSolicitudNombre: tipoSolicitud.nombre,
      diasRespuesta: termino.diasRespuesta,
      unidad: termino.unidad,
      fechaVencimiento: termino.fechaVencimiento,
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'VENTANILLA_UNICA',
      zonaGeografica: 'CASCO_URBANO',
      ...(serie ? { serieDocumental: serie } : {}),
    },
    detalle: {
      asunto,
      descripcion: DESCRIPCION,
      numeroFolios: 0,
      anexosDescripcion: null,
    },
    archivos: [],
  };
}

describe('FASE 0 — regresión: la radicación pública persiste (fix de confirmarConsecutivosLegales)', () => {
  it('una solicitud pública válida responde 200 y PERSISTE el radicado', async () => {
    const req = new Request('http://test/api/radicacion', {
      method: 'POST',
      body: formulario({
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoPresentacion: 'IDENTIFICADA',
        canalRespuesta: 'CORREO',
        nombre: 'Juan Pérez Prueba',
        email: 'juan.perez@example.com',
        telefono: '3001234567',
        direccion: 'Calle 10 # 5-20',
        descripcion: DESCRIPCION,
      }),
    });
    const res = await POST(req);
    const body = (await res.json()) as { exito: boolean };

    // Guardarraíl de regresión del P0: pasar un arreglo NUEVO a
    // confirmarConsecutivosLegales (guarda por identidad, consecutivo-legal.ts:107)
    // hacía fallar TODA radicación pública con 500. Corregido pasando el arreglo
    // devuelto por leer. Si alguien reintroduce el bug, este test vuelve a rojo.
    expect(res.status).toBe(200);
    expect(body.exito).toBe(true);
    expect(radicadoPersistido).not.toBeNull();
  });
});

describe('FASE 0 — golden de paridad: radicación pública (app/api/radicacion/route.ts)', () => {
  it('caso completo: todos los campos del solicitante diligenciados', async () => {
    const req = new Request('http://test/api/radicacion', {
      method: 'POST',
      body: formulario({
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoPresentacion: 'IDENTIFICADA',
        canalRespuesta: 'CORREO',
        nombre: 'Juan Pérez Prueba',
        email: 'juan.perez@example.com',
        telefono: '3001234567',
        direccion: 'Calle 10 # 5-20',
        descripcion: DESCRIPCION,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const radicadoId = formatearRadicadoInstitucional(41, AHORA);
    expect(radicadoPersistido?.path).toBe(`ventanilla_radicados/${radicadoId}`);

    const esperado = construirEsperado({
      radicadoId,
      consecutivo: 41,
      nombre: 'Juan Pérez Prueba',
      email: 'juan.perez@example.com',
      telefono: '3001234567',
      direccion: 'Calle 10 # 5-20',
    });
    expect(radicadoPersistido?.data).toEqual(esperado);

    // Blindaje explícito (Fase 0): con el correo diligenciado, `analisisIa`
    // (no se envió) y `consultaTokenHash` (no aplica) quedan AUSENTES —no
    // `null`— por el `removeUndefinedDeep` de esta ruta. Documentamos el
    // comportamiento actual; Fase 1 no debe alterarlo sin decisión aparte.
    const doc = radicadoPersistido!.data as unknown as Record<string, unknown>;
    expect('analisisIa' in doc).toBe(false);
    expect('consultaTokenHash' in doc).toBe(false);
  });

  it('caso incompleto: teléfono y dirección NO diligenciados → null explícito', async () => {
    const req = new Request('http://test/api/radicacion', {
      method: 'POST',
      body: formulario({
        tipoSolicitudId: 'PETICION_GENERAL',
        tipoPresentacion: 'IDENTIFICADA',
        canalRespuesta: 'CORREO',
        nombre: 'María Gómez Prueba',
        email: 'maria.gomez@example.com',
        telefono: '',
        direccion: '',
        descripcion: DESCRIPCION,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const radicadoId = formatearRadicadoInstitucional(41, AHORA);
    const esperado = construirEsperado({
      radicadoId,
      consecutivo: 41,
      nombre: 'María Gómez Prueba',
      email: 'maria.gomez@example.com',
      telefono: null,
      direccion: null,
    });
    expect(radicadoPersistido?.data).toEqual(esperado);

    // Condición 2 del propietario: las claves EXISTEN con valor `null` —
    // nunca ausentes ni `undefined`. `toEqual` normaliza `undefined` como
    // ausente, así que esta aserción `in` es la que de verdad blinda la
    // intención (no solo la captura en el snapshot/fixture de arriba).
    const solicitante = radicadoPersistido!.data.solicitante as unknown as Record<string, unknown>;
    expect('telefono' in solicitante).toBe(true);
    expect(solicitante.telefono).toBeNull();
    expect('direccion' in solicitante).toBe(true);
    expect(solicitante.direccion).toBeNull();
  });
});
