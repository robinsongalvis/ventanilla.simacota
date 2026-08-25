import type {
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import type { OrigenActuacion } from '@/lib/motor-expedientes/tipos';

/**
 * Helper transaccional de consecutivos legales — Bloque 2, corrección de H3.
 *
 * Causa raíz de H3: el consecutivo (contador) se confirmaba en una transacción
 * SEPARADA de la persistencia del radicado, dejando "consecutivos fantasma"
 * (número consumido sin documento). Este helper centraliza el primitivo
 * realmente duplicado en 5 rutas — "leer y avanzar el contador" — para que el
 * caller lo ejecute DENTRO de su propia `runTransaction`, junto con el
 * `tx.set` de su documento de negocio. Así contador y documento se confirman
 * atómicamente (Firestore↔Firestore): si algo falla, ni el contador avanza ni
 * el documento existe.
 *
 * Contrato de uso (obligatorio — revisión cruzada firestore-datos):
 *  1. El helper NO abre su propia transacción: recibe la `tx` del caller y
 *     opera dentro de ella.
 *  2. `leerConsecutivosLegales` hace TODAS las lecturas (regla del Admin SDK:
 *     todas las lecturas antes de cualquier escritura en una transacción).
 *  3. El caller construye su(s) documento(s) de negocio y llama a
 *     `confirmarConsecutivosLegales` — que escribe los contadores — dentro de
 *     la MISMA `tx`, junto a sus propios `tx.set`.
 *  4. Dentro del callback de la transacción SOLO debe haber cómputo puro y
 *     `tx.*`: ningún I/O, ninguna subida a Storage, ningún efecto no
 *     idempotente (la transacción puede reejecutarse en un reintento).
 *  5. Desde 6-ago-2026, `confirmarConsecutivosLegales` invoca el guard D9
 *     (`verificarAvanceCounter`) sobre CADA pendiente antes de cualquier
 *     `tx.set` — fail-closed: un counter corrupto o un consecutivo de
 *     origen `RECONSTRUIDO` abortan toda la confirmación (ver su JSDoc).
 */

export type SerieConsecutivo = 'radicados' | 'salidas' | 'planillas' | 'expedientes';

/**
 * Origen del consecutivo que se pretende escribir en un `counters/{serie}-{año}`.
 *
 * Alias del tipo canónico `OrigenActuacion` (`lib/motor-expedientes/tipos.ts`)
 * — ambos representan la MISMA unión conceptual ('REAL'|'RECONSTRUIDO') y
 * antes de este cambio estaban declarados por separado en dos módulos sin
 * ninguna relación estructural entre sí (deuda #10, ADR-0026 §A2): un cambio
 * futuro en uno (p. ej. añadir un tercer origen) podía olvidarse en el otro
 * sin que el compilador lo detectara. Se conserva el nombre `OrigenConsecutivo`
 * en este módulo (cero cambio de firma para sus consumidores) reexportando el
 * tipo de `lib/motor-expedientes/tipos.ts` como fuente única de verdad:
 *
 * - `REAL`: consumo genuino y nuevo de la serie (radicación normal).
 * - `RECONSTRUIDO`: número que proviene de reconstruir un evento histórico
 *   (p. ej. migración de expedientes en trámite, ADR-0026 D6/D9) o de un
 *   formato legado. Nunca debe avanzar el contador vigente de una serie
 *   real: el expediente reconstruido conserva su fecha/numeración
 *   original como dato de la actuación (`Actuacion.origen`, ver
 *   `lib/motor-expedientes/tipos.ts`), pero el contador Firestore que
 *   emite los PRÓXIMOS números nuevos no debe moverse por su causa.
 */
export type OrigenConsecutivo = OrigenActuacion;

/** Descripción de una serie a asignar: su nombre y su formateador de id. */
export interface SolicitudSerie {
  serie: SerieConsecutivo;
  /** Formateador canónico del id de negocio (p. ej. `1-110-{año}-{####}`). */
  formatear: (consecutivo: number, fecha: Date) => string;
  /**
   * Origen del consecutivo a leer para esta serie. OPCIONAL — default
   * `'REAL'`, aplicado en `leerConsecutivosLegales` (los 5 call sites
   * actuales no cambian: todos son radicación/expedición genuina).
   *
   * La migración de la Fase 5 (reconstrucción de expedientes históricos,
   * D6/D9 ADR-0026) NUNCA debe usar este flujo para AVANZAR counters. Si lo
   * intentara declarando `origen: 'RECONSTRUIDO'` aquí, el guard D9 dentro
   * de `confirmarConsecutivosLegales` lanza y aborta toda la transacción —
   * esa es exactamente la protección que exige D9: un número reconstruido
   * jamás consume la serie legal vigente.
   */
  origen?: OrigenConsecutivo;
  /**
   * Si `true`, un `counters/{serie}-{año}` INEXISTENTE es un error, no una
   * serie que empieza en cero.
   *
   * POR QUÉ EXISTE (medido el 13-ago-2026). `leerConsecutivosLegales` hacía
   * `?? 0` para todas las series, así que "no hay contador" y "la serie va
   * por cero" eran indistinguibles. Para las series nacidas digitales
   * (radicados, salidas, planillas) eso es correcto: el 1 de enero no hay
   * documento y el primer radicado del año debe ser el 0001.
   *
   * Para `expedientes` NO lo es, y ahí estaba el agujero: existe un libro de
   * papel anterior al sistema, y sus números ya se importaron como
   * `numeroExpediente.numero` SIN reservar unicidad y SIN avanzar el
   * contador (el importador lo tiene prohibido por DF-9). Con `?? 0`, la
   * primera emisión real de 2026 produciría `68745-0-26-0001`, que ya lo
   * ocupa un histórico en producción; `tx.create` sobre
   * `unicidad_expedientes` NO lo impediría, porque los históricos nunca
   * reservaron. Resultado: dos actos administrativos con el mismo número
   * legal, en silencio — justo lo que prohíbe el Acuerdo AGN 060/2001 art. 5.
   *
   * Con esta bandera, ABRIR la serie pasa a ser un acto explícito: alguien
   * decide con qué número arranca, por encima de lo que el libro ya consumió.
   * Convierte un duplicado silencioso en un fallo ruidoso — fail-closed.
   */
  exigeAperturaExplicita?: boolean;
}

/**
 * Lanzada cuando se pide un consecutivo de una serie que exige apertura
 * explícita y su contador anual todavía no existe. NO es un error de
 * programación: es la negativa deliberada a inventar el punto de partida de
 * una serie legal que puede venir de un libro de papel.
 */
export class SerieNoAbiertaError extends Error {
  readonly serie: SerieConsecutivo;
  readonly anio: number;
  constructor(serie: SerieConsecutivo, anio: number) {
    super(
      `La serie "${serie}" no está abierta para ${anio}: no existe counters/${serie}-${anio}. ` +
        'Abrir la serie es un acto explícito — debe sembrarse con el último número que el libro ' +
        'ya consumió, para que la primera emisión no duplique un número histórico.',
    );
    this.name = 'SerieNoAbiertaError';
    this.serie = serie;
    this.anio = anio;
  }
}

/** Consecutivo leído (aún no confirmado) para una serie. */
export interface ConsecutivoPendiente {
  serie: SerieConsecutivo;
  ref: DocumentReference;
  consecutivo: number;
  /** Id de negocio ya formateado a partir del consecutivo leído. */
  documentoId: string;
  /**
   * Dónde se reserva la unicidad de `documentoId`. Se construye en la fase de
   * LECTURA con el mismo `db` que recibió esta función, y no navegando desde
   * `ref` hacia atrás: el retropuntero `ref.firestore` es una superficie del
   * SDK que no todo doble de prueba implementa, y de la que este archivo no
   * necesita depender teniendo el `db` en la mano.
   */
  refUnicidad: DocumentReference;
  /** Valor de `counters/{serie}-{año}.ultimo` leído (0 si el documento no existía). Alimenta el guard D9 en `confirmarConsecutivosLegales`. */
  ultimoActual: number;
  /** Origen declarado por el caller (`SolicitudSerie.origen`, default `'REAL'`). Alimenta el guard D9 en `confirmarConsecutivosLegales`. */
  origen: OrigenConsecutivo;
}

/**
 * Registro por-transacción de los pendientes emitidos por
 * `leerConsecutivosLegales`. Garantiza que `confirmarConsecutivosLegales` solo
 * confirme lo que se leyó en ESTA misma transacción (no un arreglo construido
 * a mano ni el de otra `tx`). WeakMap/WeakSet → se limpian solos al terminar
 * la transacción.
 */
const emitidosPorTx = new WeakMap<Transaction, WeakSet<ConsecutivoPendiente[]>>();

/**
 * FASE LECTURA. Lee todos los contadores anuales de las series solicitadas y
 * devuelve el siguiente consecutivo de cada una, con su id de negocio ya
 * formateado. No escribe nada. Debe invocarse antes de cualquier `tx.set` del
 * caller (regla lecturas-antes-de-escrituras del Admin SDK).
 */
/** Lo que el acto de apertura deja escrito en el contador (ver lib/server/apertura-series.ts). */
export interface AperturaEnCounter {
  veniaDe?: number;
  abiertoEn?: number;
  fecha?: string;
  autorizadoPor?: string;
}

/**
 * ¿El contador cuadra con su propia historia?
 *
 * QUÉ CIERRA, Y POR QUÉ NO BASTABA LA RESERVA. La reserva de unicidad hace
 * IMPOSIBLE el duplicado — pero no explica por qué apareció, y falla en el
 * último paso con un `ALREADY_EXISTS` que no dice nada a quien lo lee. Esta
 * comprobación detecta la CAUSA y detiene la emisión antes de intentarla.
 *
 * EL CASO QUE DETECTA. Un contador movido hacia atrás por fuera del sistema —a
 * mano, con un script, restaurando un respaldo de ayer—. El guard D9 no lo ve:
 * lee 27, propone 28, y 28 > 27 es un avance perfectamente válido. Pero si el
 * contador declara que se abrió en 1600, estar en 27 es imposible sin que
 * alguien lo haya movido, y cada emisión desde ahí reintenta números ya usados.
 *
 * Solo actúa si el contador TIENE registro de apertura. Una serie que nunca se
 * abrió no tiene historia contra la cual contradecirse, y exigirla bloquearía
 * toda emisión anterior a la apertura — fallar cerrado donde no hay riesgo es
 * tan malo como no fallar donde lo hay.
 */
export function describirIncoherenciaApertura(
  serie: SerieConsecutivo,
  ultimoActual: number,
  apertura: AperturaEnCounter | undefined,
): string | null {
  const abiertoEn = apertura?.abiertoEn;
  if (typeof abiertoEn !== 'number' || !Number.isInteger(abiertoEn)) return null;

  // Tras abrir en `abiertoEn`, el contador nunca puede estar por debajo de
  // `abiertoEn - 1`: ese es el valor con el que quedó, y solo sube.
  const pisoLegitimo = abiertoEn - 1;
  if (ultimoActual >= pisoLegitimo) return null;

  return (
    `Contador incoherente en la serie '${serie}': declara que se abrió en ${abiertoEn} ` +
    `(autorizado por ${apertura?.autorizadoPor ?? 'sin declarar'}${apertura?.fecha ? `, ${apertura.fecha}` : ''}) ` +
    `pero su valor actual es ${ultimoActual}, por debajo del piso ${pisoLegitimo}. ` +
    `Alguien lo movió hacia atrás fuera del mecanismo de apertura.`
  );
}

/**
 * Versión que DETIENE. La usa la emisión: si el contador se contradice, no se
 * emite — seguir desde ahí repetiría números ya entregados.
 */
export function verificarCoherenciaConApertura(
  serie: SerieConsecutivo,
  ultimoActual: number,
  apertura: AperturaEnCounter | undefined,
): void {
  const incoherencia = describirIncoherenciaApertura(serie, ultimoActual, apertura);
  if (incoherencia) {
    throw new Error(
      `${incoherencia} NO se emite: seguir desde aquí repetiría números ya entregados. ` +
        `Revise el contador antes de reanudar.`,
    );
  }
}

export async function leerConsecutivosLegales(
  tx: Transaction,
  db: Firestore,
  fecha: Date,
  solicitudes: SolicitudSerie[],
): Promise<ConsecutivoPendiente[]> {
  const anio = fecha.getFullYear();
  const refs = solicitudes.map((s) => db.doc(`counters/${s.serie}-${anio}`));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

  const pendientes: ConsecutivoPendiente[] = solicitudes.map((s, i) => {
    // Fail-closed para las series con libro previo: sin documento de
    // contador no se inventa el punto de partida (ver `exigeAperturaExplicita`).
    if (s.exigeAperturaExplicita && !snaps[i].exists) {
      throw new SerieNoAbiertaError(s.serie, anio);
    }
    const ultimoActual = Number(snaps[i].data()?.ultimo ?? 0);
    // Coherencia con la propia historia del contador — ANTES de calcular nada.
    verificarCoherenciaConApertura(s.serie, ultimoActual, snaps[i].data()?.apertura);
    const consecutivo = ultimoActual + 1;
    return {
      serie: s.serie,
      ref: refs[i],
      consecutivo,
      documentoId: s.formatear(consecutivo, fecha),
      refUnicidad: db.doc(`unicidad_${s.serie}/${s.formatear(consecutivo, fecha)}`),
      ultimoActual,
      origen: s.origen ?? 'REAL',
    };
  });

  let set = emitidosPorTx.get(tx);
  if (!set) {
    set = new WeakSet<ConsecutivoPendiente[]>();
    emitidosPorTx.set(tx, set);
  }
  set.add(pendientes);

  return pendientes;
}

/**
 * FASE ESCRITURA. Confirma (avanza) cada contador dentro de la misma
 * transacción. DEBE recibir exactamente el arreglo devuelto por
 * `leerConsecutivosLegales` sobre esta misma `tx`; de lo contrario lanza —
 * evita confirmar un contador que no se leyó transaccionalmente.
 *
 * Desde 6-ago-2026 (precondición #4 del ADR-0026, deuda #7 §A2): ANTES de
 * escribir un solo `tx.set`, corre el guard D9 (`verificarAvanceCounter`)
 * sobre CADA pendiente. Fail-closed — un counter corrupto (`ultimo` no
 * entero o negativo) o un `origen: 'RECONSTRUIDO'` lanzan y abortan ESTA
 * función completa antes de tocar ningún `tx.set`; combinado con la
 * atomicidad ya existente de la transacción del caller, eso significa que
 * ni el contador ni el documento de negocio quedan escritos.
 */
export function confirmarConsecutivosLegales(
  tx: Transaction,
  fecha: Date,
  pendientes: ConsecutivoPendiente[],
): void {
  const set = emitidosPorTx.get(tx);
  if (!set || !set.has(pendientes)) {
    throw new Error(
      'confirmarConsecutivosLegales exige el arreglo devuelto por ' +
        'leerConsecutivosLegales sobre la misma transacción.',
    );
  }

  // Guard D9 primero, para TODOS los pendientes, antes de cualquier tx.set.
  for (const p of pendientes) {
    verificarAvanceCounter({
      serie: p.serie,
      ultimoActual: p.ultimoActual,
      ultimoPropuesto: p.consecutivo,
      origen: p.origen,
    });
  }

  const marca = { anio: fecha.getFullYear(), actualizadoEn: fecha.toISOString() };
  for (const p of pendientes) {
    /* RESERVA DE UNICIDAD — hace IMPOSIBLE el duplicado, no solo detectable.

       El guard D9 de arriba impide que el contador RETROCEDA al emitir, pero no
       cubre el caso peor: que alguien lo mueva hacia atrás POR FUERA (a mano,
       con un script, restaurando un respaldo). Entonces la siguiente emisión lee
       27, propone 28, y D9 lo aprueba —28 es mayor que 27— sin ver que el
       radicado 28 YA EXISTE. El resultado no es un hueco: son duplicados
       silenciosos, uno por emisión, hasta que alguien los note.
       Dos ciudadanos con el mismo número de radicado son dos expedientes que se
       pisan, y eso no se corrige con un acta.

       `tx.create` falla si el documento ya existe, sin necesitar una lectura
       previa: la semántica de `create` en una transacción hace esa comprobación
       al confirmar. Si falla, TODA la transacción del caller aborta — no queda
       ni el contador avanzado ni el documento de negocio.

       Va aquí, en el punto ÚNICO por el que pasan las cinco rutas de emisión
       (radicación pública e interna, registro exprés, salidas y planillas), y
       cubre las CUATRO series por construcción: nadie puede añadir una serie
       nueva y olvidarse de reservarla. */
    tx.create(p.refUnicidad, {
      serie: p.serie,
      consecutivo: p.consecutivo,
      // Instante REAL de la reserva (auditoría), no la fecha ancla del documento.
      creadoEn: new Date().toISOString(),
    });
    tx.set(p.ref, { ultimo: p.consecutivo, ...marca }, { merge: true });
  }
}

export interface GuardAvanceCounterInput {
  serie: SerieConsecutivo;
  /** Valor actual de `counters/{serie}-{año}.ultimo` (0 si el documento no existe). */
  ultimoActual: number;
  /** Valor que se pretende escribir en `ultimo`. */
  ultimoPropuesto: number;
  /** Origen del consecutivo que produjo `ultimoPropuesto`. */
  origen: OrigenConsecutivo;
}

/**
 * Guard puro (D9, ADR-0026) — salvaguarda de seguridad de datos, precondición
 * #4 del ADR antes de introducir la serie `expedientes`.
 *
 * CABLEADO desde 6-ago-2026 (deuda #7 §A2): `confirmarConsecutivosLegales`
 * invoca este guard automáticamente sobre cada pendiente antes de escribir
 * ningún contador — todo caller que pase por el flujo estándar de este
 * archivo ya queda protegido sin llamarlo explícitamente. No reemplaza la
 * atomicidad transaccional de `confirmarConsecutivosLegales` (eso ya lo
 * resuelve el fix de H3): este guard es una defensa adicional de CORRECCIÓN
 * de datos (valores imposibles, orígenes prohibidos), no de atomicidad.
 * Se exporta también como función independiente para cualquier punto de
 * escritura de `counters` — presente o futuro (p. ej. un asistente de
 * migración de la Fase 5) — que no pase por `confirmarConsecutivosLegales`;
 * ver el hallazgo de cobertura real (grep de escrituras directas a
 * `counters/` fuera de este archivo) documentado en el registro de deudas.
 *
 * Dos invariantes, ambas obligatorias:
 *  1. **Monotonicidad**: `ultimo` de una serie JAMÁS retrocede ni se
 *     estanca. `ultimoPropuesto` debe ser estrictamente mayor que
 *     `ultimoActual`.
 *  2. **Prohibición de números legados/reconstruidos en series reales**:
 *     un consecutivo de `origen: 'RECONSTRUIDO'` (migración de un
 *     expediente histórico, o cualquier número derivado de un formato
 *     legado) NUNCA puede avanzar el contador vigente. Las actuaciones
 *     reconstruidas se marcan como tales (D6/D8) pero no consumen la
 *     serie legal — solo un evento `REAL` (radicación/expedición nueva)
 *     puede hacerlo.
 *
 * Supuesto declarado (Principio 13 — no hay aún especificación cerrada del
 * formato de "número legado" porque la Fase 5 de migración no está
 * diseñada): este guard NO intenta parsear ni reconocer formatos legados
 * por su forma de string. En su lugar excluye por `origen` declarado por
 * el caller, que es la señal que SÍ conoce hoy el dominio (D6: la
 * migración marca explícitamente cada actuación/consecutivo que reconstruye
 * como `RECONSTRUIDO`). Si en la Fase 5 aparece un caso que requiera
 * detección estructural del formato, se amplía este guard con ADR — no se
 * fuerza aquí una regla sin caso real que la motive (YAGNI).
 *
 * Lanza `Error` (no devuelve `boolean`) a propósito: esto es un guard de
 * corrección de datos, no una validación de negocio recuperable — un
 * caller que lo invoca con un valor inválido tiene un bug que debe
 * detenerse, no degradarse en silencio.
 */
export function verificarAvanceCounter(input: GuardAvanceCounterInput): void {
  const { serie, ultimoActual, ultimoPropuesto, origen } = input;

  if (!Number.isInteger(ultimoActual) || ultimoActual < 0) {
    throw new Error(
      `Guard de counters: 'ultimoActual' inválido para la serie '${serie}' (${ultimoActual}). Debe ser un entero >= 0.`,
    );
  }
  if (!Number.isInteger(ultimoPropuesto) || ultimoPropuesto < 0) {
    throw new Error(
      `Guard de counters: 'ultimoPropuesto' inválido para la serie '${serie}' (${ultimoPropuesto}). Debe ser un entero >= 0.`,
    );
  }
  if (ultimoPropuesto <= ultimoActual) {
    throw new Error(
      `Guard de counters: la serie '${serie}' no puede retroceder ni estancarse ` +
        `(actual=${ultimoActual}, propuesto=${ultimoPropuesto}).`,
    );
  }
  if (origen === 'RECONSTRUIDO') {
    throw new Error(
      `Guard de counters: prohibido avanzar el contador vigente de la serie real ` +
        `'${serie}' con un consecutivo de origen RECONSTRUIDO (migración/legado). ` +
        `Las actuaciones reconstruidas no consumen la serie legal vigente (D9, ADR-0026).`,
    );
  }
}
