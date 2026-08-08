/* ══════════════════════════════════════════════════════════════
   GET /api/licencias/expedientes/[id]  — detalle del expediente + actuaciones

   Bloque "Integración UI y demo". Un solo `orderBy('fecha','asc')` sobre la
   subcolección `actuaciones` de UN padre — orden natural, sin índice
   compuesto (no hay `where` combinado con el `orderBy`).
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible consultar el expediente.' }, { status: 500 });
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { id } = await context.params;

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const doc = await expedienteRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = doc.data() as Record<string, unknown>;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite consultar este expediente.' }, { status: 403 });
    }

    const actuacionesSnap = await expedienteRef.collection('actuaciones').orderBy('fecha', 'asc').get();
    const actuaciones = actuacionesSnap.docs.map((d) => d.data());

    return NextResponse.json({ ok: true, expediente, actuaciones });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/[id]/GET', error });
    return jsonError(error);
  }
}
