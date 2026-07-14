import type {
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';

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

export type SerieConsecutivo = 'radicados' | 'salidas' | 'planillas';

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
