/**
 * GET /api/licencias/vigilancia-termino
 *
 * Sirve al tablero el ÚLTIMO veredicto del vigía del término, tal como el cron
 * lo dejó escrito. NO recalcula nada: si recalculara, el tablero y el correo
 * podrían decir cosas distintas del mismo día, y entonces habría dos verdades.
 *
 * POR QUÉ UNA RUTA Y NO LECTURA DIRECTA DEL SDK: la memoria del vigía es un
 * derivado de `expedientes`, que está cerrada a todo cliente
 * (`firestore.rules`). Abrir la derivada al SDK sería un canal lateral
 * alrededor de ese cierre — la misma doctrina del ADR-0034, donde ventanilla ve
 * una proyección de servidor y no la colección.
 *
 * Permiso: `canOperateTenant` sobre Planeación, mismo patrón que el resto de
 * rutas de licencias.
 */
import { NextResponse } from 'next/server';
import type { TenantId } from '@/src/types/radicado';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { ResumenCorrida } from '@/lib/server/vigilancia-termino';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';
const COLECCION_CORRIDAS = 'vigilancia_termino_corridas';

export async function GET(): Promise<NextResponse> {
  try {
    const sesion = await requireActiveInternalUser();
    if (!canOperateTenant(sesion, TENANT_LICENCIAS)) {
      return NextResponse.json(
        { error: 'No tiene permiso para consultar la vigilancia del término de licencias.' },
        { status: 403 },
      );
    }

    const db = getFirebaseAdminDb();
    /* Los documentos se identifican por día (`AAAA-MM-DD`), así que el orden
       descendente por id es el orden cronológico. Sin índice compuesto. */
    const snap = await db
      .collection(COLECCION_CORRIDAS)
      .orderBy('__name__', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      /* NUNCA HA CORRIDO no es lo mismo que NO HAY NADA VIGILADO, y el tablero
         tiene que poder decir cuál de las dos. Un panel que pinta «0 vencidos»
         cuando en realidad el vigía jamás se ejecutó es el fallo PT-2 otra vez,
         en pantalla en vez de en correo. */
      return NextResponse.json({ ultimaCorrida: null, nuncaHaCorrido: true }, { status: 200 });
    }

    const ultimaCorrida = snap.docs[0].data() as ResumenCorrida;
    return NextResponse.json({ ultimaCorrida, nuncaHaCorrido: false }, { status: 200 });
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: '', modulo: 'api/licencias/vigilancia-termino', error });
    return NextResponse.json(
      { error: 'No fue posible consultar la vigilancia del término.' },
      { status: 500 },
    );
  }
}
