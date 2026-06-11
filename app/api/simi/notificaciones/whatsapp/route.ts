import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { sendCitizenWhatsAppNotification } from '@/lib/simi-juridico/sendCitizenWhatsAppNotification';
import { isValidWhatsAppPhone } from '@/lib/whatsapp/sendWhatsAppMessage';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';
import type { WhatsAppEventType } from '@/src/types/simi-whatsapp';

export const runtime = 'nodejs';

const EVENTOS_VALIDOS = new Set<WhatsAppEventType>([
  'radicado_recibido',
  'requiere_aclaracion',
  'respuesta_enviada',
  'caso_trasladado',
  'caso_cerrado',
]);
const ROLES_AUTORIZADOS = new Set<RolInterno>(['ADMIN', 'RECEPCIONISTA', 'JEFE_DEPENDENCIA', 'FUNCIONARIO']);

async function verificarSesion() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, false);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    if (d.activo === false || d.archivado === true) return null;
    return {
      uid: decoded.uid,
      nombre: d.nombre as string ?? decoded.email ?? 'Usuario interno',
      rol: d.rol as RolInterno,
      tenantId: d.tenantId as TenantId,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!ROLES_AUTORIZADOS.has(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permiso para enviar notificaciones.' }, { status: 403 });
  }

  let body: {
    radicadoId?: string;
    telefono?: string;
    eventType?: WhatsAppEventType;
    consentimiento?: boolean;
    tenantId?: TenantId;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const radicadoId = body.radicadoId?.trim().toUpperCase();
  const telefono = body.telefono?.trim() ?? '';
  if (!radicadoId || !body.eventType || !EVENTOS_VALIDOS.has(body.eventType)) {
    return NextResponse.json({ error: 'Radicado y evento son requeridos.' }, { status: 400 });
  }
  if (!body.consentimiento) {
    return NextResponse.json({ error: 'No hay consentimiento para WhatsApp.' }, { status: 422 });
  }
  if (!isValidWhatsAppPhone(telefono)) {
    return NextResponse.json({ error: 'Número de WhatsApp inválido.' }, { status: 422 });
  }

  const tenantId = body.tenantId ?? usuario.tenantId;
  if (usuario.rol !== 'ADMIN' && tenantId !== usuario.tenantId) {
    return NextResponse.json({ error: 'Sin acceso al tenant solicitado.' }, { status: 403 });
  }

  const result = await sendCitizenWhatsAppNotification({
    radicadoId,
    tenantId,
    to: telefono,
    eventType: body.eventType,
    consentimiento: true,
    actorUid: usuario.uid,
    actorNombre: usuario.nombre,
  });

  return NextResponse.json({
    ok: result.ok,
    provider: result.provider,
    simulated: result.simulated ?? false,
    messageId: result.messageId,
    error: result.error,
  }, { status: result.ok ? 200 : 502 });
}
