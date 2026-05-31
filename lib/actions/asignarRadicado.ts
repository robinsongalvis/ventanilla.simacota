import { addDoc, collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { getDb }              from '@/lib/firebase';
import { NOMBRES_TENANT }     from '@/src/types/reglas-negocio';
import type { TenantId }      from '@/src/types/radicado';
import type { TrazabilidadRadicado } from '@/src/types/ventanilla';
import type { RolInterno }    from '@/lib/hooks/useAuth';

/* ── Tipos públicos ─────────────────────────────────────────── */

export interface ActorAsignacion {
  uid:    string;
  nombre: string;
  rol?:   RolInterno;
}

/**
 * MIPG-2 — Snapshot del responsable funcional al momento de asignación.
 * Inmutable: si el usuario cambia de nombre/cargo/rol, el radicado histórico
 * conserva los datos originales.
 */
export interface ResponsableFuncionario {
  uid:    string;
  nombre: string;
  email:  string;
  rol:    RolInterno;
  cargo?: string;
}

export interface ResultadoAsignacion {
  asignados: number;
  fallidos:  number;
}

/* ══════════════════════════════════════════════════════════════
   ASIGNACIÓN INDIVIDUAL — con snapshot MIPG-2
══════════════════════════════════════════════════════════════ */

export async function asignarRadicado(
  radicadoId:    string,
  tenantDestino: TenantId,
  actor:         ActorAsignacion,
  /** Snapshot del responsable funcional. Si es null no se asigna responsable. */
  responsable?:  ResponsableFuncionario | null,
  /** Tenant de origen (para trazabilidad) */
  tenantOrigen?: TenantId,
): Promise<void> {
  const db   = getDb();
  const ref  = doc(db, 'ventanilla_radicados', radicadoId);
  const ahora = new Date().toISOString();

  // Snapshot MIPG-2 — solo se escribe si hay responsable definido
  const snapshotResponsable = responsable
    ? {
        'clasificacion.funcionarioResponsableUid':    responsable.uid,
        'clasificacion.funcionarioResponsableNombre': responsable.nombre,
        'clasificacion.funcionarioResponsableEmail':  responsable.email,
        'clasificacion.funcionarioResponsableRol':    responsable.rol,
        ...(responsable.cargo
          ? { 'clasificacion.funcionarioResponsableCargo': responsable.cargo }
          : {}),
        'clasificacion.fechaAsignacionResponsable':   ahora,
      }
    : {};

  await updateDoc(ref, {
    'clasificacion.oficinaDestino': tenantDestino,
    ...snapshotResponsable,
    estadoActual:        'ASIGNADO',
    ultimaActualizacion: ahora,
  });

  // Trazabilidad enriquecida con datos auditoriables (MIPG Req. 3)
  const metadataResponsable = responsable
    ? {
        funcionarioResponsableUid:    responsable.uid,
        funcionarioResponsableNombre: responsable.nombre,
        funcionarioResponsableEmail:  responsable.email,
        funcionarioResponsableRol:    responsable.rol,
        ...(responsable.cargo ? { funcionarioResponsableCargo: responsable.cargo } : {}),
      }
    : {};

  await addDoc(
    collection(db, 'ventanilla_radicados', radicadoId, 'trazabilidad'),
    {
      eventoId:    `ev_${radicadoId}_${Date.now()}`,
      fecha:        ahora,
      accion:       'TRASLADO',
      actorUid:     actor.uid,
      actorNombre:  actor.nombre,
      ...(tenantOrigen ? { oficinaOrigen: tenantOrigen } : {}),
      oficinaDestino: tenantDestino,
      nota: `Asignado a ${NOMBRES_TENANT[tenantDestino] ?? tenantDestino} por ${actor.nombre}`,
      metadata: {
        dependenciaOrigen:  tenantOrigen  ?? null,
        dependenciaDestino: tenantDestino,
        actorRol:           actor.rol ?? null,
        ...metadataResponsable,
      },
    } satisfies TrazabilidadRadicado,
  );
}

/* ══════════════════════════════════════════════════════════════
   ASIGNACIÓN MASIVA — writeBatch en bloques de 400
   No incluye snapshot de responsable individual (se asigna después
   por el funcionario o jefe de la dependencia destino).
══════════════════════════════════════════════════════════════ */

export async function asignarMasivo(
  radicadoIds:   string[],
  tenantDestino: TenantId,
  actor:         ActorAsignacion,
  onProgress?:   (asignados: number, total: number) => void,
): Promise<ResultadoAsignacion> {
  const db    = getDb();
  const CHUNK = 400;
  const ahora = new Date().toISOString();
  let asignados = 0;
  let fallidos  = 0;

  const entrada: Omit<TrazabilidadRadicado, 'eventoId'> = {
    fecha:       ahora,
    accion:      'TRASLADO',
    actorUid:    actor.uid,
    actorNombre: actor.nombre,
    oficinaDestino: tenantDestino,
    nota: `Asignación masiva a ${NOMBRES_TENANT[tenantDestino] ?? tenantDestino} por ${actor.nombre}`,
    metadata: {
      dependenciaDestino: tenantDestino,
      actorRol:           actor.rol ?? null,
      masivo:             true,
    },
  };

  for (let i = 0; i < radicadoIds.length; i += CHUNK) {
    const lote  = radicadoIds.slice(i, i + CHUNK);
    const batch = writeBatch(db);

    for (const id of lote) {
      batch.update(doc(db, 'ventanilla_radicados', id), {
        'clasificacion.oficinaDestino': tenantDestino,
        estadoActual:                   'ASIGNADO',
        ultimaActualizacion:            ahora,
      });
    }

    try {
      await batch.commit();
      await Promise.allSettled(
        lote.map((id, idx) =>
          addDoc(
            collection(db, 'ventanilla_radicados', id, 'trazabilidad'),
            { ...entrada, eventoId: `ev_${id}_${Date.now()}_${idx}` } satisfies TrazabilidadRadicado,
          ),
        ),
      );
      asignados += lote.length;
    } catch {
      fallidos += lote.length;
    }

    onProgress?.(asignados, radicadoIds.length);
  }

  return { asignados, fallidos };
}
