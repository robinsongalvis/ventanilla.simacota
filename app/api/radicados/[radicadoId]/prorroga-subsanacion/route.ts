/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/[radicadoId]/prorroga-subsanacion   (BM-B33)

   Concede la prórroga del plazo de subsanación (Ley 1755 Art. 17): hasta
   un término igual (1 mes), una sola vez, solicitada antes de vencer.
   Permiso: funcionario del tenant.
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
import { planProrrogaSubsanacion, esError } from '@/lib/server/subsanacion';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible conceder la prórroga.' }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canOperateTenant(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite conceder prórroga en este radicado.' }, { status: 403 });
    }

    const ahora = new Date();
    const plan = planProrrogaSubsanacion(radicado, usuario, ahora);
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { radicadoId } = await context.params.catch(() => ({ radicadoId: 'desconocido' }));
    logError({ radicadoId, modulo: 'radicados/prorroga-subsanacion', error });
    return jsonError(error);
  }
}
