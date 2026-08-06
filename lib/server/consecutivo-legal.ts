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
 */

export type SerieConsecutivo = 'radicados' | 'salidas' | 'planillas' | 'expedientes';

/** Descripción de una serie a asignar: su nombre y su formateador de id. */
export interface SolicitudSerie {
  serie: SerieConsecutivo;
  /** Formateador canónico del id de negocio (p. ej. `1-110-{año}-{####}`). */
  formatear: (consecutivo: number, fecha: Date) => string;
}

/** Consecutivo leído (aún no confirmado) para una serie. */
export interface ConsecutivoPendiente {
  serie: SerieConsecutivo;
  ref: DocumentReference;
  consecutivo: number;
  /** Id de negocio ya formateado a partir del consecutivo leído. */
  documentoId: string;
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
    const consecutivo = Number(snaps[i].data()?.ultimo ?? 0) + 1;
    return {
      serie: s.serie,
      ref: refs[i],
      consecutivo,
      documentoId: s.formatear(consecutivo, fecha),
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

  const marca = { anio: fecha.getFullYear(), actualizadoEn: fecha.toISOString() };
  for (const p of pendientes) {
    tx.set(p.ref, { ultimo: p.consecutivo, ...marca }, { merge: true });
  }
}

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
 * Guard puro (D9, ADR-0026) — salvaguarda de seguridad de datos que debe
 * quedar implementada y verificada ANTES de introducir la serie
 * `expedientes` (precondición #4 del ADR). No reemplaza la atomicidad
 * transaccional de `confirmarConsecutivosLegales` (eso ya lo resuelve el
 * fix de H3): este guard es una defensa adicional para cualquier punto de
 * escritura de `counters` — presente o futuro (p. ej. un asistente de
 * migración de la Fase 5) — que no pase por el flujo transaccional
 * estándar de este archivo.
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
