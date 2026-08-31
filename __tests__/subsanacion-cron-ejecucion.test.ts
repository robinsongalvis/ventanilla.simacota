import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * CORRIDA VIVA del cron de desistimiento tácito: ejecuta el handler REAL con la
 * frontera del Admin SDK simulada y una base sembrada.
 *
 * POR QUÉ EXISTE. La prueba de cableado que ya había (`subsanacion-cron.test.ts`)
 * solo comprobaba que el FUENTE contuviera las cadenas «autorizarCron» e
 * «isTest». Quitar del `.filter(...)` la exclusión de datos de prueba la dejaba
 * en VERDE: la palabra «isTest» sobrevive en el `.map(...)` de la línea de
 * arriba. Lo que esconde ese verde no es cosmético — un radicado de
 * DEMOSTRACIÓN propuesto para desistimiento tácito contamina una decisión
 * administrativa (Ley 1755 Art. 17) que después firma una persona.
 *
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esta prueba MIRA: la autorización del
 * cron, el recorte por estado de la consulta, el filtro de datos de prueba
 * (cada marca con su propio testigo), que el plazo vencido y la idempotencia
 * sigan cableados al filtro, a QUIÉN se le escribe la marca de idempotencia,
 * qué números reporta la corrida, y sus dos caminos de fallo (no poder leer, no
 * poder escribir). NO MIRA: (a) el DERRAME cuando el techo de lectura se
 * alcanza de verdad — el doble aplica el tope, pero aquí no se siembran mil
 * documentos, así que no se ejercita qué pasa con los que quedan fuera ni hay
 * paginación que probar; (b) el criterio CANÓNICO `esDatoDePrueba`: este cron
 * todavía filtra con su condición inline `!isTest && !excludeFromMetrics`, así
 * que NO excluye `anulado` ni `esPrueba` (los otros dos vigilantes ya migraron;
 * ver `__tests__/alcance-vigilantes-estados-activos.test.ts`); (c) el índice
 * real de Firestore ni el contenido escrito en la subcolección de trazabilidad
 * (su función está simulada: aquí solo se verifica a quién se invoca).
 */

/* ── Formas mínimas del doble de Firestore ──────────────────────────────── */
interface DocumentoFalso { id: string; data: () => Record<string, unknown> }
interface SnapshotFalso { docs: DocumentoFalso[]; size: number }
interface ConsultaFalsa {
  where(campo: string, operador: string, valor: unknown): ConsultaFalsa;
  limit(cantidad: number): ConsultaFalsa;
  get(): Promise<SnapshotFalso>;
}

const {
  baseDeDatos,
  mockAppendTrazabilidad,
  mockLogError,
  mockRegistrarEventoNegocio,
} = vi.hoisted(() => ({
  baseDeDatos: {
    documentos: [] as { id: string; datos: Record<string, unknown> }[],
    /** Toda escritura queda anotada con su RUTA: quién fue tocado, no cuántos. */
    escrituras: [] as { ruta: string; campos: Record<string, unknown> }[],
    /** Veces que se abrió la colección. Sirve para exigir que el trabajo NO empiece. */
    lecturas: 0,
    /** Tope que la consulta pidió; el doble lo anota y lo aplica. */
    topeSolicitado: null as number | null,
    /** Interruptores de avería, para los dos caminos de fallo. */
    fallarLectura: false,
    fallarEscrituraEn: null as string | null,
  },
  mockAppendTrazabilidad: vi.fn(
    async (radicadoId: string, entrada: Record<string, unknown>) => { void radicadoId; void entrada; },
  ),
  mockLogError: vi.fn(),
  mockRegistrarEventoNegocio: vi.fn(),
}));

