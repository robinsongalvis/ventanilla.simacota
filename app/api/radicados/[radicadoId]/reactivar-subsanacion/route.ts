/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/[radicadoId]/reactivar-subsanacion   (BM-B33)

   El funcionario del tenant declara la subsanación SUFICIENTE y reactiva
   el término, que se reanuda por los días hábiles restantes desde el día
   siguiente (Ley 1755 Art. 17). Subsanación parcial NO reactiva.
   Permiso: funcionario del tenant (separado de `completar-datos`).
══════════════════════════════════════════════════════════════ */

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
import { planReactivarSubsanacion, esError } from '@/lib/server/subsanacion';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible reactivar el término.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const body = await request.json().catch(() => null) as { suficiente?: boolean } | null;
    const suficiente = body?.suficiente === true;

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite reactivar este radicado.' }, { status: 403 });
    }

    const ahora = new Date();
    const plan = planReactivarSubsanacion(radicado, usuario, ahora, suficiente);
    if (esError(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update(plan.update);
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora.toISOString(),
      accion: plan.evento.accion,
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: plan.evento.nota,
      metadata: { ...plan.evento.metadata, dependencia: radicado.clasificacion.oficinaDestino },
    });

    return NextResponse.json({ ok: true, estadoActual: plan.nuevoEstado });
  } catch (error) {
    const { radicadoId } = await context.params.catch(() => ({ radicadoId: 'desconocido' }));
    logError({ radicadoId, modulo: 'radicados/reactivar-subsanacion', error });
    return jsonError(error);
  }
}
