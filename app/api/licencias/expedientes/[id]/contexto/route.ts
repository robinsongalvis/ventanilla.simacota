/* ══════════════════════════════════════════════════════════════
   PATCH /api/licencias/expedientes/[id]/contexto

   El funcionario fija los hechos del caso (esApoderado, categoriaComplejidad,
   sujetoTituloENSR10, predioRodeadoEspacioPublico) que `evaluarCondicion`
   necesita para resolver los requisitos CONDICIONALES del checklist
   (`lib/motor-expedientes/completitud.ts`). Sin esto, los condicionales
   quedan INDETERMINADOS. Fail-closed: clave no declarada en la Definición
   → 400 citando el catálogo (`planActualizarContexto`).

   Bloque A·A2.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import {
  planActualizarContexto,
  esErrorExpediente,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';
import { calcularCompletitudExpediente } from '@/lib/server/completitud-expediente';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible actualizar el contexto del expediente.' }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    const usuario = await requireActiveInternalUser();

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const doc = await expedienteRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = doc.data() as ExpedienteLicenciaDoc;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite modificar este expediente.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
    }

    // Placeholder de resolución de Definición (mismo criterio que la ruta
    // de documentos — Fase 1 resolverá por `tramiteId`).
    const plan = planActualizarContexto(expediente.contexto ?? {}, body, DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL);
    if (esErrorExpediente(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    const ahora = new Date();
    /* El contexto DECIDE qué requisitos aplican: cambiarlo puede completar la
       solicitud (un condicional que deja de aplicar) o descompletarla (uno que
       pasa a aplicar). Hasta ahora esta ruta no recalculaba la completitud, así
       que el hecho guardado quedaba contradiciendo al contexto que acababa de
       escribirse — y con él `completoDesde`, que es lo que ancla el término.
       Se recalcula en la MISMA escritura, con la completitud previa para
       conservar el instante si la solicitud ya estaba completa. */
    const completitud = calcularCompletitudExpediente(
      expediente.aportes ?? [],
      plan.contexto,
      ahora,
      expediente.completitud,
    );

    await expedienteRef.update({
      contexto: plan.contexto,
      completitud,
      actualizadoEn: ahora.toISOString(),
    });

    return NextResponse.json({ ok: true, contexto: plan.contexto, completitud });
  } catch (error) {
    logError({ radicadoId: id, modulo: 'licencias/expedientes/[id]/contexto/PATCH', error });
    return jsonError(error);
  }
}
