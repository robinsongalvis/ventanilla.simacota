import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';
import type { TenantId } from '@/src/types/radicado';
import {
  confirmarConsecutivosLegales,
  leerConsecutivosLegales,
  type ConsecutivoPendiente,
} from '@/lib/server/consecutivo-legal';
import { formatearNumeroExpediente, type CodigosExpediente } from '@/lib/motor-expedientes/numero-expediente';

/**
 * Emisión del número de expediente + reserva de unicidad — Fase 2 (arranque,
 * PASO 5). Módulo SERVER (Admin SDK): junto a `consecutivo-legal.ts` en
 * responsabilidad (mismo patrón de "helper que opera DENTRO de la tx del
 * caller"), pero en archivo propio porque conoce el dato de dominio
 * `numeroExpediente` (que `consecutivo-legal.ts` deliberadamente NO conoce
 * — ver su JSDoc de `SolicitudSerie.formatear`).
 *
 * Colección `unicidad_expedientes` (guion bajo, convención del repo: mismo
 * patrón de `ventanilla_radicados`). Doc id = número de expediente completo
 * formateado (p. ej. `68745-0-26-0020`). Payload mínimo, SIN PII:
 * `{expedienteId, tenantId, creadoEn}`.
 *
 * DEPENDENCIA DECLARADA (fuera del alcance de este rol): `firestore.rules`
 * necesita el bloque `match /unicidad_expedientes/{id} { allow read, write:
 * if false; }` (server-only, Admin SDK bypasea rules) — el diseño y la
 * escritura de `firestore.rules` los ejecuta el Especialista de Firestore,
 * no este módulo. Este helper asume que esa regla ya existe o se añade en
 * paralelo; no la implementa.
 *
 * NO hay ruta HTTP todavía (fuera del alcance de este arranque) — este
 * módulo es el "call site del motor" que una ruta futura invocará dentro de
 * su propia `db.runTransaction(...)`.
 */

export interface EmitirNumeroExpedienteInput {
  tx: Transaction;
  db: Firestore;
  /** Fecha ancla de la actuación — DEBE ser la MISMA `Date` que indexa el
   *  counter `expedientes-{año}` (ver riesgo Nochevieja en el JSDoc de
   *  `formatearNumeroExpediente`); pásala ya anclada con `atLocalNoon`. */
  fecha: Date;
  tenantId: TenantId;
  /**
   * Códigos DANE/curaduría YA RESUELTOS por el caller — resolverlos con
   * `codigosNumeroExpediente(tenantId)` (`src/types/reglas-negocio.ts`)
   * ANTES de abrir la transacción (`db.runTransaction`), NO dentro de
   * ella: es una validación fail-closed de configuración, no una lectura
   * transaccional — fallar rápido sin gastar un round-trip de transacción
   * si al tenant le falta configuración.
   */
  codigos: CodigosExpediente;
  /**
   * Id SINTÉTICO del expediente que recibirá este número (el caller ya lo
   * conoce: `Expediente.id` existe antes de asignarle `numeroExpediente`).
   * Es el puntero inverso número→expediente de la reserva de unicidad —
   * corrección del hallazgo MEDIO de firestore-datos (7-ago-2026): antes se
   * escribía aquí el propio número formateado, perdiendo el puntero.
   */
  expedienteId: string;
}

export interface NumeroExpedienteEmitido {
  numeroExpediente: string;
  consecutivo: number;
  /** Pendiente crudo, por si el caller necesita más contexto (p. ej. logging). */
  pendiente: ConsecutivoPendiente;
}

/**
 * Emite un número de expediente REAL: lee el siguiente consecutivo de la
 * serie `expedientes`, RESERVA su unicidad (`tx.create` en
 * `unicidad_expedientes/{numero}` — falla si ya existe, sin necesitar
 * lectura previa) y confirma el contador (guard D9 incluido, ver
 * `confirmarConsecutivosLegales`). Todo dentro de la MISMA `tx` del caller
 * — si cualquier paso falla, Firestore aborta la transacción completa: ni
 * el contador avanza, ni la reserva de unicidad queda, ni el documento de
 * negocio del caller (que debe hacer su propio `tx.set`/`tx.create`
 * DESPUÉS de llamar a esta función, dentro de la misma `tx`) se escribe.
 *
 * Orden interno (regla lecturas-antes-de-escrituras del Admin SDK):
 * `leerConsecutivosLegales` (lectura) → `tx.create` de la reserva (escritura,
 * no requiere lectura previa) → `confirmarConsecutivosLegales` (escritura).
 *
 * Exclusivo para origen `REAL` — no acepta un parámetro `origen` porque la
 * emisión en vivo de un expediente SIEMPRE es un consumo genuino de la
 * serie. La reconstrucción histórica (Fase 5) NO pasa por esta función: no
 * hay contador que avanzar (el número ya existe, importado), así que su
 * eventual verificación de colisión contra `unicidad_expedientes` es un
 * primitivo READ-ONLY aparte — ver `verificarColisionNumeroExpediente` más
 * abajo — que Fase 5 diseñará cuando exista esa migración (no se construye
 * el resto del flujo de Fase 5 sin ese diseño — YAGNI).
 */
export async function emitirNumeroExpedienteReal(
  input: EmitirNumeroExpedienteInput,
): Promise<NumeroExpedienteEmitido> {
  const { tx, db, fecha, tenantId, codigos, expedienteId } = input;

  const pendientes = await leerConsecutivosLegales(tx, db, fecha, [
    {
      serie: 'expedientes',
      formatear: (consecutivo, f) => formatearNumeroExpediente(consecutivo, f, codigos),
      // origen omitido → default 'REAL' (ver JSDoc de SolicitudSerie.origen).
    },
  ]);
  const pendiente = pendientes[0];

  const unicidadRef: DocumentReference = db.doc(`unicidad_expedientes/${pendiente.documentoId}`);
  // tx.create: falla si el documento YA existe, sin necesitar un tx.get
  // previo — la propia semántica de `create` en una transacción de
  // Firestore hace esa comprobación al confirmar. Si falla, TODA la
  // transacción del caller aborta (atomicidad ya garantizada por
  // `runTransaction`).
  tx.create(unicidadRef, {
    expedienteId,
    tenantId,
    // Instante REAL de la reserva (auditoría), no la fecha ancla de la
    // actuación — esa viaja en el número mismo (AA) y en el counter.
    creadoEn: new Date().toISOString(),
  });

  // Guard D9 + avance del contador (ver JSDoc de confirmarConsecutivosLegales).
  confirmarConsecutivosLegales(tx, fecha, pendientes);

  return { numeroExpediente: pendiente.documentoId, consecutivo: pendiente.consecutivo, pendiente };
}

/**
 * Primitivo READ-ONLY para Fase 5 (migración de expedientes históricos,
 * NO diseñada todavía — este helper solo existe para que, cuando se
 * diseñe, no necesite reinventar cómo consultar `unicidad_expedientes`).
 * Reporta si un número YA reservado por una emisión REAL colisiona con un
 * número que la migración intenta importar como RECONSTRUIDO — SIN
 * escribir nada y SIN hacer fallar nada: la migración decide qué hacer con
 * la colisión (D9: los reconstruidos nunca reservan ni avanzan la serie
 * real, así que esto es pura información, no un guard).
 */
export async function verificarColisionNumeroExpediente(
  db: Firestore,
  numeroExpediente: string,
): Promise<boolean> {
  const snap = await db.doc(`unicidad_expedientes/${numeroExpediente}`).get();
  return snap.exists;
}