vi.mock('@/lib/firebase-admin', () => {
  /** Lee `a.b.c` sobre el documento sembrado (Firestore filtra por ruta de campo). */
  const valorDe = (datos: Record<string, unknown>, campo: string): unknown =>
    campo.split('.').reduce<unknown>(
      (acc, tramo) => (acc as Record<string, unknown> | undefined)?.[tramo],
      datos,
    );

  function consulta(coleccion: string, filtros: [string, unknown][]): ConsultaFalsa {
    return {
      where(campo, operador, valor) {
        if (operador !== '==') {
          throw new Error(`El doble solo entiende '==' y le pidieron '${operador}'.`);
        }
        return consulta(coleccion, [...filtros, [campo, valor]]);
      },
      limit(cantidad) {
        /* Se anota Y se aplica (abajo, tras los filtros — el mismo orden que
           Firestore): así un techo rebajado por descuido a un puñado de
           documentos deja de pasar en verde. */
        baseDeDatos.topeSolicitado = cantidad;
        return consulta(coleccion, filtros);
      },
      async get() {
        if (coleccion !== 'ventanilla_radicados') {
          throw new Error(`Colección no sembrada en esta prueba: ${coleccion}`);
        }
        baseDeDatos.lecturas += 1;
        if (baseDeDatos.fallarLectura) {
          throw new Error('PERMISSION_DENIED: simulación de credencial revocada');
        }
        const docs = baseDeDatos.documentos
          .filter(({ datos }) => filtros.every(([campo, valor]) => valorDe(datos, campo) === valor))
          .map(({ id, datos }) => ({ id, data: () => datos }))
          .slice(0, baseDeDatos.topeSolicitado ?? Infinity);
        return { docs, size: docs.length };
      },
    };
  }

  return {
    getFirebaseAdminDb: () => ({
      collection: (nombre: string) => consulta(nombre, []),
      doc: (ruta: string) => ({
        update: async (campos: Record<string, unknown>) => {
          if (baseDeDatos.fallarEscrituraEn === ruta) {
            throw new Error('PERMISSION_DENIED: simulación de escritura rechazada');
          }
          baseDeDatos.escrituras.push({ ruta, campos });
        },
      }),
    }),
  };
});

/* Fronteras de IO, todas ya simuladas por otras pruebas del repo. Las funciones
   de DECISIÓN (`debeProponerDesistimiento`, `planPropuestaDesistimiento`) y la
   de AUTORIZACIÓN (`autorizarCron`) corren de verdad: son justamente lo que se
   quiere ver funcionar. */
vi.mock('@/lib/server/radicados-security', () => ({
  appendTrazabilidadAdmin: mockAppendTrazabilidad,
}));
vi.mock('@/lib/logger', () => ({ logError: mockLogError }));
vi.mock('@/lib/observabilidad/eventos-negocio', () => ({
  registrarEventoNegocio: mockRegistrarEventoNegocio,
}));

import { GET } from '@/app/api/cron/desistimiento-tacito/route';

const SECRETO = 'secreto-de-prueba';
const ENV_ORIGINAL = { ...process.env };

function pedido(token?: string): Request {
  return new Request(
    'http://localhost/api/cron/desistimiento-tacito',
    token === undefined ? undefined : { headers: { authorization: `Bearer ${token}` } },
  );
}

/* Fechas EXTREMAS a propósito: vencido en 2020 y vigente en 2099. El handler
   llama a `new Date()` por dentro, así que la prueba no puede depender del día
   en que se corra ni de la zona del proceso (local Bogotá, CI en UTC). */
const LIMITE_VENCIDO = '2020-03-01T12:00:00.000Z';
const LIMITE_VIGENTE = '2099-03-01T12:00:00.000Z';

function enSubsanacion(
  fechaLimiteSubsanacion: string,
  suspensionExtra: Record<string, unknown> = {},
  raizExtra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    estadoActual: 'EN_SUBSANACION',
    termino: {
      suspension: {
        activa: true,
        fechaRequerimiento: '2020-02-01T12:00:00.000Z',
        fechaNotificacion: '2020-02-01T12:00:00.000Z',
        fechaLimiteSubsanacion,
        diasHabilesRestantes: 5,
        motivo: 'Falta copia del documento de identidad.',
        requeridoPor: { uid: 'u1', nombre: 'María' },
        prorroga: null,
        desistimientoPropuesto: null,
        ...suspensionExtra,
      },
    },
    ...raizExtra,
  };
}

