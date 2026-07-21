import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { sendCitizenWhatsAppNotification } from '@/lib/simi-juridico/sendCitizenWhatsAppNotification';
import { isValidWhatsAppPhone, normalizePhone } from '@/lib/whatsapp/sendWhatsAppMessage';
import { getRadicadoOrFail, RadicadoActionError } from '@/lib/server/radicados-security';
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
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
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

function jsonError(error: unknown) {
  if (error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible enviar la notificación de WhatsApp.' }, { status: 500 });
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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const radicadoId = body.radicadoId?.trim().toUpperCase();
  const telefonoSolicitado = body.telefono?.trim() ?? '';
  if (!radicadoId || !body.eventType || !EVENTOS_VALIDOS.has(body.eventType)) {
    return NextResponse.json({ error: 'Radicado y evento son requeridos.' }, { status: 400 });
  }
  if (!body.consentimiento) {
    return NextResponse.json({ error: 'No hay consentimiento para WhatsApp.' }, { status: 422 });
  }
  if (!isValidWhatsAppPhone(telefonoSolicitado)) {
    return NextResponse.json({ error: 'Número de WhatsApp inválido.' }, { status: 422 });
  }

  /*
   * H-M3 (auditoría de seguridad) — hasta aquí, `radicadoId` y `telefono`
   * eran datos auto-declarados del body: nunca se cargaba el radicado real
   * ni se comparaba contra su solicitante. Un funcionario autenticado podía
   * notificar CUALQUIER radicado (de cualquier tenant) a un número
   * arbitrario que él controlara → fuga/suplantación de PII.
   *
   * A partir de aquí, el radicado y el teléfono de destino se derivan
   * SIEMPRE del documento en Firestore (fuente de verdad), nunca del body.
   */
  let radicado;
  try {
    radicado = await getRadicadoOrFail(radicadoId);
  } catch (error) {
    return jsonError(error);
  }

  const tenantRadicado = radicado.clasificacion.oficinaDestino;
  if (usuario.rol !== 'ADMIN' && tenantRadicado !== usuario.tenantId) {
    return NextResponse.json({ error: 'Sin acceso al tenant de este radicado.' }, { status: 403 });
  }

  /*
   * Teléfono REGISTRADO del solicitante: `telefonoMovil` es la fuente de
   * verdad para WhatsApp (canal exclusivamente móvil). El legado
   * `telefono` cubre radicados anteriores al split móvil/fijo — ver JSDoc
   * de `SolicitanteRadicado` en src/types/ventanilla.ts. `telefonoFijo` NO
   * se acepta: una línea fija no puede recibir WhatsApp.
   */
  const telefonoRegistrado = radicado.solicitante.telefonoMovil ?? radicado.solicitante.telefono ?? null;
  if (!telefonoRegistrado || !isValidWhatsAppPhone(telefonoRegistrado)) {
    return NextResponse.json(
      { error: 'El radicado no tiene un teléfono móvil válido registrado del solicitante; no es posible enviar WhatsApp.' },
      { status: 422 },
    );
  }
  if (normalizePhone(telefonoSolicitado) !== normalizePhone(telefonoRegistrado)) {
    return NextResponse.json(
      { error: 'El número indicado no coincide con el teléfono registrado del solicitante de este radicado.' },
      { status: 403 },
    );
  }

  /*
   * NOTA (consentimiento): `SolicitanteRadicado` (src/types/ventanilla.ts)
   * todavía no persiste un flag explícito de autorización de notificación
   * electrónica capturado al radicar; `body.consentimiento` sigue siendo la
   * única señal disponible y queda auto-declarada por el funcionario en
   * cada envío. Deuda declarada para el especialista de datos: agregar un
   * campo persistido (p. ej. `solicitante.consentimientoWhatsApp`) capturado
   * en el momento de la radicación en vez de un booleano por solicitud.
   */
  const result = await sendCitizenWhatsAppNotification({
    radicadoId,
    tenantId: tenantRadicado,
    to: telefonoRegistrado,
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
