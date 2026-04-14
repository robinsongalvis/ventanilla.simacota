import type {
  FormRadicacionData,
  Radicado,
  WebhookResponse,
} from '@/src/types/radicado';

/**
 * Genera el ID único de radicado con el formato oficial:
 * EXT-YYYY-MM-DD-HHmmss
 */
function generateRadicadoId(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHmmss
  return `EXT-${date}-${time}`;
}

/**
 * Construye el payload inicial del radicado antes de ser procesado por IA.
 * La clasificaciónIA será null hasta que n8n + GPT-4o procesen el mensaje.
 */
function buildRadicadoPayload(
  data: FormRadicacionData,
  radicadoId: string
): Omit<Radicado, 'clasificacionIA'> & { clasificacionIA: null } {
  const now = new Date().toISOString();

  return {
    radicadoId,
    origen: 'WEB',
    fechaCreacion: now,
    estadoActual: 'PENDIENTE',
    prioridad: 'AMARILLO', // La IA reclasificará según urgencia
    ciudadano: {
      nombre: data.nombre.trim(),
      email: data.email.trim().toLowerCase(),
      telefono: data.telefono.trim(),
    },
    clasificacionIA: null,
    archivos: data.archivo
      ? [{ nombre: data.archivo.name, url: '' }] // URL se asigna tras subir a Storage
      : [],
    auditoria: [
      {
        fecha: now,
        accion: 'RADICACION',
        actor: 'Portal Web Ciudadano',
        nota: `Solicitud recibida vía formulario web. Pendiente clasificación automática por IA. Descripción: "${data.descripcion.slice(0, 120)}${data.descripcion.length > 120 ? '...' : ''}"`,
      },
    ],
  };
}

/**
 * Envía la radicación al webhook de n8n.
 * En esta fase, simula la llamada con un delay de red realista.
 *
 * En producción, reemplazar el bloque comentado con:
 * const WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!;
 * await fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
 */
export async function submitRadicacion(
  data: FormRadicacionData
): Promise<WebhookResponse> {
  const radicadoId = generateRadicadoId();
  const payload = buildRadicadoPayload(data, radicadoId);

  // [DEV] Log del payload que se enviaría al webhook de n8n
  console.group(`[VENTANILLA ÚNICA] Nueva radicación: ${radicadoId}`);
  console.log('Payload → n8n webhook:', JSON.stringify(payload, null, 2));
  console.groupEnd();

  // Simula latencia de red (reemplazar con fetch real en producción)
  await new Promise<void>((resolve) => setTimeout(resolve, 1800));

  // Simulación de éxito. Para simular un error, lanzar: throw new Error('Webhook no disponible');
  return { success: true, radicadoId };
}
