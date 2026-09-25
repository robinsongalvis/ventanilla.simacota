import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { RadicadoActionError } from '@/lib/server/radicados-security';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import { anularPlanilla } from '@/lib/planillas/entregas';
import type { PlanillaReparto } from '@/src/types/planilla';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Planilla de reparto — POST /api/planillas/anular

   Solo mientras esté POR_ENTREGAR y sin ninguna entrega registrada
   (una firma en el papel es evidencia y no se borra — patrón GSC).
   Las filas quedan LIBERADAS y vuelven al grupo de pendientes.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'RECEPCIONISTA') {
      return NextResponse.json(
        { error: 'Su rol no puede anular planillas.' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const planillaId = typeof body.planillaId === 'string' ? body.planillaId.trim() : '';
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : '';
    if (!planillaId) {
      return NextResponse.json({ error: 'Falta la planilla.' }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const ref = db.doc(`ventanilla_planillas/${planillaId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'La planilla no existe.' }, { status: 404 });
    }

    const anulada = anularPlanilla(
      snap.data() as PlanillaReparto,
      motivo,
      new Date(),
      { uid: usuario.uid, nombre: usuario.nombre },
    );

    await ref.set(removeUndefinedDeep(anulada as unknown as Record<string, unknown>));

    return NextResponse.json({ ok: true, planilla: anulada });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'planillas/anular', error });
    if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && /anular|motivo/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'No fue posible anular la planilla.' },
      { status: 500 },
    );
  }
}
