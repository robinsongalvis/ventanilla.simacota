/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/[radicadoId]/requerir-subsanacion   (BM-B33)

   Emite un requerimiento de subsanación (Ley 1755 Art. 17). Si el
   ciudadano es notificable, la notificación ANCLA la suspensión del
   término (reloj server-side); si no (ANONIMA/sin contacto), se registra
   el requerimiento pero el término sigue corriendo (vía manual, v3).
   Permiso: funcionario del tenant (canOperateTenant).
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  assertNotClosed,
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { planRequerirSubsanacion, esError } from '@/lib/server/subsanacion';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildRequerimientoHtml,
  buildRequerimientoSubject,
} from '@/lib/email/templates/requerimiento-subsanacion';
import { registrarTrazabilidadNotificacion } from '@/lib/trazabilidad/notificacion';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible emitir el requerimiento.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const body = await request.json().catch(() => null) as { motivo?: string } | null;
    const motivo = body?.motivo ?? '';

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite requerir subsanación en este radicado.' }, { status: 403 });
    }

    const emailDestino = radicado.solicitante?.email ?? null;
    const notificable = debeNotificarCiudadano({
      esAnonimo: radicado.esAnonimo,
      tipoPresentacion: radicado.tipoPresentacion,
      solicitante: { email: emailDestino },
    }) && !!emailDestino;

    const ahora = new Date();
    const plan = planRequerirSubsanacion(radicado, usuario, motivo, ahora, notificable);
    if (esError(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update(plan.update);
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora.toISOString(),
      accion: plan.evento.accion,
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: plan.evento.nota,
      metadata: { ...plan.evento.metadata, dependencia: radicado.clasificacion.oficinaDestino },
    });

    // Notificación al ciudadano (solo si era notificable → ya se ancló).
    let emailEnviado = false;
    if (notificable && emailDestino) {
      const fechaLimite = String((plan.update['termino.suspension'] as { fechaLimiteSubsanacion?: string })?.fechaLimiteSubsanacion ?? '');
      try {
        await enviarEmail({
          to: emailDestino,
          subject: buildRequerimientoSubject(radicadoId),
          html: buildRequerimientoHtml({
            radicadoId,
            ciudadanoNombre: radicado.solicitante?.nombreCompleto ?? 'ciudadano/a',
            motivo: motivo.trim(),
            fechaLimite,
          }),
        });
        emailEnviado = true;
        await registrarTrazabilidadNotificacion({
          radicadoId, tipoNotificacion: 'SUBSANACION', destinatario: emailDestino, estado: 'ENVIADA',
        });
      } catch (err) {
        logError({ radicadoId, modulo: 'requerir-subsanacion/email', error: err });
        await registrarTrazabilidadNotificacion({
          radicadoId, tipoNotificacion: 'SUBSANACION', destinatario: emailDestino, estado: 'FALLIDA',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({ ok: true, estadoActual: plan.nuevoEstado, notificado: notificable, emailEnviado });
  } catch (error) {
    const { radicadoId } = await context.params.catch(() => ({ radicadoId: 'desconocido' }));
    logError({ radicadoId, modulo: 'radicados/requerir-subsanacion', error });
    return jsonError(error);
  }
}
