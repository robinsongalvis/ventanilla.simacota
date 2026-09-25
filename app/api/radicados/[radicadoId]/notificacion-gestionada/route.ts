import { NextResponse } from 'next/server';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { marcarNotificacionGestionada } from '@/lib/trazabilidad/notificacion';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/[radicadoId]/notificacion-gestionada

   Permite al funcionario marcar que una notificación fallida fue
   resuelta por canal alternativo (llamada, presencial, etc.).
   Baja el flag `alertaNotificacionFallida` y deja huella de
   auditoría `NOTIFICACION_GESTIONADA_MANUALMENTE` con el motivo.

   Requiere rol con permisos de operar el tenant del radicado.
══════════════════════════════════════════════════════════════ */

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

interface Payload {
  motivo?: string;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible registrar la gestión.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const payload = await request.json().catch(() => null) as Payload | null;
    const motivo = payload?.motivo?.trim() ?? '';

    if (motivo.length < 5) {
      return NextResponse.json(
        { error: 'Describe brevemente cómo se gestionó la notificación (mínimo 5 caracteres).' },
        { status: 400 },
      );
    }

    const radicado = await getRadicadoOrFail(radicadoId);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json(
        { error: 'Tu rol no permite gestionar notificaciones de este radicado.' },
        { status: 403 },
      );
    }

    if (radicado.alertaNotificacionFallida !== true) {
      return NextResponse.json(
        { error: 'Este radicado no tiene notificaciones pendientes de gestión.' },
        { status: 409 },
      );
    }

    await marcarNotificacionGestionada({
      radicadoId,
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: `Notificación gestionada por canal alternativo. ${motivo}`,
    });

    return NextResponse.json({ ok: true, alertaNotificacionFallida: false });
  } catch (error) {
    console.error('[radicados/notificacion-gestionada]', error);
    return jsonError(error);
  }
}
