/**
 * PATCH /api/simi/juridico/aprobacion/[id]
 * Gestionar flujo de aprobación humana.
 *
 * Acciones: aprobar | devolver | escalar_juridica | marcar_listo_para_envio
 * Requiere sesión de funcionario con rol autorizado.
 */

import { NextResponse }          from 'next/server';
import { cookies }               from 'next/headers';
import { SESSION_COOKIE_NAME }   from '@/lib/auth-cookie';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { updateApprovalFlow }    from '@/lib/simi-juridico/createApprovalFlow';
import { notificarCambioAprobacion } from '@/lib/simi-juridico/createNotification';
import type { ApprovalStatus }   from '@/src/types/simi-approval';
import type { ApprovalFlow }     from '@/src/types/simi-approval';
import type { RolInterno }       from '@/lib/hooks/useAuth';
import type { TenantId }         from '@/src/types/radicado';

export const runtime = 'nodejs';

type Accion = 'aprobar' | 'devolver' | 'escalar_juridica' | 'marcar_listo_para_envio';

const ESTADO_POR_ACCION: Record<Accion, ApprovalStatus> = {
  aprobar:                 'aprobado_por_jefe',
  devolver:                'devuelto_para_ajustes',
  escalar_juridica:        'pendiente_revision_juridica',
  marcar_listo_para_envio: 'listo_para_envio',
};

/** Roles que pueden aprobar borradores */
const PUEDE_APROBAR = new Set<RolInterno>(['ADMIN', 'JEFE_DEPENDENCIA']);

async function verificarSesion() {
  const cookieStore = await cookies();
  const sc = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sc) return null;
  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(sc, true);
    const snap = await getFirebaseAdminDb().doc(`users/${decoded.uid}`).get();
    if (!snap.exists) return null;
    const d = snap.data()!;
    return { uid: decoded.uid, nombre: d.nombre as string ?? '', rol: d.rol as RolInterno, tenantId: d.tenantId as TenantId };
  } catch { return null; }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const usuario = await verificarSesion();
  if (!usuario) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!PUEDE_APROBAR.has(usuario.rol)) {
    return NextResponse.json({ error: 'Su rol no tiene permiso para gestionar aprobaciones.' }, { status: 403 });
  }

  let body: { accion: Accion; observacion?: string };
  try {
    body = await request.json() as { accion: Accion; observacion?: string };
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const { accion, observacion } = body;
  if (!ESTADO_POR_ACCION[accion]) {
    return NextResponse.json({ error: `Acción inválida: ${accion}` }, { status: 400 });
  }

  // Obtener flujo actual
  const db = getFirebaseAdminDb();
  const docRef = db.collection('simi_aprobaciones_respuesta').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return NextResponse.json({ error: 'Flujo de aprobación no encontrado.' }, { status: 404 });

  const flujo = snap.data() as ApprovalFlow;

  // Validar que el usuario pertenece al tenant del flujo
  if (usuario.rol !== 'ADMIN' && flujo.tenantId !== usuario.tenantId) {
    return NextResponse.json({ error: 'Sin acceso a este flujo de aprobación.' }, { status: 403 });
  }

  // Determinar nuevo estado (ADMIN puede aprobar como jurídica)
  let nuevoEstado = ESTADO_POR_ACCION[accion];
  if (accion === 'aprobar' && usuario.rol === 'ADMIN') {
    nuevoEstado = 'aprobado_por_juridica';
  }

  // Actualizar
  await updateApprovalFlow({
    approvalId:    id,
    nuevoEstado,
    usuarioId:     usuario.uid,
    usuarioNombre: usuario.nombre,
    rol:           usuario.rol,
    observacion,
  });

  // Notificar si el estado genera nueva revisión
  if (nuevoEstado === 'pendiente_revision_juridica' || nuevoEstado === 'devuelto_para_ajustes') {
    void notificarCambioAprobacion({
      approvalId:   id,
      radicadoId:   flujo.radicadoId,
      tenantId:     flujo.tenantId,
      estado:       nuevoEstado,
      creadoPor:    usuario.uid,
      radicadoDesc: `Radicado ${flujo.radicadoId}`,
    });
  }

  return NextResponse.json({
    ok:     true,
    estado: nuevoEstado,
    accion,
    mensaje: `Flujo actualizado a: ${nuevoEstado.replace(/_/g, ' ')}`,
  });
}
