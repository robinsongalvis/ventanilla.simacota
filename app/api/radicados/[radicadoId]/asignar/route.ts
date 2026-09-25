import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { getNombreArea, validarAreaParaDestino } from '@/lib/catalogos/areas';
import {
  canAssignRadicado,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  assertNotClosed,
  buildResponsableMetadata,
  buildResponsableSnapshot,
  getRadicadoOrFail,
  nombreTenant,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildNotificacionEstadoHtml,
  buildNotificacionEstadoSubject,
} from '@/lib/email/templates/notificacion-estado';
import {
  buildAsignacionInternaHtml,
  buildAsignacionInternaSubject,
} from '@/lib/email/templates/asignacion-interna';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import {
  notificacionRecienteEnviada,
  registrarNotificacionOmitida,
  registrarTrazabilidadNotificacion,
} from '@/lib/trazabilidad/notificacion';
import { logError } from '@/lib/logger';
import { registrarEventoNegocio } from '@/lib/observabilidad/eventos-negocio';
import type { ResponsableFuncionario } from '@/lib/actions/asignarRadicado';
import type { TenantId } from '@/src/types/radicado';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

interface Payload {
  tenantDestino?: TenantId;
  responsable?: ResponsableFuncionario | null;
  /** Fase 2 — área responsable (id del catálogo), opcional. */
  areaId?: string | null;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible asignar el radicado.' }, { status: 500 });
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
    const payload = await request.json().catch(() => null) as Payload | null;
    const tenantDestino = payload?.tenantDestino;

    if (!tenantDestino || !DIRECTORIO_TENANTS[tenantDestino]) {
      return NextResponse.json({ error: 'Dependencia destino inválida.' }, { status: 400 });
    }
    tenantActual = tenantDestino;

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canAssignRadicado(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite asignar este radicado.' }, { status: 403 });
    }

    /* Fase 2 — área responsable (nivel 2). Validada contra el catálogo:
       propia del destino o transversal. Sin área nueva, se limpia la
       anterior — el destino cambió y el área vieja quedaría inconsistente. */
    const areaId = payload?.areaId?.trim() || null;
    if (areaId) {
      const errorArea = validarAreaParaDestino(areaId, tenantDestino);
      if (errorArea) {
        return NextResponse.json({ error: errorArea }, { status: 400 });
      }
    }

