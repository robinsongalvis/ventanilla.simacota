/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/[id]/prorroga-subsanacion

   Registra la PRÓRROGA del plazo de subsanación — D.1077/2015 art.
   2.2.6.1.2.2.4: «Este plazo podrá ser ampliado, a solicitud de parte, hasta
   por un término adicional de quince (15) días hábiles».

   Body: { solicitadaEl: ISO, medio: string, referencia?: string }.

   LA FECHA QUE MANDA ES LA DE LA SOLICITUD DEL CIUDADANO, no la de este
   registro: la norma condiciona la ampliación a que ÉL la pidiera dentro del
   plazo, y entre su escrito y el momento en que la funcionaria lo captura
   pueden pasar días. Toda la validación vive en `planRegistrarProrrogaSubsanacion`
   (puro, probado sin Firestore); esta ruta autentica, lee, aplica y escribe.

   NO MUEVE EL ESTADO JURÍDICO: el expediente sigue `CON_ACTA_DE_OBSERVACIONES`.
   Tampoco toca el término de 45 días hábiles de la Administración — eso es otro
   reloj y sigue ⚖️ bloqueado (hueco 1, ADR-0029).
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
  esErrorExpediente,
  planRegistrarProrrogaSubsanacion,
  type ActuacionLicenciaDoc,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  try {
    const usuario = await requireActiveInternalUser();

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const snap = await expedienteRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = snap.data() as ExpedienteLicenciaDoc;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite registrar prórrogas en este expediente.' }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      solicitadaEl?: string; medio?: string; referencia?: string;
    };

    const actuacionesSnap = await expedienteRef.collection('actuaciones').orderBy('fecha', 'asc').get();
    const actuaciones = actuacionesSnap.docs.map((d) => d.data() as ActuacionLicenciaDoc);

    const ahora = new Date();
    const plan = planRegistrarProrrogaSubsanacion(
      { id, tenantId: expediente.tenantId, estadoJuridico: expediente.estadoJuridico },
      actuaciones,
      { solicitadaEl: body.solicitadaEl ?? '', medio: body.medio ?? '', referencia: body.referencia },
      { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol },
      ahora,
    );
    if (esErrorExpediente(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    /* `create` y no `set`: si el id ya existiera, la escritura falla en vez de
       pisar un hecho del expediente. Las actuaciones no se reescriben nunca. */
    await expedienteRef.collection('actuaciones').doc(plan.actuacion.id).create(plan.actuacion);
    await expedienteRef.update({ actualizadoEn: ahora.toISOString() });

    return NextResponse.json({ ok: true, actuacion: plan.actuacion }, { status: 201 });
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: id, modulo: 'licencias/expedientes/[id]/prorroga-subsanacion', error });
    return NextResponse.json({ error: 'No fue posible registrar la prórroga.' }, { status: 500 });
  }
}
