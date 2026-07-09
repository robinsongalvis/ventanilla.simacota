import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { RadicadoActionError } from '@/lib/server/radicados-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { construirPlanilla } from '@/lib/planillas/construir-planilla';
import { obtenerPendientesDeReparto } from '@/lib/server/planillas-security';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Planilla de reparto — POST /api/planillas/generar

   Genera LA planilla del día: una sola con todos los radicados
   físicos pendientes de entrega (parámetro cerrado con la
   funcionaria). El consecutivo PL-{año}-{NNNN} nace transaccional
   (counters/planillas-{año}, misma mecánica del 2-SAL) y el doc se
   escribe completo de una vez.

   Solo ADMIN/RECEPCIONISTA: la ronda del papel es de Recepción.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

function jsonError(error: unknown): NextResponse {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: 'No fue posible generar la planilla.' },
    { status: 500 },
  );
}

export async function POST(): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA') {
      return NextResponse.json(
        { error: 'Su rol no puede generar planillas de reparto.' },
        { status: 403 },
      );
    }

    const db = getFirebaseAdminDb();
    const { pendientes } = await obtenerPendientesDeReparto(db);

    if (pendientes.length === 0) {
      return NextResponse.json(
        { error: 'No hay documentos físicos pendientes de entrega.' },
        { status: 409 },
      );
    }

    // Consecutivo anual transaccional (misma mecánica del 2-SAL).
    const ahora = new Date();
    const year = ahora.getFullYear();
    const refCounter = db.doc(`counters/planillas-${year}`);
    const consecutivo = await db.runTransaction(async (tx) => {
      const snap = await tx.get(refCounter);
      const siguiente = Number(snap.data()?.ultimo ?? 0) + 1;
      tx.set(refCounter, {
        ultimo: siguiente,
        anio: year,
        actualizadoEn: ahora.toISOString(),
      }, { merge: true });
      return siguiente;
    });

    const planilla = construirPlanilla(
      pendientes,
      consecutivo,
      { uid: usuario.uid, nombre: usuario.nombre },
      ahora,
    );

    await db.doc(`ventanilla_planillas/${planilla.planillaId}`).set(
      removeUndefinedDeep(planilla as unknown as Record<string, unknown>),
    );

    return NextResponse.json({ ok: true, planilla });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'planillas/generar', error });
    return jsonError(error);
  }
}
