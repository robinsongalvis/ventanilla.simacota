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
} from '@/lib/server/radicados-security';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible devolver el radicado.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const body = await request.json().catch(() => null) as { motivo?: string } | null;
    const motivo = body?.motivo?.trim() ?? '';

    if (motivo.length < 10) {
      return NextResponse.json({ error: 'El motivo debe tener al menos 10 caracteres.' }, { status: 400 });
    }

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite devolver este radicado.' }, { status: 403 });
    }

    const ahora = new Date().toISOString();
    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update({
      estadoActual: 'DEVUELTO',
      ultimaActualizacion: ahora,
    });
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora,
      accion: 'DEVOLUCION',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: motivo,
      metadata: {
        actorRol: usuario.rol,
        dependencia: radicado.clasificacion.oficinaDestino,
      },
    });

    return NextResponse.json({ ok: true, estadoActual: 'DEVUELTO', ultimaActualizacion: ahora });
  } catch (error) {
    console.error('[radicados/devolver]', error);
    return jsonError(error);
  }
}
