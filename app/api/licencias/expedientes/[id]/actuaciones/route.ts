/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/[id]/actuaciones

   Registra un HECHO ('acta-observaciones' | 'respuesta-subsanacion') sobre
   un expediente de licencias y transiciona su `estadoJuridico` según el
   mapa de `lib/motor-expedientes/estados-licencia.ts`. El EFECTO sobre el
   término sigue ⚖️ dual/bloqueado (`lib/motor-expedientes/termino.ts`,
   hueco 1 ADR-0029) — esta ruta NO calcula ni persiste ningún vencimiento.

   Bloque "Integración UI y demo".
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import {
  planRegistrarActuacion,
  esErrorExpediente,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible registrar la actuación.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { id } = await context.params;

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const doc = await expedienteRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = doc.data() as ExpedienteLicenciaDoc;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite registrar actuaciones en este expediente.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as { tipo?: string; detalle?: string } | null;

    // Solo se necesita el `tipo` de cada actuación existente para el guard
    // de acta única — no se traen los documentos completos.
    const actuacionesSnap = await expedienteRef.collection('actuaciones').get();
    const actuacionesExistentes = actuacionesSnap.docs.map((d) => ({ tipo: String(d.data().tipo ?? '') }));

    const ahora = new Date();
    const plan = planRegistrarActuacion(
      expediente.estadoJuridico,
      actuacionesExistentes,
      id,
      expediente.tenantId,
      { tipo: body?.tipo ?? '', detalle: body?.detalle ?? '' },
      { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol },
      ahora,
    );
    if (esErrorExpediente(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    const batch = db.batch();
    batch.set(expedienteRef.collection('actuaciones').doc(plan.actuacion.id), plan.actuacion);
    batch.update(expedienteRef, {
      estadoJuridico: plan.nuevoEstadoJuridico,
      actualizadoEn: ahora.toISOString(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true, actuacion: plan.actuacion, estadoJuridico: plan.nuevoEstadoJuridico });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/[id]/actuaciones/POST', error });
    return jsonError(error);
  }
}
