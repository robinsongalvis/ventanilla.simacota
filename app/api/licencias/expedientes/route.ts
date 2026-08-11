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

/**
 * Cota dura de lectura (R11, ADR-0011 — endurecimiento pre-reunión, hallazgo
 * QA ago-2026): la bandeja es INTERACTIVA y no puede crecer con el
 * histórico del tenant. 300 ≤ el presupuesto interactivo (500). Mismo
 * patrón que `LIMITE_CANDIDATOS` en `app/api/licencias/radicados-candidatos/route.ts`
 * (fix R11 anterior, Bloque A·A4): sin `orderBy` en Firestore (evita exigir
 * el índice compuesto aún no desplegado, ver comentario del `GET` más abajo),
 * el orden lo aplica el handler en memoria sobre el lote acotado — con más
 * de LIMITE_BANDEJA expedientes del tenant, la bandeja muestra un
 * subconjunto (los más recientes dentro del lote leído, no necesariamente
 * los LIMITE_BANDEJA más recientes globales — deuda aceptada hasta que
 * exista paginación real).
 */
const LIMITE_BANDEJA = 300;

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
    const snap = await db.collection('expedientes')
      .where('tenantId', '==', TENANT_LICENCIAS)
      .limit(LIMITE_BANDEJA)
      .get();
    const expedientes = snap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.creadoEn ?? '').localeCompare(String(a.creadoEn ?? '')));

    // RESUELTO (Bloque "Términos y vigencias protectores", 10-ago-2026):
    // la bandeja SÍ trae `fechaAlertaConservadora` por expediente, sin
    // ninguna lectura nueva — viene incluida en `expedientes` porque cada
    // `d.data()` ya trae el documento raíz completo. El valor NO se calcula
    // aquí (eso seguiría siendo N+1, el antipatrón que R11 vigila): es un
    // ESPEJO denormalizado que `lib/server/expedientes-licencias.ts`
    // recalcula y persiste en el documento raíz, en el MISMO batch/tx que
    // cada escritura que puede moverlo (creación del expediente,
    // `POST .../[id]/actuaciones`) — ver el JSDoc de
    // `ExpedienteLicenciaDoc.fechaAlertaConservadora` para el contrato
    // completo (incluye por qué puede ser `undefined` en expedientes
    // anteriores a este campo, o `null` en expedientes reconstruidos, R9).
    // El detalle (`GET .../[id]`) sigue calculándolo on-read además —
    // ambos caminos comparten el mismo cómputo puro, no pueden divergir.
    return NextResponse.json({ ok: true, expedientes });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/GET', error });
    return jsonError(error);
  }
}