/** Operación real, vencida y sin proponer: el único caso que debe salir. */
const vencidoSinProponer = (raizExtra: Record<string, unknown> = {}) =>
  enSubsanacion(LIMITE_VENCIDO, {}, raizExtra);

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ENV_ORIGINAL, CRON_SECRET: SECRETO };
  baseDeDatos.escrituras = [];
  baseDeDatos.lecturas = 0;
  baseDeDatos.topeSolicitado = null;
  baseDeDatos.fallarLectura = false;
  baseDeDatos.fallarEscrituraEn = null;
  /* Cada documento sembrado es el TESTIGO de una condición distinta: si esa
     condición desaparece del cron, este documento aparece escrito y la prueba
     se pone roja. Sin testigo, la condición se puede borrar en verde. */
  baseDeDatos.documentos = [
    // La ÚNICA operación real que procede: es la única que debe salir propuesta.
    { id: 'REAL-1', datos: vencidoSinProponer() },
    /* Dos radicados de DEMOSTRACIÓN idénticos al real salvo por su marca, con
       las marcas SEPARADAS a propósito: si estuvieran juntas en un mismo
       documento, quitar solo una mitad del filtro (`!r.excludeFromMetrics`)
       seguiría pasando. Separadas, cada mitad tiene su propio testigo. */
    { id: 'PRUEBA-isTest',   datos: vencidoSinProponer({ isTest: true }) },
    { id: 'PRUEBA-excluido', datos: vencidoSinProponer({ excludeFromMetrics: true }) },
    /* Testigo del PLAZO: real, pero su término aún corre. Proponerle
       desistimiento sería adelantarse a un plazo que la ley le concede. */
    { id: 'REAL-VIGENTE', datos: enSubsanacion(LIMITE_VIGENTE) },
    /* Testigo de la IDEMPOTENCIA: vencido, pero ya propuesto. Sin él, el cron
       podría reproponer el mismo acto cada día y duplicar la constancia. */
    { id: 'REAL-YA-PROPUESTO', datos: enSubsanacion(LIMITE_VENCIDO, { desistimientoPropuesto: true }) },
    /* Recortado por la CONSULTA (`where estadoActual == 'EN_SUBSANACION'`): su
       efecto observable es `evaluados`, que cuenta lo que el cron llegó a leer. */
    { id: 'OTRO-ESTADO', datos: enSubsanacion(LIMITE_VENCIDO, {}, { estadoActual: 'EN_PROCESO' }) },
  ];
});

afterEach(() => { process.env = { ...ENV_ORIGINAL }; });

