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
  return NextResponse.json({ error: 'No fue posible aplicar la prórroga.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const body = await request.json().catch(() => null) as { motivo?: string; diasProrroga?: number } | null;
    const motivo = body?.motivo?.trim() ?? '';
    const diasProrroga = Number(body?.diasProrroga ?? 0);

    if (motivo.length < 5) {
      return NextResponse.json({ error: 'Ingresa el motivo de la prórroga.' }, { status: 400 });
    }

    if (!Number.isInteger(diasProrroga) || diasProrroga < 1 || diasProrroga > 30) {
      return NextResponse.json({ error: 'Los días de prórroga deben estar entre 1 y 30.' }, { status: 400 });
    }

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite prorrogar este radicado.' }, { status: 403 });
    }

    const ahora = new Date().toISOString();
    const fechaActual = new Date(radicado.termino.fechaVencimiento);
    const nuevaFecha = new Date(fechaActual);
    nuevaFecha.setDate(nuevaFecha.getDate() + diasProrroga);

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update({
      'termino.fechaVencimiento': nuevaFecha.toISOString(),
      'termino.prorrogasAplicadas': (radicado.termino.prorrogasAplicadas ?? 0) + 1,
      estadoActual: 'PRORROGA',
      ultimaActualizacion: ahora,
    });
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora,
      accion: 'PRORROGA',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: motivo,
      metadata: {
        actorRol: usuario.rol,
        diasProrroga,
        fechaVencimientoAnterior: radicado.termino.fechaVencimiento,
        fechaVencimientoNueva: nuevaFecha.toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      estadoActual: 'PRORROGA',
      fechaVencimiento: nuevaFecha.toISOString(),
      ultimaActualizacion: ahora,
    });
  } catch (error) {
    console.error('[radicados/prorroga]', error);
    return jsonError(error);
  }
}
