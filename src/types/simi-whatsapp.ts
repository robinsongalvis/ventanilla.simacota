export type WhatsAppProvider = 'meta' | 'twilio' | 'wati' | 'mock' | 'none';

export type WhatsAppEventType =
  | 'radicado_recibido'
  | 'requiere_aclaracion'
  | 'respuesta_enviada'
  | 'caso_trasladado'
  | 'caso_cerrado';

export interface WhatsAppMessageRequest {
  to: string;
  message: string;
  radicadoId: string;
  eventType: WhatsAppEventType;
  tenantId: string;
}

export interface WhatsAppMessageResult {
  ok: boolean;
  provider: WhatsAppProvider;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}
