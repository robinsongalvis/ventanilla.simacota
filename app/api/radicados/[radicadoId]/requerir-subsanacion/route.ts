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
import { TEXTOS_SUBSANACION_LEY_1755 } from '@/lib/catalogos/regimen-legal-subsanacion';
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

    /* ORDEN INVERTIDO A PROPÓSITO: primero se AVISA, después se escribe.
       Antes se escribía la suspensión y luego se intentaba el correo dentro de
       un try/catch que se tragaba el fallo — con SMTP sin configurar eso pasaba
       el 100% de las veces, y el expediente quedaba afirmando una notificación
       que nunca salió del edificio.
       El planificador es PURO, así que se planifica en seco para obtener la
       fecha límite que va en el correo, se envía, y se vuelve a planificar con
       el resultado REAL. Si el aviso no sale, el requerimiento queda emitido y
       PENDIENTE de notificación manual: el término de la Alcaldía sigue
       corriendo y al ciudadano no le corre ningún plazo. */
    const planTentativo = planRequerirSubsanacion(radicado, usuario, motivo, ahora, true);
    if (esError(planTentativo)) {
      return NextResponse.json({ error: planTentativo.mensaje }, { status: planTentativo.status });
    }
    // Notificación al ciudadano ANTES de consolidar nada.
    let emailEnviado = false;
    if (notificable && emailDestino) {
      const fechaLimite = String((planTentativo.update['termino.suspension'] as { fechaLimiteSubsanacion?: string })?.fechaLimiteSubsanacion ?? '');
      try {
        await enviarEmail({
          to: emailDestino,
          subject: buildRequerimientoSubject(radicadoId),
          // El gate de `planRequerirSubsanacion` (lib/server/subsanacion.ts)
          // ya garantizó que este radicado es régimen Ley 1755 antes de
          // llegar aquí — por eso los textos legales son la constante fija.
          html: buildRequerimientoHtml({
            radicadoId,
            ciudadanoNombre: radicado.solicitante?.nombreCompleto ?? 'ciudadano/a',
            motivo: motivo.trim(),
            fechaLimite,
            textos: TEXTOS_SUBSANACION_LEY_1755,
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

    /* Ahora, con el resultado REAL del envío, se planifica y se escribe. Si el
       correo no salió, `planRequerirSubsanacion` toma la rama «pendiente de
       notificación por vía manual»: la suspensión NO se ancla, el término de la
       Alcaldía sigue corriendo y la trazabilidad dice `notificado: false`. */
    const plan = planRequerirSubsanacion(radicado, usuario, motivo, ahora, emailEnviado);
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

    // `notificado` informa lo que OCURRIÓ, no lo que se pretendía.
    return NextResponse.json({ ok: true, estadoActual: plan.nuevoEstado ?? radicado.estadoActual, notificado: emailEnviado, emailEnviado });
  } catch (error) {
    const { radicadoId } = await context.params.catch(() => ({ radicadoId: 'desconocido' }));
    logError({ radicadoId, modulo: 'radicados/requerir-subsanacion', error });
    return jsonError(error);
  }
}
