import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { RadicadoActionError } from '@/lib/server/radicados-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { aplicarEntregas } from '@/lib/planillas/entregas';
import { uploadEscaneoPlanillaAdmin } from '@/lib/server/planillas-security';
import type { EntregaSolicitada, PlanillaReparto } from '@/src/types/planilla';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Planilla de reparto — POST /api/planillas/entregas

   La funcionaria vuelve de la ronda con la hoja firmada: registra
   por fila quién recibió (con nota de lugar si fue fuera del
   palacio), sube el escaneo PDF y opcionalmente cierra el día —
   lo no entregado se LIBERA y rueda a la planilla siguiente.

   Cada fila entregada deja evidencia doble:
   - `entregaFisica` en el radicado (zanja el "eso nunca me llegó"), y
   - evento ENTREGA_FISICA_REGISTRADA en su trazabilidad.

   La operación es todo-o-nada (valida antes de escribir) y solo
   ADMIN/RECEPCIONISTA pueden ejecutarla (parámetro cerrado #3).
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof Error && /planilla|radicado|nombre|duplicada/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(
    { error: 'No fue posible registrar las entregas.' },
    { status: 500 },
  );
}

function parseEntregas(crudo: string): EntregaSolicitada[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(crudo);
  } catch {
    throw new RadicadoActionError('El listado de entregas no es válido.', 400);
  }
  if (!Array.isArray(parsed)) {
    throw new RadicadoActionError('El listado de entregas no es válido.', 400);
  }
  return parsed.map((item) => {
    const e = item as Record<string, unknown>;
    return {
      radicadoId:  typeof e.radicadoId === 'string' ? e.radicadoId : '',
      recibidoPor: typeof e.recibidoPor === 'string' ? e.recibidoPor : '',
      nota:        typeof e.nota === 'string' && e.nota.trim() ? e.nota : null,
    };
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA') {
      return NextResponse.json(
        { error: 'Su rol no puede registrar entregas de reparto.' },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const planillaId = String(formData.get('planillaId') ?? '').trim();
    if (!planillaId) {
      return NextResponse.json({ error: 'Falta la planilla.' }, { status: 400 });
    }
    const cerrar = String(formData.get('cerrar') ?? 'false') === 'true';
    const entregas = parseEntregas(String(formData.get('entregas') ?? '[]'));

    if (entregas.length === 0 && !cerrar) {
      return NextResponse.json(
        { error: 'No hay entregas para registrar.' },
        { status: 400 },
      );
    }

    const db = getFirebaseAdminDb();
    const refPlanilla = db.doc(`ventanilla_planillas/${planillaId}`);
    const snap = await refPlanilla.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'La planilla no existe.' }, { status: 404 });
    }
    const planilla = snap.data() as PlanillaReparto;

    const ahora = new Date();
    const actor = { uid: usuario.uid, nombre: usuario.nombre };
    const resultado = aplicarEntregas(planilla, entregas, { cerrar, ahora, actor });

    // Escaneo firmado (PDF) — opcional; se sube antes de escribir para
    // que la actualización del doc quede completa en una sola pasada.
    const archivo = formData.get('escaneo');
    const escaneo = archivo instanceof File && archivo.size > 0
      ? await uploadEscaneoPlanillaAdmin(archivo, planillaId)
      : null;

    const planillaFinal: PlanillaReparto = {
      ...resultado.planilla,
      escaneoPath:   escaneo?.path ?? planilla.escaneoPath,
      escaneoNombre: escaneo?.nombre ?? planilla.escaneoNombre,
    };

    const batch = db.batch();
    batch.set(
      refPlanilla,
      removeUndefinedDeep(planillaFinal as unknown as Record<string, unknown>),
    );

    for (const fila of resultado.entregadas) {
      const entrega = fila.entrega;
      if (!entrega) continue;

      batch.set(
        db.doc(`ventanilla_radicados/${fila.radicadoId}`),
        {
          entregaFisica: {
            planillaId,
            fecha: entrega.fecha,
            recibidoPor: entrega.recibidoPor,
          },
          ultimaActualizacion: ahora.toISOString(),
        },
        { merge: true },
      );

      batch.set(
        db.collection(`ventanilla_radicados/${fila.radicadoId}/trazabilidad`).doc(),
        removeUndefinedDeep({
          eventoId: `ev_${fila.radicadoId}_ENTREGA_${planilla.consecutivo}`,
          fecha: entrega.fecha,
          accion: 'ENTREGA_FISICA_REGISTRADA',
          actorUid: actor.uid,
          actorNombre: actor.nombre,
          nota: `El documento físico fue entregado a ${entrega.recibidoPor}`
            + `${entrega.nota ? ` (${entrega.nota})` : ''} — planilla ${planillaId}.`,
          metadata: { planillaId, recibidoPor: entrega.recibidoPor },
        } as Record<string, unknown>),
      );
    }

    await batch.commit();

    return NextResponse.json({
      ok: true,
      planilla: planillaFinal,
      entregadas: resultado.entregadas.length,
      liberadas: resultado.liberadas.length,
    });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'planillas/entregas', error });
    return jsonError(error);
  }
}
