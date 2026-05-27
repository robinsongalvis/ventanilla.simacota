import { doc, updateDoc, writeBatch, arrayUnion, Timestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { TenantId } from '@/src/types/radicado';

export interface ActorAsignacion {
  uid: string;
  nombre: string;
}

export interface ResultadoAsignacion {
  asignados: number;
  fallidos: number;
}

/* ══════════════════════════════════════════════════════════════
   ASIGNACIÓN INDIVIDUAL
══════════════════════════════════════════════════════════════ */

export async function asignarRadicado(
  radicadoId: string,
  tenantDestino: TenantId,
  actor: ActorAsignacion,
  funcionarioDestinoUid?: string,
): Promise<void> {
  const db = getDb();
  const ref = doc(db, 'ventanilla_radicados', radicadoId);
  const ahora = new Date().toISOString();

  await updateDoc(ref, {
    'clasificacion.oficinaDestino': tenantDestino,
    ...(funcionarioDestinoUid
      ? { 'clasificacion.funcionarioResponsableUid': funcionarioDestinoUid }
      : {}),
    estadoActual: 'ASIGNADO',
    trazabilidad: arrayUnion({
      fecha: ahora,
      accion: 'TRASLADO',
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      oficinaDestino: tenantDestino,
      ...(funcionarioDestinoUid ? { funcionarioDestinoUid } : {}),
      nota: `Asignado a ${tenantDestino} por ${actor.nombre}`,
    }),
  });
}

/* ══════════════════════════════════════════════════════════════
   ASIGNACIÓN MASIVA (writeBatch en bloques de 400)
══════════════════════════════════════════════════════════════ */

export async function asignarMasivo(
  radicadoIds: string[],
  tenantDestino: TenantId,
  actor: ActorAsignacion,
  onProgress?: (asignados: number, total: number) => void,
): Promise<ResultadoAsignacion> {
  const db = getDb();
  const CHUNK = 400;
  const ahora = new Date().toISOString();
  let asignados = 0;
  let fallidos = 0;

  const entrada = {
    fecha: ahora,
    accion: 'TRASLADO',
    actorUid: actor.uid,
    actorNombre: actor.nombre,
    oficinaDestino: tenantDestino,
    nota: `Asignación masiva a ${tenantDestino} por ${actor.nombre}`,
  };

  for (let i = 0; i < radicadoIds.length; i += CHUNK) {
    const lote = radicadoIds.slice(i, i + CHUNK);
    const batch = writeBatch(db);

    for (const id of lote) {
      const ref = doc(db, 'ventanilla_radicados', id);
      batch.update(ref, {
        'clasificacion.oficinaDestino': tenantDestino,
        estadoActual: 'ASIGNADO',
        trazabilidad: arrayUnion(entrada),
      });
    }

    try {
      await batch.commit();
      asignados += lote.length;
    } catch {
      fallidos += lote.length;
    }

    onProgress?.(asignados, radicadoIds.length);
  }

  return { asignados, fallidos };
}
