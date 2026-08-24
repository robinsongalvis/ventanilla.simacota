import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   registrarTrazabilidadNotificacion — Helper único para todos
   los eventos de notificación por correo del radicado.

   Responsabilidades:
   1. Persistir el evento en la subcolección
      `ventanilla_radicados/{radicadoId}/trazabilidad` con la acción
      `NOTIFICACION_CORREO_ENVIADA` o `NOTIFICACION_CORREO_FALLIDA`.
   2. Si el estado es 'FALLIDA', subir el flag raíz
      `alertaNotificacionFallida = true` para que el dashboard pueda
      contar y resaltar el radicado SIN leer toda la subcolección.
   3. Nunca propagar excepciones — la trazabilidad nunca debe
      bloquear el flujo principal del radicado.

   El flag SOLO se baja a `false` cuando un funcionario marca
   explícitamente la notificación como gestionada por canal
   alternativo (ver POST /api/radicados/[id]/notificacion-gestionada).
══════════════════════════════════════════════════════════════ */

export type TipoNotificacion =
  | 'RADICACION'
  | 'ASIGNACION'
  /** BM-B17 — correo interno a la dependencia asignada (distinto del aviso al ciudadano). */
  | 'ASIGNACION_INTERNA'
  | 'PRORROGA'
  | 'RESPUESTA_OFICIAL'
  /** BM-B33 — requerimiento de subsanación (Ley 1755 Art. 17). */
  | 'SUBSANACION'
  /** BM-B33 — acto de desistimiento tácito notificado al ciudadano. */
  | 'DESISTIMIENTO'
  | 'RESET_PASSWORD'
  /** Sprint Ventanilla Operativa 2 — envío manual de la constancia de radicación por correo. */
  | 'CONSTANCIA';

export type EstadoNotificacion = 'ENVIADA' | 'FALLIDA';

export interface TrazaNotificacion {
  radicadoId:       string;
  tipoNotificacion: TipoNotificacion;
  destinatario:     string;
  estado:           EstadoNotificacion;
  error?:           string;
  /** Metadata adicional que el endpoint quiera adjuntar (ej. dependenciaDestino). */
  metadata?:        Record<string, unknown>;
}

const VENTANA_IDEMPOTENCIA_MS = 5 * 60 * 1000; // 5 min

export async function registrarTrazabilidadNotificacion(
  traza: TrazaNotificacion,
): Promise<void> {
  const db = getFirebaseAdminDb();
  const ahoraIso = new Date().toISOString();
  const accion = traza.estado === 'ENVIADA'
    ? 'NOTIFICACION_CORREO_ENVIADA'
    : 'NOTIFICACION_CORREO_FALLIDA';

  const notaHuman = traza.estado === 'ENVIADA'
    ? `Correo (${traza.tipoNotificacion}) enviado a ${traza.destinatario}`
    : `Falló el correo (${traza.tipoNotificacion}) a ${traza.destinatario}`;

  const evento = removeUndefinedDeep({
    eventoId:    `ev_${traza.radicadoId}_NOTIF_${traza.tipoNotificacion}_${Date.now()}`,
    fecha:       ahoraIso,
    accion,
    actorUid:    'sistema',
    actorNombre: 'Sistema',
    nota:        notaHuman,
    metadata: {
      tipoNotificacion: traza.tipoNotificacion,
      destinatario:     traza.destinatario,
      estado:           traza.estado,
      ...(traza.error ? { error: traza.error } : {}),
      ...(traza.metadata ?? {}),
    },
  });

  try {
    const subcol = db.collection(`ventanilla_radicados/${traza.radicadoId}/trazabilidad`);
    if (traza.estado === 'FALLIDA') {
      const docRef = db.doc(`ventanilla_radicados/${traza.radicadoId}`);
      const batch = db.batch();
      batch.set(subcol.doc(), evento);
      batch.update(docRef, {
        alertaNotificacionFallida: true,
        ultimaActualizacion: ahoraIso,
      });
      await batch.commit();
    } else {
      await subcol.add(evento);
    }
  } catch (err) {
    // Trazabilidad nunca debe interrumpir el flujo principal — pero sí debe
    // gritar si no puede escribirse (D5): es el registro probatorio de las
    // notificaciones. logError nunca lanza; el no-bloqueo se conserva.
    logError({ radicadoId: '', modulo: 'trazabilidad/notificacion', error: err });
  }
}

