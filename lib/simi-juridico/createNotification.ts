/**
 * Notificaciones internas del sistema jurídico.
 * Colección: simi_notificaciones
 *
 * Fase 1: solo Firestore. Fase 2: conectar con email.
 */

import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { ApprovalStatus } from '@/src/types/simi-approval';

export type NotificationType =
  | 'pendiente_revision_jefe'
  | 'pendiente_revision_juridica'
  | 'aprobado'
  | 'devuelto_para_ajustes'
  | 'escalado_juridica'
  | 'norma_cargada'
  | 'plantilla_creada';

export interface SimiNotificacion {
  id?:           string;
  tipo:          NotificationType;
  radicadoId?:   string;
  approvalId?:   string;
  tenantId:      string;
  /** Rol que debe recibir la notificación */
  destinatarioRol: string;
  /** UID específico si aplica */
  destinatarioUid?: string;
  titulo:        string;
  mensaje:       string;
  leida:         boolean;
  creadoPor:     string;
  createdAt:     string;
}

/** Labels por tipo */
const LABELS: Record<NotificationType, { titulo: string; icono: string }> = {
  pendiente_revision_jefe:       { titulo: 'Borrador pendiente de revisión',   icono: '📋' },
  pendiente_revision_juridica:   { titulo: 'Revisión jurídica obligatoria',    icono: '⚖️' },
  aprobado:                      { titulo: 'Respuesta aprobada',                icono: '✅' },
  devuelto_para_ajustes:         { titulo: 'Borrador devuelto para ajustes',   icono: '🔄' },
  escalado_juridica:             { titulo: 'Caso escalado a jurídica',          icono: '🚨' },
  norma_cargada:                 { titulo: 'Nueva norma cargada',               icono: '📚' },
  plantilla_creada:              { titulo: 'Plantilla creada',                  icono: '📝' },
};

/** Determinar el rol destinatario según el estado de aprobación */
function rolDestinatario(estado: ApprovalStatus): string {
  if (estado === 'pendiente_revision_juridica') return 'ADMIN';       // asesor jurídico o ADMIN
  if (estado === 'pendiente_revision_jefe')     return 'JEFE_DEPENDENCIA';
  return 'ADMIN';
}

/**
 * Crear notificación interna (fire-and-forget).
 */
export async function createNotification(
  params: Omit<SimiNotificacion, 'id' | 'leida' | 'createdAt'>,
): Promise<void> {
  try {
    await getFirebaseAdminDb().collection('simi_notificaciones').add({
      ...params,
      leida:     false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[simi] Error creando notificación:', err instanceof Error ? err.message : err);
  }
}

/**
 * Notificar cuando un flujo de aprobación cambia de estado.
 */
export async function notificarCambioAprobacion(params: {
  approvalId:   string;
  radicadoId:   string;
  tenantId:     string;
  estado:       ApprovalStatus;
  creadoPor:    string;
  radicadoDesc: string;
}): Promise<void> {
  const cfg = LABELS[params.estado as NotificationType] ?? { titulo: params.estado, icono: '📌' };
  const destinatario = rolDestinatario(params.estado);

  await createNotification({
    tipo:            params.estado as NotificationType,
    radicadoId:      params.radicadoId,
    approvalId:      params.approvalId,
    tenantId:        params.tenantId,
    destinatarioRol: destinatario,
    titulo:          `${cfg.icono} ${cfg.titulo}`,
    mensaje:         `El radicado ${params.radicadoId} (${params.radicadoDesc}) requiere su atención. Estado: ${params.estado.replace(/_/g, ' ')}.`,
    creadoPor:       params.creadoPor,
  });
}

/**
 * Marcar notificación como leída.
 */
export async function marcarLeida(notifId: string): Promise<void> {
  try {
    await getFirebaseAdminDb()
      .collection('simi_notificaciones')
      .doc(notifId)
      .update({ leida: true });
  } catch {
    // silenciar
  }
}
