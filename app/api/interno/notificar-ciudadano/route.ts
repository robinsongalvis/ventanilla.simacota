import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildRespuestaCiudadanoHtml,
  buildRespuestaCiudadanoSubject,
} from '@/lib/email/templates/respuesta-ciudadano';
import { logError } from '@/lib/logger';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import {
  InternalAuthError,
  requireActiveInternalUser,
  type InternalUserSession,
} from '@/lib/server/internal-auth';
import {
  autorizarNotificacionCiudadano,
  normalizarPayloadNotificacionCiudadano,
  type AccionNotificacionCiudadano,
  type MotivoDecisionNotificacionCiudadano,
} from '@/lib/seguridad/autorizar-notificacion-ciudadano';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma:          'no-cache',
  Expires:         '0',
};

type EventoAuditoriaNotificacion =
  | 'NOTIFICACION_CIUDADANO_AUTORIZADA'
  | 'NOTIFICACION_CIUDADANO_DENEGADA'
  | 'NOTIFICACION_CIUDADANO_ENVIADA'
  | 'NOTIFICACION_CIUDADANO_FALLIDA';

function jsonSeguro(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function registrarAuditoriaNotificacion(params: {
  tipo: EventoAuditoriaNotificacion;
  actorUid?: string | null;
  actorRol?: string | null;
  actorTenant?: string | null;
  radicadoId?: string | null;
  motivo: string;
}): Promise<void> {
  try {
    await getFirebaseAdminDb().collection('seguridad_notificaciones_auditoria').add(removeUndefinedDeep({
      tipo:        params.tipo,
      actorUid:    params.actorUid ?? null,
      actorRol:    params.actorRol ?? null,
      actorTenant: params.actorTenant ?? null,
      radicadoId:  params.radicadoId ?? null,
      motivo:      params.motivo,
      fecha:       new Date().toISOString(),
    }));
  } catch {
    // La auditoría de seguridad nunca debe filtrar detalles ni bloquear el flujo.
  }
}

async function registrarTrazabilidadNotificacionCiudadano(params: {
  radicadoId: string;
  usuario: InternalUserSession;
  estado: 'ENVIADA' | 'FALLIDA';
  accion: AccionNotificacionCiudadano;
  motivo?: string;
  tenantId: TenantId;
  tieneArchivo: boolean;
}): Promise<void> {
  const db = getFirebaseAdminDb();
  const ahoraIso = new Date().toISOString();
  const accionTrazabilidad = params.estado === 'ENVIADA'
    ? 'NOTIFICACION_CORREO_ENVIADA'
    : 'NOTIFICACION_CORREO_FALLIDA';

  const evento = removeUndefinedDeep({
    eventoId:    `ev_${params.radicadoId}_NOTIF_CIUDADANO_${Date.now()}`,
    fecha:       ahoraIso,
    accion:      accionTrazabilidad,
    actorUid:    params.usuario.uid,
    actorNombre: params.usuario.nombre,
    nota:        params.estado === 'ENVIADA'
      ? 'Notificación institucional enviada al ciudadano.'
      : 'Falló la notificación institucional al ciudadano.',
    metadata: {
      tipoNotificacion: params.accion,
      estado:           params.estado,
      actorRol:         params.usuario.rol,
      dependencia:      params.tenantId,
      tieneArchivo:     params.tieneArchivo,
      ...(params.motivo ? { motivo: params.motivo } : {}),
    },
  });

  try {
    const subcol = db.collection(`ventanilla_radicados/${params.radicadoId}/trazabilidad`);
    if (params.estado === 'FALLIDA') {
      const batch = db.batch();
      batch.set(subcol.doc(), evento);
      batch.update(db.doc(`ventanilla_radicados/${params.radicadoId}`), {
        alertaNotificacionFallida: true,
        ultimaActualizacion:       ahoraIso,
      });
      await batch.commit();
      return;
    }
    await subcol.add(evento);
  } catch {
    // La trazabilidad no debe impedir la respuesta del endpoint.
  }
}

function aRadicadoNotificable(radicado: VentanillaRadicado) {
  return {
    radicadoId:          radicado.radicadoId,
    tenantId:            radicado.clasificacion.oficinaDestino,
    email:               radicado.solicitante.email,
    esAnonimo:           radicado.esAnonimo,
    tipoPresentacion:    radicado.tipoPresentacion,
    identidadReservada:  radicado.identidadReservada,
  };
}

function obtenerNotaRespuesta(radicado: VentanillaRadicado): string | null {
  const nota = radicado.respuestaOficial?.nota?.trim();
  return nota && nota.length > 0 ? nota : null;
}

export async function POST(request: Request): Promise<NextResponse> {
  let usuario: InternalUserSession;

  try {
    usuario = await requireActiveInternalUser();
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return jsonSeguro(
        { error: error.status === 401 ? 'Debe iniciar sesión nuevamente.' : 'No tiene permiso para realizar esta acción.' },
        error.status,
      );
    }
    return jsonSeguro({ error: 'Debe iniciar sesión nuevamente.' }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_DENEGADA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      motivo:      'PAYLOAD_INVALIDO',
    });
    return jsonSeguro({ error: 'Solicitud inválida.' }, 400);
  }

  const payloadNormalizado = normalizarPayloadNotificacionCiudadano(payload);
  if (!payloadNormalizado.ok) {
    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_DENEGADA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      motivo:      payloadNormalizado.motivo,
    });
    return jsonSeguro({ error: payloadNormalizado.mensaje }, payloadNormalizado.status);
  }

  const { radicadoId, accion } = payloadNormalizado;
  const db = getFirebaseAdminDb();
  const snap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();

  if (!snap.exists) {
    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_DENEGADA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      radicadoId,
      motivo:      'RADICADO_NO_ENCONTRADO',
    });
    return jsonSeguro({ error: 'No fue posible localizar el radicado.' }, 404);
  }

  const radicado = {
    ...(snap.data() as VentanillaRadicado),
    radicadoId: (snap.data() as Partial<VentanillaRadicado>)?.radicadoId ?? snap.id,
  };

  const decision = autorizarNotificacionCiudadano({
    usuario,
    radicado: aRadicadoNotificable(radicado),
  });

  if (!decision.ok) {
    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_DENEGADA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      radicadoId,
      motivo:      decision.motivo,
    });
    return jsonSeguro({ error: decision.mensaje }, decision.status);
  }

  const tenantId = radicado.clasificacion.oficinaDestino;
  const dependencia = DIRECTORIO_TENANTS[tenantId];
  const destinatario = radicado.solicitante.email?.trim().toLowerCase();
  const nota = obtenerNotaRespuesta(radicado);

  if (!dependencia || !destinatario || !nota) {
    const motivo: MotivoDecisionNotificacionCiudadano | 'RESPUESTA_OFICIAL_NO_DISPONIBLE' = !destinatario
      ? 'CORREO_INVALIDO'
      : 'RESPUESTA_OFICIAL_NO_DISPONIBLE';
    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_DENEGADA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      radicadoId,
      motivo,
    });
    return jsonSeguro({ error: 'El radicado no cuenta con un correo válido para notificación.' }, 400);
  }

  await registrarAuditoriaNotificacion({
    tipo:        'NOTIFICACION_CIUDADANO_AUTORIZADA',
    actorUid:    usuario.uid,
    actorRol:    usuario.rol,
    actorTenant: usuario.tenantId,
    radicadoId,
    motivo:      accion,
  });

  const tieneArchivo = Boolean(radicado.respuestaOficial?.archivoPath);

  try {
    await enviarEmail({
      to:      destinatario,
      subject: buildRespuestaCiudadanoSubject(radicadoId),
      html:    buildRespuestaCiudadanoHtml({
        radicadoId,
        ciudadanoNombre:   radicado.solicitante.nombreCompleto || 'Ciudadano/a',
        asunto:            radicado.detalle.asunto || 'Sin asunto',
        nota,
        dependenciaNombre: dependencia.nombreOficial,
        dependenciaEmail:  dependencia.emailOficial,
        fechaRespuesta:    radicado.respuestaOficial?.fecha || new Date().toISOString(),
        tieneArchivo,
      }),
      replyTo: dependencia.emailOficial,
    });

    await registrarTrazabilidadNotificacionCiudadano({
      radicadoId,
      usuario,
      estado: 'ENVIADA',
      accion,
      tenantId,
      tieneArchivo,
    });

    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_ENVIADA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      radicadoId,
      motivo:      accion,
    });

    return jsonSeguro({ enviado: true });
  } catch (error) {
    logError({ radicadoId, modulo: 'notificar-ciudadano', error });

    await registrarTrazabilidadNotificacionCiudadano({
      radicadoId,
      usuario,
      estado: 'FALLIDA',
      accion,
      motivo: 'SMTP_FALLIDO',
      tenantId,
      tieneArchivo,
    });

    await registrarAuditoriaNotificacion({
      tipo:        'NOTIFICACION_CIUDADANO_FALLIDA',
      actorUid:    usuario.uid,
      actorRol:    usuario.rol,
      actorTenant: usuario.tenantId,
      radicadoId,
      motivo:      'SMTP_FALLIDO',
    });

    return jsonSeguro({ error: 'No fue posible enviar la notificación.' }, 500);
  }
}