    const ahora = new Date().toISOString();
    const responsable = payload.responsable ?? null;
    const update = removeUndefinedDeep({
      'clasificacion.oficinaDestino': tenantDestino,
      'clasificacion.areaResponsable': areaId ?? FieldValue.delete(),
      ...buildResponsableSnapshot(responsable),
      estadoActual: 'ASIGNADO',
      ultimaActualizacion: ahora,
      ...(radicado.analisisIa && radicado.analisisIa.dependenciaSugerida !== tenantDestino ? {
        feedbackIa: {
          usuarioId: usuario.uid,
          actorNombre: usuario.nombre,
          puntuacion: 'CORREGIDO',
          motivoCorreccion: `Trasladado manualmente a ${nombreTenant(tenantDestino)}.`,
          fecha: ahora,
        },
      } : {}),
    });

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update(update);
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora,
      accion: 'ASIGNACION',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      oficinaOrigen: radicado.clasificacion.oficinaDestino,
      oficinaDestino: tenantDestino,
      nota: `Trasladado a ${nombreTenant(tenantDestino)}${areaId ? ` · área ${getNombreArea(areaId)}` : ''} por ${usuario.nombre}`,
      metadata: {
        dependenciaOrigen: radicado.clasificacion.oficinaDestino,
        dependenciaDestino: tenantDestino,
        actorRol: usuario.rol,
        ...(areaId ? { areaResponsable: areaId } : {}),
        ...buildResponsableMetadata(responsable),
      },
    });

    // ── Notificación progresiva al ciudadano (cortesía informativa) ──
    const dependenciaDestino = DIRECTORIO_TENANTS[tenantDestino];
    const emailDestino = radicado.solicitante?.email ?? null;
    const puedeNotificar = debeNotificarCiudadano({
      esAnonimo: radicado.esAnonimo,
      tipoPresentacion: radicado.tipoPresentacion,
      solicitante: { email: emailDestino },
    });

    let emailEnviado = false;
    let emailError: string | undefined;

    if (puedeNotificar && emailDestino) {
      const duplicado = await notificacionRecienteEnviada({
        radicadoId,
        tipoNotificacion: 'ASIGNACION',
        metadataMatch: { dependenciaDestino: tenantDestino },
      });

      if (duplicado) {
        await registrarNotificacionOmitida({
          radicadoId,
          tipoNotificacion: 'ASIGNACION',
          destinatario: emailDestino,
          motivo: `Misma dependencia destino (${tenantDestino}) ya notificada en los últimos 5 minutos`,
        });
      } else {
        try {
          await enviarEmail({
            to: emailDestino,
            subject: buildNotificacionEstadoSubject(radicadoId, 'ASIGNADO'),
            html: buildNotificacionEstadoHtml({
              radicadoId,
              ciudadanoNombre: radicado.solicitante.nombreCompleto,
              evento: 'ASIGNADO',
              dependenciaNombre: dependenciaDestino.nombreOficial,
              dependenciaEmail: dependenciaDestino.emailOficial,
              fechaEvento: ahora,
            }),
            replyTo: dependenciaDestino.emailOficial,
          });
          emailEnviado = true;
          await registrarTrazabilidadNotificacion({
            radicadoId,
            tipoNotificacion: 'ASIGNACION',
            destinatario: emailDestino,
            estado: 'ENVIADA',
            metadata: { dependenciaDestino: tenantDestino },
          });
        } catch (err) {
          emailError = err instanceof Error ? err.message : String(err);
          logError({ radicadoId, modulo: 'asignar/email-ciudadano', error: err });
          await registrarTrazabilidadNotificacion({
            radicadoId,
            tipoNotificacion: 'ASIGNACION',
            destinatario: emailDestino,
            estado: 'FALLIDA',
            error: emailError,
            metadata: { dependenciaDestino: tenantDestino },
          });
        }
      }
    }

    // ── BM-B17: correo interno a la dependencia asignada ──
    // Fuente oficial: M-GSC-8200-170-002 (Paso 16, "ASIGNACIÓN DE SOLICITUD").
    // Aviso de trabajo nuevo; best-effort — nunca bloquea la asignación.
    // Ortogonal a H3: no toca numeración; reutiliza la infraestructura de correo.
    const emailDependencia = dependenciaDestino.emailOficial;
    if (emailDependencia) {
      const duplicadoInterno = await notificacionRecienteEnviada({
        radicadoId,
        tipoNotificacion: 'ASIGNACION_INTERNA',
        metadataMatch: { dependenciaDestino: tenantDestino },
      });

      if (!duplicadoInterno) {
        try {
          await enviarEmail({
            to: emailDependencia,
            subject: buildAsignacionInternaSubject(radicadoId),
            html: buildAsignacionInternaHtml({
              radicadoId,
              dependenciaNombre: dependenciaDestino.nombreOficial,
              asunto: radicado.detalle?.asunto ?? '(sin asunto)',
              tipoSolicitudNombre: radicado.termino?.tipoSolicitudNombre,
              fechaVencimiento: radicado.termino?.fechaVencimiento ?? null,
              asignadoPor: usuario.nombre,
            }),
          });
          await registrarTrazabilidadNotificacion({
            radicadoId,
            tipoNotificacion: 'ASIGNACION_INTERNA',
            destinatario: emailDependencia,
            estado: 'ENVIADA',
            metadata: { dependenciaDestino: tenantDestino },
          });
        } catch (err) {
          logError({ radicadoId, modulo: 'asignar/email-dependencia', error: err });
          await registrarTrazabilidadNotificacion({
            radicadoId,
            tipoNotificacion: 'ASIGNACION_INTERNA',
            destinatario: emailDependencia,
            estado: 'FALLIDA',
            error: err instanceof Error ? err.message : String(err),
            metadata: { dependenciaDestino: tenantDestino },
          });
        }
      }
    }

    registrarEventoNegocio({
      operacion: 'asignacion',
      resultado: 'ok',
      latenciaMs: Date.now() - inicioOperacion,
      radicadoId: radicadoIdActual,
      actorRol: actorRolActual,
      tenant: tenantActual,
    });

    return NextResponse.json({
      ok: true,
      estadoActual: 'ASIGNADO',
      ultimaActualizacion: ahora,
      emailEnviado,
      ...(emailError ? { emailError } : {}),
    });
  } catch (error) {
    registrarEventoNegocio({
      operacion: 'asignacion',
      resultado: 'error',
      latenciaMs: Date.now() - inicioOperacion,
      radicadoId: radicadoIdActual,
      actorRol: actorRolActual,
      tenant: tenantActual,
      error,
    });
    console.error('[radicados/asignar]', error);
    return jsonError(error);
  }
}