/* ══════════════════════════════════════════════════════════════
   Idempotencia para notificaciones de cambio de estado.
   Evita duplicar correo si el funcionario reasigna/reprorroga
   el mismo radicado en una ventana corta de tiempo (5 min) con
   los mismos parámetros (misma dependenciaDestino o misma fecha
   límite de prórroga).
══════════════════════════════════════════════════════════════ */

export async function notificacionRecienteEnviada({
  radicadoId,
  tipoNotificacion,
  metadataMatch,
  ventanaMs = VENTANA_IDEMPOTENCIA_MS,
}: {
  radicadoId:       string;
  tipoNotificacion: TipoNotificacion;
  /** Pares clave/valor que deben coincidir dentro de `metadata`. */
  metadataMatch:    Record<string, unknown>;
  ventanaMs?:       number;
}): Promise<boolean> {
  const db = getFirebaseAdminDb();
  const desdeIso = new Date(Date.now() - ventanaMs).toISOString();

  try {
    const snap = await db
      .collection(`ventanilla_radicados/${radicadoId}/trazabilidad`)
      .where('accion', '==', 'NOTIFICACION_CORREO_ENVIADA')
      .where('fecha', '>=', desdeIso)
      .get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data() as { metadata?: Record<string, unknown> };
      const md = data.metadata ?? {};
      if (md.tipoNotificacion !== tipoNotificacion) continue;
      const todosCoinciden = Object.entries(metadataMatch).every(
        ([k, v]) => md[k] === v,
      );
      if (todosCoinciden) return true;
    }
    return false;
  } catch {
    // Si la consulta falla, asumimos NO duplicado (mejor enviar que omitir).
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════
   Registro de notificaciones omitidas por duplicado.
══════════════════════════════════════════════════════════════ */

export async function registrarNotificacionOmitida({
  radicadoId,
  tipoNotificacion,
  destinatario,
  motivo,
}: {
  radicadoId:       string;
  tipoNotificacion: TipoNotificacion;
  destinatario:     string;
  motivo:           string;
}): Promise<void> {
  const db = getFirebaseAdminDb();
  const ahoraIso = new Date().toISOString();
  try {
    await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).add(removeUndefinedDeep({
      eventoId:    `ev_${radicadoId}_NOTIF_OMITIDA_${Date.now()}`,
      fecha:       ahoraIso,
      accion:      'NOTIFICACION_OMITIDA_DUPLICADA',
      actorUid:    'sistema',
      actorNombre: 'Sistema',
      nota:        `Notificación ${tipoNotificacion} omitida por idempotencia: ${motivo}`,
      metadata: {
        tipoNotificacion,
        destinatario,
        motivo,
      },
    }));
  } catch (err) {
    // No bloquear el flujo principal — con rastro (D5).
    logError({ radicadoId: '', modulo: 'trazabilidad/notificacion-gestionada', error: err });
  }
}

/* ══════════════════════════════════════════════════════════════
   Helper para que el endpoint de gestión manual baje el flag.
══════════════════════════════════════════════════════════════ */

export async function marcarNotificacionGestionada({
  radicadoId,
  actorUid,
  actorNombre,
  nota,
}: {
  radicadoId:  string;
  actorUid:    string;
  actorNombre: string;
  nota:        string;
}): Promise<void> {
  const db = getFirebaseAdminDb();
  const ahoraIso = new Date().toISOString();
  const docRef = db.doc(`ventanilla_radicados/${radicadoId}`);
  const subcol = db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`);

  const evento = removeUndefinedDeep({
    eventoId:    `ev_${radicadoId}_NOTIF_GESTIONADA_${Date.now()}`,
    fecha:       ahoraIso,
    accion:      'NOTIFICACION_GESTIONADA_MANUALMENTE',
    actorUid,
    actorNombre,
    nota,
    metadata: {
      gestionadaEn: ahoraIso,
    },
  });

  const batch = db.batch();
  batch.set(subcol.doc(), evento);
  batch.update(docRef, {
    alertaNotificacionFallida: false,
    ultimaActualizacion: ahoraIso,
  });
  await batch.commit();
}
