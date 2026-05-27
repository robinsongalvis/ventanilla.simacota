import { NextResponse, type NextRequest } from 'next/server';
import { getRadicadoAdmin } from '@/lib/firestore-admin-rest';

export const runtime = 'nodejs';

const RADICADO_RE = /^EXT-\d{4}-\d{2}-\d{2}-\d{6}-[A-Z2-9]{4}$/;
const TIMEOUT_MS = 10_000;

interface WebhookPayload {
  radicadoId: string;
  origen: string;
  fechaCreacion: string;
  ciudadano: {
    nombre: string;
    email: string;
    telefono: string;
  };
  descripcion: string;
  archivos: {
    nombre: string;
    url: string;
    tipo: string;
  }[];
  accion: 'CLASIFICAR_NUEVO_RADICADO';
}

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'N8N_WEBHOOK_URL no configurada en el servidor.' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const radicadoId = typeof body === 'object' && body !== null && 'radicadoId' in body
    ? String((body as { radicadoId: unknown }).radicadoId).trim().toUpperCase()
    : '';

  if (!RADICADO_RE.test(radicadoId)) {
    return NextResponse.json({ error: 'Numero de radicado invalido.' }, { status: 400 });
  }

  try {
    const data = await getRadicadoAdmin(radicadoId);

    if (!data) {
      return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
    }

    const clasificacion = data.clasificacionIA as { mensajeOriginal?: string } | null | undefined;
    const archivos = Array.isArray(data.archivos) ? data.archivos : [];

    const payload: WebhookPayload = {
      radicadoId,
      origen: String(data.origen ?? 'WEB'),
      fechaCreacion: String(data.fechaCreacion ?? new Date().toISOString()),
      ciudadano: {
        nombre: String((data.ciudadano as { nombre?: unknown } | undefined)?.nombre ?? ''),
        email: String((data.ciudadano as { email?: unknown } | undefined)?.email ?? ''),
        telefono: String((data.ciudadano as { telefono?: unknown } | undefined)?.telefono ?? ''),
      },
      descripcion: String(clasificacion?.mensajeOriginal ?? ''),
      archivos: archivos.map((archivo) => ({
        nombre: String((archivo as { nombre?: unknown }).nombre ?? ''),
        url: String((archivo as { url?: unknown }).url ?? ''),
        tipo: String((archivo as { tipo?: unknown }).tipo ?? ''),
      })),
      accion: 'CLASIFICAR_NUEVO_RADICADO',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `n8n respondio con status ${response.status}` },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ ok: true, warning: 'Timeout enviando a n8n.' });
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error enviando a clasificacion IA.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
