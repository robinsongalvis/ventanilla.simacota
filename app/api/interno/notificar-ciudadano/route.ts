import { NextResponse }       from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { enviarEmail }          from '@/lib/email/mailer';
import {
  buildRespuestaCiudadanoHtml,
  buildRespuestaCiudadanoSubject,
} from '@/lib/email/templates/respuesta-ciudadano';
import { DIRECTORIO_TENANTS }  from '@/src/types/reglas-negocio';
import { logError }             from '@/lib/logger';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   POST /api/interno/notificar-ciudadano
   Envía email al ciudadano cuando su radicado es respondido.
   Requiere sesión de funcionario válida.
   Registra trazabilidad NOTIFICACION_CORREO_ENVIADA / FALLIDA.
══════════════════════════════════════════════════════════════ */

interface NotificarCiudadanoPayload {
  radicadoId:        string;
  emailCiudadano:    string;
  nombreCiudadano:   string;
  asunto:            string;
  nota:              string;
  tenantId:          TenantId;
  fechaRespuesta:    string;
  tieneArchivo:      boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Registra evento de notificación en la subcollección de trazabilidad del radicado. */
async function registrarTrazabilidadNotificacion({
  radicadoId,
  destinatario,
  estado,
  error,
}: {
  radicadoId:   string;
  destinatario: string;
  estado:       'ENVIADA' | 'FALLIDA';
  error?:       string;
}): Promise<void> {
  try {
    const db  = getFirebaseAdminDb();
    const ahora = new Date().toISOString();
    await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).add({
      eventoId:    `ev_${radicadoId}_NOTIF_RESPUESTA_${ahora}`,
      fecha:       ahora,
      accion:      estado === 'ENVIADA' ? 'NOTIFICACION_CORREO_ENVIADA' : 'NOTIFICACION_CORREO_FALLIDA',
      actorUid:    'sistema',
      actorNombre: 'Sistema',
      nota:        estado === 'ENVIADA'
        ? `Correo de respuesta oficial enviado a ${destinatario}`
        : `Falló el correo de respuesta oficial a ${destinatario}`,
      metadata: {
        tipoNotificacion: 'RESPUESTA_OFICIAL',
        destinatario,
        estado,
        ...(error ? { error } : {}),
      },
    });
  } catch {
    // No propagar — la trazabilidad falla silenciosamente
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verificar sesión de funcionario
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, false);
  } catch {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  // 2. Parsear y validar payload
  let payload: NotificarCiudadanoPayload;
  try {
    payload = await request.json() as NotificarCiudadanoPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const {
    radicadoId,
    emailCiudadano,
    nombreCiudadano,
    asunto,
    nota,
    tenantId,
    fechaRespuesta,
    tieneArchivo,
  } = payload;

  if (!radicadoId || !emailCiudadano || !nombreCiudadano || !nota || !tenantId) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: radicadoId, emailCiudadano, nombreCiudadano, nota, tenantId.' },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(emailCiudadano)) {
    return NextResponse.json(
      { error: 'El email del ciudadano no tiene formato válido.' },
      { status: 400 },
    );
  }

  // 3. Resolver datos de la dependencia
  const dependencia = DIRECTORIO_TENANTS[tenantId];
  if (!dependencia) {
    return NextResponse.json(
      { error: `Dependencia desconocida: ${tenantId}` },
      { status: 400 },
    );
  }

  // 4. Construir y enviar email
  try {
    const html = buildRespuestaCiudadanoHtml({
      radicadoId,
      ciudadanoNombre:   nombreCiudadano,
      asunto:            asunto || 'Sin asunto',
      nota,
      dependenciaNombre: dependencia.nombreOficial,
      dependenciaEmail:  dependencia.emailOficial,
      fechaRespuesta:    fechaRespuesta || new Date().toISOString(),
      tieneArchivo,
    });

    await enviarEmail({
      to:      emailCiudadano,
      subject: buildRespuestaCiudadanoSubject(radicadoId),
      html,
      replyTo: dependencia.emailOficial,
    });

    // Registrar trazabilidad de notificación exitosa
    await registrarTrazabilidadNotificacion({
      radicadoId,
      destinatario: emailCiudadano,
      estado:       'ENVIADA',
    });

    return NextResponse.json({ enviado: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError({ radicadoId, modulo: 'notificar-ciudadano', error: err });

    // Registrar trazabilidad de fallo
    await registrarTrazabilidadNotificacion({
      radicadoId,
      destinatario: emailCiudadano,
      estado:       'FALLIDA',
      error:        msg,
    });

    // No exponemos detalles del SMTP al cliente
    return NextResponse.json(
      { error: 'No se pudo enviar la notificación por email.' },
      { status: 500 },
    );
  }
}

