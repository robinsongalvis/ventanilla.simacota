/* ══════════════════════════════════════════════════════════════
   GET /api/licencias/expedientes/[id]  — detalle: expediente + actuaciones
   + documentos + definicionId

   Bloque "Integración UI y demo" / Bloque A·A2. Dos `orderBy` de un solo
   campo sobre subcolecciones de UN padre — orden natural, sin índice
   compuesto (ningún `where` combinado con el `orderBy`).

   `documentos`: lista de documentos LÓGICOS con su `versionVigente` (1
   query a `documentos`, NUNCA se toca `versiones` — INV-5 del contrato A1,
   `lib/server/expedientes-documentos-tipos.ts`).

   NO calcula completitud aquí: `evaluarCompletitud` es pura
   (`lib/motor-expedientes/completitud.ts`) y la ejecuta la UI con
   `documentos`/`aportes`/`contexto` + la Definición — mismo patrón que el
   término dual (`lib/motor-expedientes/termino.ts`), que tampoco se
   calcula en el servidor.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { TenantId } from '@/src/types/radicado';
import { SUBCOLECCION_DOCUMENTOS } from '@/lib/server/expedientes-documentos-tipos';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
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

    const documentosSnap = await expedienteRef.collection(SUBCOLECCION_DOCUMENTOS).get();
    const documentos = documentosSnap.docs.map((d) => d.data());

    return NextResponse.json({
      ok: true,
      expediente,
      actuaciones,
      documentos,
      // Placeholder: única Definición sembrada hoy (Bloque A·A2). Cuando
      // exista resolución real por `expediente.tramiteId` (persistencia de
      // Fase 1), este campo se resuelve dinámicamente en vez de fijo.
      definicionId: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id,
    });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/[id]/GET', error });
    return jsonError(error);
  }
}
