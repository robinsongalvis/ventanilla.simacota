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
  validarProrroga,
} from '@/lib/server/radicados-security';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildNotificacionEstadoHtml,
  buildNotificacionEstadoSubject,
} from '@/lib/email/templates/notificacion-estado';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import {
  notificacionRecienteEnviada,
  registrarNotificacionOmitida,
  registrarTrazabilidadNotificacion,
} from '@/lib/trazabilidad/notificacion';
import { logError } from '@/lib/logger';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible aplicar la prórroga.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const inicioOperacion = Date.now();
  let actorRolActual = 'DESCONOCIDO';
  let tenantActual = 'DESCONOCIDO';
  let radicadoIdActual: string | null = null;
  try {
    const usuario = await requireActiveInternalUser();
    actorRolActual = usuario.rol;
    tenantActual = usuario.tenantId;
    const { radicadoId } = await context.params;
    radicadoIdActual = radicadoId;
    const body = await request.json().catch(() => null) as { motivo?: string; diasProrroga?: number } | null;
    const motivo = body?.motivo?.trim() ?? '';
    const diasProrroga = Number(body?.diasProrroga ?? 0);

    if (motivo.length < 5) {
      return NextResponse.json({ error: 'Ingresa el motivo de la prórroga.' }, { status: 400 });
    }

    if (!Number.isInteger(diasProrroga) || diasProrroga < 1 || diasProrroga > 30) {
      return NextResponse.json({ error: 'Los días de prórroga deben estar entre 1 y 30.' }, { status: 400 });
    }

    const radicado = await getRadicadoOrFail(radicadoId);
    tenantActual = radicado.clasificacion.oficinaDestino;
    assertNotClosed(radicado);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite prorrogar este radicado.' }, { status: 403 });
    }

    // ADR-0003 (hallazgo H1) — control ejecutable de unicidad y tope legal
    // (Ley 1755/2015 art. 14). Debe evaluarse ANTES de cualquier escritura.
    const rechazo = validarProrroga({
      prorrogasAplicadas: radicado.termino.prorrogasAplicadas,
      diasProrroga,
      diasRespuesta: radicado.termino.diasRespuesta,
    });
    if (rechazo) {
      return NextResponse.json({ error: rechazo.mensaje }, { status: rechazo.status });
    }

    const ahora = new Date().toISOString();
    const fechaActual = new Date(radicado.termino.fechaVencimiento);
    const nuevaFecha = new Date(fechaActual);
    nuevaFecha.setDate(nuevaFecha.getDate() + diasProrroga);

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update({
      'termino.fechaVencimiento': nuevaFecha.toISOString(),
      'termino.prorrogasAplicadas': (radicado.termino.prorrogasAplicadas ?? 0) + 1,
      estadoActual: 'PRORROGA',
      ultimaActualizacion: ahora,
    });
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora,
      accion: 'PRORROGA',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: motivo,
      metadata: {
        actorRol: usuario.rol,
        diasProrroga,
        fechaVencimientoAnterior: radicado.termino.fechaVencimiento,
        fechaVencimientoNueva: nuevaFecha.toISOString(),
      },
    });

    // ── Notificación progresiva al ciudadano ──
    const dependencia = DIRECTORIO_TENANTS[radicado.clasificacion.oficinaDestino];
    const emailDestino = radicado.solicitante?.email ?? null;
    const puedeNotificar = debeNotificarCiudadano({
      esAnonimo: radicado.esAnonimo,
      tipoPresentacion: radicado.tipoPresentacion,
      solicitante: { email: emailDestino },
    });

    let emailEnviado = false;
    let emailError: string | undefined;

    if (puedeNotificar && emailDestino) {
      const nuevaFechaIso = nuevaFecha.toISOString();
      const duplicado = await notificacionRecienteEnviada({
        radicadoId,
        tipoNotificacion: 'PRORROGA',
        metadataMatch: { nuevaFechaLimite: nuevaFechaIso },
      });

      if (duplicado) {
        await registrarNotificacionOmitida({
          radicadoId,
          tipoNotificacion: 'PRORROGA',
          destinatario: emailDestino,
          motivo: `Prórroga a la misma fecha ${nuevaFechaIso} ya notificada en los últimos 5 minutos`,
        });
      } else {
        try {
          await enviarEmail({
            to: emailDestino,
            subject: buildNotificacionEstadoSubject(radicadoId, 'PRORROGA'),
            html: buildNotificacionEstadoHtml({
              radicadoId,
              ciudadanoNombre: radicado.solicitante.nombreCompleto,
              evento: 'PRORROGA',
              nuevaFechaLimite: nuevaFechaIso,
              diasProrroga,
              motivo,
              fechaEvento: ahora,
            }),
            replyTo: dependencia?.emailOficial,
          });
          emailEnviado = true;
          await registrarTrazabilidadNotificacion({
            radicadoId,
            tipoNotificacion: 'PRORROGA',
            destinatario: emailDestino,
            estado: 'ENVIADA',
            metadata: {
              diasProrroga,
              nuevaFechaLimite: nuevaFechaIso,
              dependencia: radicado.clasificacion.oficinaDestino,
            },
          });
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
          logError({ radicadoId, modulo: 'prorroga/email-ciudadano', error: err });
          await registrarTrazabilidadNotificacion({
            radicadoId,
            tipoNotificacion: 'PRORROGA',
            destinatario: emailDestino,
            estado: 'FALLIDA',
            error: emailError,
            metadata: {
              diasProrroga,
              nuevaFechaLimite: nuevaFechaIso,
              dependencia: radicado.clasificacion.oficinaDestino,
            },
          });
        }
      }
    }

    registrarEventoNegocio({
      operacion: 'prorroga',
      resultado: 'ok',
      latenciaMs: Date.now() - inicioOperacion,
      radicadoId: radicadoIdActual,
      actorRol: actorRolActual,
      tenant: tenantActual,
    });

    return NextResponse.json({
      ok: true,
      estadoActual: 'PRORROGA',
      fechaVencimiento: nuevaFecha.toISOString(),
      ultimaActualizacion: ahora,
      emailEnviado,
      ...(emailError ? { emailError } : {}),
    });
  } catch (error) {
    registrarEventoNegocio({
      operacion: 'prorroga',
      resultado: 'error',
      latenciaMs: Date.now() - inicioOperacion,
      radicadoId: radicadoIdActual,
      actorRol: actorRolActual,
      tenant: tenantActual,
      error,
    });
    console.error('[radicados/prorroga]', error);
    return jsonError(error);
  }
}
