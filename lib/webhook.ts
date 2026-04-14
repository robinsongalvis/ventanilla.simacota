/* ══════════════════════════════════════════════════════════════
   lib/webhook.ts
   Envía el payload de un radicado nuevo al webhook de n8n para
   que un workflow de clasificación IA (GPT-4o) lo procese y luego
   actualice el documento en Firestore vía Firebase Admin.
══════════════════════════════════════════════════════════════ */

const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ?? '';

interface WebhookPayload {
  radicadoId:    string;
  origen:        string;
  fechaCreacion: string;
  ciudadano: {
    nombre:   string;
    email:    string;
    telefono: string;
  };
  descripcion: string;
  archivos: {
    nombre: string;
    url:    string;
    tipo:   string;
  }[];
  // Señal para que el workflow de n8n sepa qué acción ejecutar
  accion: 'CLASIFICAR_NUEVO_RADICADO';
}

/**
 * Envía el radicado a n8n para clasificación IA.
 *
 * - Timeout: 10 s. Si n8n no responde a tiempo se asume que procesará
 *   de forma asíncrona; NO se lanza un error para no bloquear la radicación.
 * - Si N8N_WEBHOOK_URL no está configurada, solo emite una advertencia.
 * - Si n8n responde con un status ≥ 400, se lanza un error para que
 *   el llamador lo registre como advertencia (el radicado ya está en Firestore).
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
  if (!N8N_WEBHOOK_URL) {
    console.warn(
      '⚠️  NEXT_PUBLIC_N8N_WEBHOOK_URL no configurada. ' +
      'El radicado no se enviará a clasificación IA automática.',
    );
    return;
  }

  const payload: WebhookPayload = {
    radicadoId:    radicado.radicadoId,
    origen:        radicado.origen,
    fechaCreacion: radicado.fechaCreacion,
    ciudadano:     radicado.ciudadano,
    descripcion:   radicado.clasificacionIA.mensajeOriginal,
    archivos:      radicado.archivos.map((a) => ({
      nombre: a.nombre,
      url:    a.url,
      tipo:   a.tipo,
    })),
    accion: 'CLASIFICAR_NUEVO_RADICADO',
  };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`n8n respondió con status ${res.status}`);
    }

    console.log('✅ Webhook n8n enviado:', radicado.radicadoId);
  } catch (err: unknown) {
    clearTimeout(timer);

    // AbortError = timeout → n8n puede procesar async; no es un error fatal
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('⏱️  Webhook n8n timeout (10 s). Se procesará de forma asíncrona.');
      return;
    }

    // Cualquier otro error se propaga para que radicacion.ts lo registre
    throw err;
  }
}
