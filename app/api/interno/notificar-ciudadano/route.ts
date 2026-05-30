import { NextResponse }       from 'next/server';
import { cookies }             from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { enviarEmail }          from '@/lib/email/mailer';
import {
  buildRespuestaCiudadanoHtml,
  buildRespuestaCiudadanoSubject,
} from '@/lib/email/templates/respuesta-ciudadano';
import { DIRECTORIO_TENANTS }  from '@/src/types/reglas-negocio';
import type { TenantId }       from '@/src/types/radicado';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   POST /api/interno/notificar-ciudadano
   Envía email al ciudadano cuando su radicado es respondido.
   Requiere sesión de funcionario válida.
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

export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verificar sesión de funcionario
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    await getFirebaseAdminAuth().verifySessionCookie(sessionCookie, true);
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

    return NextResponse.json({ enviado: true });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notificar-ciudadano] Error al enviar email:', msg);
    // No exponemos detalles del SMTP al cliente
    return NextResponse.json(
      { error: 'No se pudo enviar la notificación por email.' },
      { status: 500 },
    );
  }
}
