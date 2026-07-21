import type { WhatsAppMessageRequest, WhatsAppMessageResult, WhatsAppProvider } from '@/src/types/simi-whatsapp';

function providerFromEnv(): WhatsAppProvider {
  const raw = (process.env.WHATSAPP_PROVIDER ?? 'none').toLowerCase();
  if (raw === 'meta' || raw === 'twilio' || raw === 'wati' || raw === 'mock') return raw;
  return 'none';
}

/**
 * Normaliza un número al formato E.164 sin `+` usado por los proveedores de
 * WhatsApp (código de país + dígitos). Se exporta para que los consumidores
 * que deben CONTRASTAR dos teléfonos (p. ej. verificar que el destino de una
 * notificación coincide con el teléfono registrado del solicitante) usen la
 * misma normalización que efectivamente se envía — evita falsos negativos o
 * positivos por diferencias de formato ("+57 310...", "310...", etc.).
 */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  return digits.startsWith('57') ? digits : `57${digits}`;
}

export function isValidWhatsAppPhone(value: string): boolean {
  return normalizePhone(value) !== null;
}

export async function sendWhatsAppMessage(params: WhatsAppMessageRequest): Promise<WhatsAppMessageResult> {
  const provider = providerFromEnv();
  const to = normalizePhone(params.to);

  if (!to) {
    return { ok: false, provider, error: 'Número de WhatsApp inválido.' };
  }

  if (provider === 'none' || provider === 'mock') {
    return {
      ok: true,
      provider,
      simulated: true,
      messageId: `mock_${params.radicadoId}_${Date.now()}`,
    };
  }

  if (provider === 'meta') {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      return { ok: false, provider, error: 'Proveedor WhatsApp Meta no configurado.' };
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          preview_url: true,
          body: params.message,
        },
      }),
    });
    const payload = await response.json().catch(() => null) as { messages?: Array<{ id?: string }>; error?: { message?: string } } | null;

    if (!response.ok) {
      return { ok: false, provider, error: payload?.error?.message ?? 'Error enviando WhatsApp.' };
    }

    return { ok: true, provider, messageId: payload?.messages?.[0]?.id };
  }

  return { ok: false, provider, error: `Proveedor ${provider} pendiente de integración.` };
}
