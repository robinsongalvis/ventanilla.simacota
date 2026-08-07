/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/[radicadoId]/desistimiento   (BM-B33)

   Confirma el desistimiento tácito mediante ACTO ADMINISTRATIVO MOTIVADO
   (Ley 1755 Art. 17) — decisión HUMANA. Solo procede vencido el plazo de
   subsanación (con su prórroga). Permiso: ADMIN o JEFE_DEPENDENCIA del
   tenant (rol superior; canConfirmarDesistimiento).

   La notificación PERSONAL del acto al ciudadano se implementa en la
   pieza (5) con su plantilla; aquí queda el acto + su trazabilidad.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canConfirmarDesistimiento,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  assertNotClosed,
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { planDesistimiento, esError } from '@/lib/server/subsanacion';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildDesistimientoHtml,
  buildDesistimientoSubject,
} from '@/lib/email/templates/desistimiento';
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
  return NextResponse.json({ error: 'No fue posible confirmar el desistimiento.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const body = await request.json().catch(() => null) as { motivo?: string } | null;
    const motivo = body?.motivo ?? '';

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canConfirmarDesistimiento(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'El desistimiento es un acto administrativo: requiere rol de Jefe de Dependencia o Administrador.' }, { status: 403 });
    }

    const ahora = new Date();
    const plan = planDesistimiento(radicado, usuario, motivo, ahora);
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

    // Notificación del acto de desistimiento al ciudadano (Art. 17). El
    // desistimiento es un ACTO ADMINISTRATIVO: la notificación electrónica solo
    // procede si el ciudadano ACEPTÓ ese canal (CPACA Art. 56 → canalRespuesta
    // CORREO). En su defecto, la notificación PERSONAL (Arts. 67-69) la realiza
    // el funcionario fuera del sistema. Best-effort para el aviso electrónico.
    const emailDestino = radicado.solicitante?.email ?? null;
    const aceptoNotificacionElectronica = radicado.canalRespuesta === 'CORREO';
    const notificable = aceptoNotificacionElectronica && debeNotificarCiudadano({
      esAnonimo: radicado.esAnonimo,
      tipoPresentacion: radicado.tipoPresentacion,
      solicitante: { email: emailDestino },
    }) && !!emailDestino;
    let emailEnviado = false;
    if (notificable && emailDestino) {
      try {
        await enviarEmail({
          to: emailDestino,
          subject: buildDesistimientoSubject(radicadoId),
          // El desistimiento solo procede sobre una subsanación que ya nació
          // bajo el gate de régimen Ley 1755 (planRequerirSubsanacion no se
          // bloquea aquí — ver JSDoc en lib/server/subsanacion.ts).
          html: buildDesistimientoHtml({
            radicadoId,
            ciudadanoNombre: radicado.solicitante?.nombreCompleto ?? 'ciudadano/a',
            motivo: motivo.trim(),
            fundamentoLegal: TEXTOS_SUBSANACION_LEY_1755.fundamentoLegal,
          }),
        });
        emailEnviado = true;
        await registrarTrazabilidadNotificacion({
          radicadoId, tipoNotificacion: 'DESISTIMIENTO', destinatario: emailDestino, estado: 'ENVIADA',
        });
      } catch (err) {
        logError({ radicadoId, modulo: 'desistimiento/email', error: err });
        await registrarTrazabilidadNotificacion({
          radicadoId, tipoNotificacion: 'DESISTIMIENTO', destinatario: emailDestino, estado: 'FALLIDA',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      estadoActual: plan.nuevoEstado,
      emailEnviado,
      // Si no procedía la notificación electrónica, el funcionario debe
      // notificar personalmente el acto (CPACA Arts. 67-69).
      requiereNotificacionPersonal: !notificable,
    });
  } catch (error) {
    const { radicadoId } = await context.params.catch(() => ({ radicadoId: 'desconocido' }));
    logError({ radicadoId, modulo: 'radicados/desistimiento', error });
    return jsonError(error);
  }
}
