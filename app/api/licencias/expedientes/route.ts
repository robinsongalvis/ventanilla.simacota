/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes    — crear expediente de licencias (DEMO)
   GET  /api/licencias/expedientes    — bandeja del tenant de Planeación

   Bloque "Integración UI y demo". Camino ÚNICO de creación en esta fase:
   DEMO (`esPrueba: true`, forzado aquí — el body NO puede pedir otra
   cosa). El candado de emisión real (`EMISION_REAL_EXPEDIENTES_HABILITADA`,
   `lib/server/expedientes-licencias.ts`) vive en el módulo de decisión;
   esta ruta JAMÁS importa `emitirNumeroExpedienteReal` — no hay ninguna
   rama de código aquí que pueda alcanzar la serie legal `expedientes` ni
   `unicidad_expedientes` (doctrina R10, pendiente de autorización del
   propietario).

   Permiso: `canOperateTenant` sobre el tenant de Planeación (mismo patrón
   que el resto de rutas internas).
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import type { TenantId } from '@/src/types/radicado';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  planCrearExpedienteDemo,
  esErrorExpediente,
  type CrearExpedienteInput,
} from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

/** Tenant de Planeación — dueño de los expedientes de licencias (catálogo real de dependencias, `src/types/reglas-negocio.ts`). */
const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible procesar la solicitud de expedientes.' }, { status: 500 });
}

interface BodyCrearExpediente {
  solicitanteNombre?: string;
  solicitanteDocumento?: string;
  subtipos?: string[];
  contexto?: CrearExpedienteInput['contexto'];
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite radicar expedientes de licencias.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as BodyCrearExpediente | null;
    const ahora = new Date();

    // Camino DEMO, siempre — el body de esta fase no expone forma de pedir
    // emisión real; el candado vive en `planCrearExpedienteDemo`.
    const plan = planCrearExpedienteDemo(
      {
        solicitanteNombre: body?.solicitanteNombre ?? '',
        solicitanteDocumento: body?.solicitanteDocumento ?? '',
        subtipos: body?.subtipos ?? [],
        contexto: body?.contexto,
      },
      TENANT_LICENCIAS,
      { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol },
      ahora,
    );
    if (esErrorExpediente(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${plan.expediente.id}`);
    const actuacionRef = expedienteRef.collection('actuaciones').doc(plan.primeraActuacion.id);
    const batch = db.batch();
    batch.set(expedienteRef, plan.expediente);
    batch.set(actuacionRef, plan.primeraActuacion);
    await batch.commit();

    return NextResponse.json({ ok: true, expediente: plan.expediente }, { status: 201 });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/POST', error });
    return jsonError(error);
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite consultar expedientes de licencias.' }, { status: 403 });
    }

    const db = getFirebaseAdminDb();
    // SIN orderBy en el query: un `where('tenantId','==',…)` combinado con
    // `orderBy` exige un índice compuesto. `firestore.indexes.json` ya lo
    // declara (firestore-datos), pero desplegarlo es tarea de DevOps
    // (`firebase deploy --only firestore:indexes`) — hasta que corra, la
    // combinación where+orderBy lanzaría FAILED_PRECONDITION en producción.
    // N es pequeño (expedientes de licencias, no toda `ventanilla_radicados`):
    // ordenar en el handler es seguro por ahora.
    const snap = await db.collection('expedientes').where('tenantId', '==', TENANT_LICENCIAS).get();
    const expedientes = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.creadoEn ?? '').localeCompare(String(a.creadoEn ?? '')));

    return NextResponse.json({ ok: true, expedientes });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/GET', error });
    return jsonError(error);
  }
}