describe('cron de desistimiento tácito — corrida viva', () => {
  it('solo la operación REAL sale propuesta: se escribe en un único radicado', async () => {
    const respuesta = await GET(pedido(SECRETO));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(200);

    /* La aserción que importa no es un contador: es A QUIÉN se le escribió.
       Con el filtro de datos de prueba quitado, aquí aparecen también
       'ventanilla_radicados/PRUEBA-isTest' y '.../PRUEBA-excluido'. */
    expect(baseDeDatos.escrituras.map((e) => e.ruta)).toEqual(['ventanilla_radicados/REAL-1']);
    expect(baseDeDatos.escrituras[0].campos).toMatchObject({
      'termino.suspension.desistimientoPropuesto': true,
    });
    // El cron PROPONE; nunca archiva (Principio 9; Ley 1755 Art. 17).
    expect(baseDeDatos.escrituras[0].campos.estadoActual).toBeUndefined();

    // Y la constancia se le deja al mismo, y solo al mismo.
    expect(mockAppendTrazabilidad.mock.calls.map(([id]) => id)).toEqual(['REAL-1']);

    expect(cuerpo.propuestos).toBe(1);
    expect(cuerpo.errores).toBe(0);
    /* 5 leídos (el EN_PROCESO lo recortó la consulta) y 1 accionado: esos
       cuatro de diferencia son las cuatro razones por las que un radicado en
       subsanación NO procede — dos marcas de demostración, plazo vigente y
       acto ya propuesto. */
    expect(cuerpo.evaluados).toBe(5);
  });

  it('el rastro de la corrida distingue lo REVISADO de lo ACCIONADO', async () => {
    await GET(pedido(SECRETO));
    expect(mockRegistrarEventoNegocio).toHaveBeenCalledWith(
      expect.objectContaining({
        operacion:  'desistimiento_tacito',
        resultado:  'ok',
        actorRol:   'CRON',
        docsLeidos: 5,
        accionados: 1,
      }),
    );
  });

  it('la lectura va ACOTADA: la consulta pide un tope', async () => {
    await GET(pedido(SECRETO));
    expect(baseDeDatos.topeSolicitado).not.toBeNull();
    expect(baseDeDatos.topeSolicitado!).toBeGreaterThan(0);
    expect(baseDeDatos.topeSolicitado!).toBeLessThanOrEqual(1000);
  });

  it('una base compuesta SOLO de demostración deja la corrida en cero — y lo dice', async () => {
    baseDeDatos.documentos = [
      { id: 'PRUEBA-isTest',   datos: vencidoSinProponer({ isTest: true }) },
      { id: 'PRUEBA-excluido', datos: vencidoSinProponer({ excludeFromMetrics: true }) },
    ];

    const cuerpo = await (await GET(pedido(SECRETO))).json();

    expect(baseDeDatos.escrituras).toEqual([]);
    expect(mockAppendTrazabilidad).not.toHaveBeenCalled();
    expect(cuerpo.propuestos).toBe(0);
    /* El cero es por haber MIRADO y descartado, no por no haber mirado: sin
       esto, un cron que no lee nada se vería igual que uno que filtró bien. */
    expect(cuerpo.evaluados).toBe(2);
  });
});

describe('cron de desistimiento tácito — el trabajo NO empieza sin credencial', () => {
  it('sin CRON_SECRET configurado: 503 y la base ni se abre', async () => {
    delete process.env.CRON_SECRET;
    const respuesta = await GET(pedido(SECRETO));
    expect(respuesta.status).toBe(503);
    expect(baseDeDatos.lecturas).toBe(0);
    expect(baseDeDatos.escrituras).toEqual([]);
  });

  it('sin cabecera Authorization: 401 y la base ni se abre', async () => {
    const respuesta = await GET(pedido());
    expect(respuesta.status).toBe(401);
    expect(baseDeDatos.lecturas).toBe(0);
    expect(baseDeDatos.escrituras).toEqual([]);
  });

  it('con token equivocado: 401 y la base ni se abre', async () => {
    const respuesta = await GET(pedido('otro-token'));
    expect(respuesta.status).toBe(401);
    expect(baseDeDatos.lecturas).toBe(0);
    expect(baseDeDatos.escrituras).toEqual([]);
  });
});

describe('cron de desistimiento tácito — si algo falla, lo dice', () => {
  it('si NO PUEDE LEER, responde 500 y no reporta una corrida verde', async () => {
    baseDeDatos.fallarLectura = true;
    const respuesta = await GET(pedido(SECRETO));
    const cuerpo = await respuesta.json();

    expect(respuesta.status).toBe(500);
    // Lo que NO puede pasar: 200 con `propuestos: 0`, indistinguible de «todo en orden».
    expect(cuerpo.ok).toBeUndefined();
    expect(cuerpo.propuestos).toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('si NO PUEDE ESCRIBIR en uno, lo cuenta como error en vez de darlo por hecho', async () => {
    baseDeDatos.fallarEscrituraEn = 'ventanilla_radicados/REAL-1';
    const cuerpo = await (await GET(pedido(SECRETO))).json();

    expect(cuerpo.propuestos).toBe(0);
    expect(cuerpo.errores).toBe(1);
    expect(baseDeDatos.escrituras).toEqual([]);
    // No se deja constancia de un acto que no llegó a escribirse.
    expect(mockAppendTrazabilidad).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });
});
