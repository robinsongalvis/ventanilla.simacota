/**
 * PATCH /api/simi/respuestas/firma/[id]
 * Actualizar estado: enviado_ciudadano | notificado | cerrado
 *
 * Al marcar enviado_ciudadano, opcionalmente envía email al ciudadano.
 */

import { NextResponse }              from 'next/server';
import { cookies }                   from 'next/headers';
import { SESSION_COOKIE_NAME }       from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { updateFirmaEstado }         from '@/lib/simi-juridico/createFinalSignature';
import { notificarCiudadanoRespuesta } from '@/lib/simi-juridico/createCitizenNotification';
import type { RolInterno }           from '@/lib/hooks/useAuth';
import type { TenantId }             from '@/src/types/radicado';
import type { RespuestaFirma, EstadoFirma } from '@/src/types/simi-firma';
import { NOMBRES_TENANT }            from '@/src/types/reglas-negocio';

export const runtime = 'nodejs';

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
    return { uid: decoded.uid, rol: d.rol as RolInterno, tenantId: d.tenantId as TenantId };
  } catch { return null; }
}

const ESTADOS_VALIDOS = new Set<EstadoFirma>(['enviado_ciudadano', 'notificado', 'cerrado']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const PUEDE_ACTUALIZAR = new Set<RolInterno>(['ADMIN', 'JEFE_DEPENDENCIA']);
  if (!PUEDE_ACTUALIZAR.has(usuario.rol)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 });
  }

  let body: { estado: EstadoFirma; mensajePublico?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }); }

  if (!ESTADOS_VALIDOS.has(body.estado)) {
    return NextResponse.json({ error: `Estado inválido: ${body.estado}` }, { status: 400 });
  }

  // Obtener firma actual
  const firmaSnap = await getFirebaseAdminDb()
    .collection('simi_respuestas_firma').doc(id).get();
  if (!firmaSnap.exists) return NextResponse.json({ error: 'Firma no encontrada.' }, { status: 404 });
  const firma = firmaSnap.data() as RespuestaFirma;

  // Validar tenant
  if (usuario.rol !== 'ADMIN' && firma.tenantId !== usuario.tenantId) {
    return NextResponse.json({ error: 'Sin acceso.' }, { status: 403 });
  }

  await updateFirmaEstado({ firmaId: id, nuevoEstado: body.estado });

  // Si se marca como enviado y hay email ciudadano → notificar
  if (body.estado === 'enviado_ciudadano' && firma.emailCiudadano) {
    try {
      const radicadoSnap = await getFirebaseAdminDb()
        .doc(`ventanilla_radicados/${firma.radicadoId}`).get();
      const radicado = radicadoSnap.data();
      const asunto = radicado?.detalle?.asunto ?? firma.radicadoId;
      const nombreCiudadano = radicado?.esAnonimo ? undefined : radicado?.solicitante?.nombreCompleto;

      void notificarCiudadanoRespuesta({
        emailCiudadano: firma.emailCiudadano,
        nombreCiudadano,
        radicadoId:     firma.radicadoId,
        asunto,
        fechaRespuesta: new Date().toLocaleDateString('es-CO'),
        dependencia:    NOMBRES_TENANT[firma.dependencia as keyof typeof NOMBRES_TENANT] ?? firma.dependencia,
        mensajePublico: body.mensajePublico ??
          'Su solicitud fue revisada y respondida de fondo por la dependencia competente. ' +
          'Puede consultar el detalle en nuestro portal ciudadano.',
        canalConsulta: firma.canalEnvio ?? 'portal',
      });
    } catch { /* silenciar — no bloquear */ }
  }

  return NextResponse.json({
    ok:     true,
    estado: body.estado,
    mensaje: `Respuesta actualizada a: ${body.estado.replace(/_/g, ' ')}`,
  });
}
