import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sendWhatsAppMessage';
import type { WhatsAppEventType, WhatsAppMessageResult } from '@/src/types/simi-whatsapp';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ventanilla.simacota.gov.co';

const EVENT_LABELS: Record<WhatsAppEventType, string> = {
  radicado_recibido: 'fue recibido',
  requiere_aclaracion: 'requiere una aclaración',
  respuesta_enviada: 'tiene una respuesta oficial',
  caso_trasladado: 'fue trasladado a la dependencia competente',
  caso_cerrado: 'fue cerrado',
};

export interface CitizenWhatsAppNotificationParams {
  radicadoId: string;
  tenantId: string;
  to: string;
  eventType: WhatsAppEventType;
  consentimiento: boolean;
  actorUid?: string;
  actorNombre?: string;
}

function buildSafeMessage(radicadoId: string, eventType: WhatsAppEventType): string {
  const linkConsulta = `${BASE_URL}/consulta?id=${encodeURIComponent(radicadoId)}`;
  return `Alcaldía Municipal de Simacota informa: su radicado ${radicadoId} ${EVENT_LABELS[eventType]}. Puede consultar el estado en el portal oficial: ${linkConsulta}. Este es un mensaje informativo.`;
}

async function audit(params: CitizenWhatsAppNotificationParams, result: WhatsAppMessageResult, message: string) {
  await getFirebaseAdminDb().collection('simi_operational_auditoria').add({
    accion: result.ok ? 'WHATSAPP_ENVIADO' : 'WHATSAPP_ERROR',
    resultado: result.ok ? 'ok' : 'error',
    radicadoId: params.radicadoId,
    tenantId: params.tenantId,
    usuarioUid: params.actorUid ?? null,
    usuarioNombre: params.actorNombre ?? null,
    rol: params.actorUid ? 'interno' : 'sistema',
    eventType: params.eventType,
    provider: result.provider,
    messageId: result.messageId ?? null,
    simulated: result.simulated ?? false,
    error: result.error ?? null,
    mensajeSeguroPreview: message.slice(0, 240),
    fecha: new Date().toISOString(),
  }).catch(() => null);
}

export async function sendCitizenWhatsAppNotification(
  params: CitizenWhatsAppNotificationParams,
): Promise<WhatsAppMessageResult> {
  if (!params.consentimiento) {
    const result: WhatsAppMessageResult = {
      ok: false,
      provider: 'none',
      error: 'El ciudadano no autorizó notificaciones por WhatsApp.',
    };
    await audit(params, result, '');
    return result;
  }

  const message = buildSafeMessage(params.radicadoId, params.eventType);
  const result = await sendWhatsAppMessage({
    to: params.to,
    message,
    radicadoId: params.radicadoId,
    eventType: params.eventType,
    tenantId: params.tenantId,
  });
  await audit(params, result, message);
  return result;
}
