/* ══════════════════════════════════════════════════════════════
   lib/webhook.ts
   Envía el payload de un radicado nuevo al webhook de n8n para
   que un workflow de clasificación IA (GPT-4o) lo procese y luego
   actualice el documento en Firestore vía Firebase Admin.
══════════════════════════════════════════════════════════════ */

/**
 * Envía el radicado a n8n para clasificación IA.
 *
 * El cliente solo envía el número de radicado a una API propia. La API lee el
 * documento con cuenta de servicio y usa N8N_WEBHOOK_URL privado del servidor.
 *
 * n8n debe tener un workflow con:
 *   1. Trigger Webhook  → recibe este payload
 *   2. GPT-4o           → analiza descripción + documentos (OCR si es imagen)
 *   3. Lógica           → detecta zona geográfica, dependencia destino, prioridad
 *   4. Firebase Admin   → actualiza el radicado en Firestore con la clasificación
 */
export async function enviarWebhookN8N(radicado: {
  radicadoId:    string;
  origen:        string;
  fechaCreacion: string;
  ciudadano: {
    nombre:   string;
    email:    string;
    telefono: string;
  };
  archivos: { nombre: string; url: string; tipo: string }[];
  clasificacionIA: { mensajeOriginal: string };
}): Promise<void> {
  const res = await fetch('/api/radicacion/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ radicadoId: radicado.radicadoId }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const detail = payload && typeof payload.error === 'string'
      ? payload.error
      : `status ${res.status}`;
    throw new Error(`No se pudo enviar a n8n (${detail})`);
  }
}
