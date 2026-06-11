import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import {
  canAssignRadicado,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  assertNotClosed,
  buildResponsableMetadata,
  buildResponsableSnapshot,
  getRadicadoOrFail,
  nombreTenant,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import type { ResponsableFuncionario } from '@/lib/actions/asignarRadicado';
import type { TenantId } from '@/src/types/radicado';
import { DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

interface Payload {
  tenantDestino?: TenantId;
  responsable?: ResponsableFuncionario | null;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible asignar el radicado.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { radicadoId } = await context.params;
    const payload = await request.json().catch(() => null) as Payload | null;
    const tenantDestino = payload?.tenantDestino;

    if (!tenantDestino || !DIRECTORIO_TENANTS[tenantDestino]) {
      return NextResponse.json({ error: 'Dependencia destino inválida.' }, { status: 400 });
    }

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    if (!canAssignRadicado(usuario, radicado.clasificacion.oficinaDestino)) {
      return NextResponse.json({ error: 'Tu rol no permite asignar este radicado.' }, { status: 403 });
    }

    const ahora = new Date().toISOString();
    const responsable = payload.responsable ?? null;
    const update = removeUndefinedDeep({
      'clasificacion.oficinaDestino': tenantDestino,
      ...buildResponsableSnapshot(responsable),
      estadoActual: 'ASIGNADO',
      ultimaActualizacion: ahora,
      ...(radicado.analisisIa && radicado.analisisIa.dependenciaSugerida !== tenantDestino ? {
        feedbackIa: {
          usuarioId: usuario.uid,
          actorNombre: usuario.nombre,
          puntuacion: 'CORREGIDO',
          motivoCorreccion: `Trasladado manualmente a ${nombreTenant(tenantDestino)}.`,
          fecha: ahora,
        },
      } : {}),
    });

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update(update);
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora,
      accion: 'ASIGNACION',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      oficinaOrigen: radicado.clasificacion.oficinaDestino,
      oficinaDestino: tenantDestino,
      nota: `Trasladado a ${nombreTenant(tenantDestino)} por ${usuario.nombre}`,
      metadata: {
        dependenciaOrigen: radicado.clasificacion.oficinaDestino,
        dependenciaDestino: tenantDestino,
        actorRol: usuario.rol,
        ...buildResponsableMetadata(responsable),
      },
    });

    return NextResponse.json({ ok: true, estadoActual: 'ASIGNADO', ultimaActualizacion: ahora });
  } catch (error) {
    console.error('[radicados/asignar]', error);
    return jsonError(error);
  }
}
