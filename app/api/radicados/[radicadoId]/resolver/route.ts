import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { enviarEmail } from '@/lib/email/mailer';
import {
  buildRespuestaCiudadanoHtml,
  buildRespuestaCiudadanoSubject,
} from '@/lib/email/templates/respuesta-ciudadano';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';
import { registrarTrazabilidadNotificacion } from '@/lib/trazabilidad/notificacion';
import { logError } from '@/lib/logger';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  buildRespuestaOficial,
  getRadicadoOrFail,
  RadicadoActionError,
  uploadRespuestaPdfAdmin,
} from '@/lib/server/radicados-security';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible resolver el radicado.' }, { status: 500 });
}

/**
 * Envía la notificación oficial al ciudadano y registra trazabilidad
 * unificada. Aplica `debeNotificarCiudadano` para honrar anonimato y
 * rechazar placeholders. Si SMTP falla, deja huella en trazabilidad y
 * sube `alertaNotificacionFallida` sin propagar la excepción.
 */
async function notificarCiudadano(params: {
  email: string | null | undefined;
  esAnonimo?: boolean;
  tipoPresentacion?: 'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA';
  nombre: string;
  radicadoId: string;
  asunto: string;
  nota: string;
  tenantId: string;
  fechaRespuesta: string;
  tieneArchivo: boolean;
}): Promise<{ emailEnviado: boolean; error?: string }> {
  const puedeNotificar = debeNotificarCiudadano({
    esAnonimo: params.esAnonimo,
    tipoPresentacion: params.tipoPresentacion,
    solicitante: { email: params.email },
  });
  if (!puedeNotificar) return { emailEnviado: false };

  const dependencia = DIRECTORIO_TENANTS[params.tenantId as keyof typeof DIRECTORIO_TENANTS];
  if (!dependencia) return { emailEnviado: false };

  const destinatario = params.email as string;

  try {
    await enviarEmail({
      to: destinatario,
      subject: buildRespuestaCiudadanoSubject(params.radicadoId),
      html: buildRespuestaCiudadanoHtml({
        radicadoId: params.radicadoId,
        ciudadanoNombre: params.nombre,
        asunto: params.asunto || 'Sin asunto',
        nota: params.nota,
        dependenciaNombre: dependencia.nombreOficial,
        dependenciaEmail: dependencia.emailOficial,
        fechaRespuesta: params.fechaRespuesta,
        tieneArchivo: params.tieneArchivo,
      }),
      replyTo: dependencia.emailOficial,
    });

    await registrarTrazabilidadNotificacion({
      radicadoId:       params.radicadoId,
      tipoNotificacion: 'RESPUESTA_OFICIAL',
      destinatario,
      estado:           'ENVIADA',
      metadata: {
        dependencia:  params.tenantId,
        tieneArchivo: params.tieneArchivo,
      },
    });

    return { emailEnviado: true };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    logError({ radicadoId: params.radicadoId, modulo: 'resolver/email-respuesta', error: err });
    await registrarTrazabilidadNotificacion({
      radicadoId:       params.radicadoId,
      tipoNotificacion: 'RESPUESTA_OFICIAL',
      destinatario,
      estado:           'FALLIDA',
      error:            mensaje,
      metadata: {
        dependencia:  params.tenantId,
        tieneArchivo: params.tieneArchivo,
      },
    });
    return { emailEnviado: false, error: mensaje };
  }
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const formData = await request.formData();
    const nota = typeof formData.get('nota') === 'string' ? String(formData.get('nota')).trim() : '';
    const archivo = formData.get('archivo');

    if (nota.length < 10) {
      return NextResponse.json({ error: 'La respuesta debe tener al menos 10 caracteres.' }, { status: 400 });
    }

    const radicado = await getRadicadoOrFail(radicadoId);
    if (radicado.estadoActual === 'RESUELTO' || radicado.cumplioTermino !== null && radicado.cumplioTermino !== undefined) {
      return NextResponse.json({ error: 'El radicado ya fue resuelto y no puede recalcular cumplimiento.' }, { status: 409 });
    }

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite resolver este radicado.' }, { status: 403 });
    }

    const ahora = new Date().toISOString();
    const archivoPdf = archivo instanceof File && archivo.size > 0
      ? await uploadRespuestaPdfAdmin(archivo, radicadoId)
      : null;
    const respuestaOficial = buildRespuestaOficial(archivoPdf, nota, ahora, usuario);
    const cumplioTermino = new Date(ahora) <= new Date(radicado.termino.fechaVencimiento);

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update({
      estadoActual: 'RESUELTO',
      ultimaActualizacion: ahora,
      cumplioTermino,
      ...(respuestaOficial ? { respuestaOficial } : {}),
    });
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora,
      accion: 'RESPUESTA_FUNCIONARIO',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota,
      metadata: {
        actorRol: usuario.rol,
        dependencia: radicado.clasificacion.oficinaDestino,
        cumplioTermino,
        fechaVencimiento: radicado.termino.fechaVencimiento,
        archivoAdjunto: archivoPdf?.nombre ?? null,
      },
    });

    const { emailEnviado, error: emailError } = await notificarCiudadano({
      email: radicado.solicitante.email,
      esAnonimo: radicado.esAnonimo,
      tipoPresentacion: radicado.tipoPresentacion,
      nombre: radicado.solicitante.nombreCompleto,
      radicadoId,
      asunto: radicado.detalle.asunto,
      nota,
      tenantId: radicado.clasificacion.oficinaDestino,
      fechaRespuesta: ahora,
      tieneArchivo: Boolean(archivoPdf),
    });

    return NextResponse.json({
      ok: true,
      estadoActual: 'RESUELTO',
      ultimaActualizacion: ahora,
      archivoNombre: archivoPdf?.nombre ?? null,
      cumplioTermino,
      emailEnviado,
      ...(emailError ? { emailError } : {}),
    });
  } catch (error) {
    console.error('[radicados/resolver]', error);
    return jsonError(error);
  }
}
