/* ══════════════════════════════════════════════════════════════
   GET /api/licencias/radicados-candidatos   (D2, Bloque A·A4)

   Radicados del tenant de Planeación SIN `vinculoExpediente` y no
   cerrados — insumo del selector de "crear expediente desde radicado"
   (`POST .../expedientes/desde-radicado`). Campos mínimos, no el
   documento completo.

   Query por `oficinaDestino` (mismo patrón ya usado en
   `app/api/interno/resumen-diario/route.ts` y otras rutas — no existe hoy
   una función compartida extraíble sin refactor, se nota como oportunidad
   de DRY para cuando se toque ese archivo). El resto (vínculo/cerrado) se
   filtra EN EL HANDLER: N pequeño (radicados de una sola dependencia,
   no toda `ventanilla_radicados`), sin necesitar un índice compuesto nuevo.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { esEstadoCerrado } from '@/lib/radicado-estados';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible consultar los radicados candidatos.' }, { status: 500 });
}

export interface RadicadoCandidato {
  radicadoId: string;
  tipoSolicitud: string;
  solicitanteNombre: string;
  fechaRadicado: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite consultar radicados de Planeación.' }, { status: 403 });
    }

    const db = getFirebaseAdminDb();
    const snap = await db.collection('ventanilla_radicados')
      .where('clasificacion.oficinaDestino', '==', TENANT_LICENCIAS)
      .get();

    const candidatos: RadicadoCandidato[] = [];
    for (const doc of snap.docs) {
      const radicado = doc.data() as VentanillaRadicado;
      if (radicado.vinculoExpediente) continue;
      if (esEstadoCerrado(radicado.estadoActual)) continue;
      candidatos.push({
        radicadoId: radicado.radicadoId,
        tipoSolicitud: radicado.termino?.tipoSolicitudNombre ?? radicado.termino?.tipoSolicitudId ?? '',
        solicitanteNombre: radicado.solicitante?.nombreCompleto ?? '',
        fechaRadicado: radicado.control?.fechaRadicado ?? '',
      });
    }
    candidatos.sort((a, b) => b.fechaRadicado.localeCompare(a.fechaRadicado));

    return NextResponse.json({ ok: true, radicados: candidatos });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/radicados-candidatos/GET', error });
    return jsonError(error);
  }
}
