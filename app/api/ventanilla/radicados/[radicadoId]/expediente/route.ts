/**
 * GET /api/ventanilla/radicados/[radicadoId]/expediente
 *
 * La proyección REDUCIDA del expediente de licencias vinculado a un radicado,
 * para que la funcionaria de ventanilla responda las cuatro preguntas del
 * ciudadano sin levantarse (ADR-0034).
 *
 * SOLO LECTURA POR CONSTRUCCIÓN, no por convención: este archivo no exporta
 * ningún método de escritura. No hay POST, PUT, PATCH ni DELETE que alguien
 * pueda descubrir. Ventanilla informa; Planeación decide.
 *
 * POR QUÉ UNA RUTA DE SERVIDOR Y NO LECTURA DIRECTA: `expedientes` está cerrada
 * a TODO cliente en `firestore.rules` —lo demuestran los nueve casos del grupo
 * `expedientes` en `e2e/rules/matriz-aislamiento-tenant.test.mjs`, añadidos en
 * este mismo PR porque el ADR lo exige—. Si el SDK pudiera leerla, el recorte
 * de esta proyección sería decorativo: bastaría abrir la consola para ver las
 * actuaciones, los documentos y las actas que el ADR-0034 deja fuera.
 *
 * SE ENTRA POR EL RADICADO, no por el expediente. La funcionaria de ventanilla
 * conoce el número de radicado —es el suyo—; el id del expediente no lo ve
 * nunca. Además así el vínculo es la llave: sin `vinculoExpediente` no hay nada
 * que mostrar, y no hay forma de pasear por expedientes ajenos probando ids.
 */
import { NextResponse } from 'next/server';
import type { TenantId } from '@/src/types/radicado';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { proyectarParaVentanilla } from '@/lib/server/proyeccion-ventanilla';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ radicadoId: string }> },
): Promise<NextResponse> {
  try {
    const sesion = await requireActiveInternalUser();
    const { radicadoId } = await params;

    const db = getFirebaseAdminDb();
    const radSnap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
    if (!radSnap.exists) {
      return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
    }
    const radicado = radSnap.data() as {
      clasificacion?: { oficinaDestino?: TenantId };
      vinculoExpediente?: { expedienteId: string } | null;
    };

    /* Primero el permiso sobre el RADICADO. Quien no puede ver el radicado
       tampoco puede enterarse de si tiene expediente: un 404 distinto según el
       vínculo filtraría su existencia. */
    const tenantRadicado = radicado.clasificacion?.oficinaDestino;
    if (!tenantRadicado || !canOperateTenant(sesion, tenantRadicado)) {
      return NextResponse.json(
        { error: 'No tiene permiso para consultar este radicado.' },
        { status: 403 },
      );
    }

    if (!radicado.vinculoExpediente?.expedienteId) {
      /* SIN VÍNCULO NO ES UN ERROR: la inmensa mayoría de los radicados no son
         licencias. Se dice que no hay expediente, no que algo falló. */
      return NextResponse.json({ tieneExpediente: false }, { status: 200 });
    }

    const expSnap = await db.doc(`expedientes/${radicado.vinculoExpediente.expedienteId}`).get();
    if (!expSnap.exists) {
      /* El vínculo apunta a un expediente que no está. Es una incoherencia de
         datos y se dice como tal — no se devuelve «no tiene expediente», que
         sería afirmar algo falso sobre el trámite del ciudadano. */
      logError({
        radicadoId,
        modulo: 'api/ventanilla/expediente',
        error: new Error(`vinculoExpediente apunta a ${radicado.vinculoExpediente.expedienteId}, que no existe`),
      });
      return NextResponse.json(
        {
          error:
            'El radicado figura vinculado a un expediente que no se encuentra. ' +
            'Avise a Planeación con el número de radicado.',
        },
        { status: 409 },
      );
    }

    const expediente = expSnap.data() as ExpedienteLicenciaDoc;

    /* Segundo permiso, sobre el EXPEDIENTE. `canOperateTenant` admite
       RECEPCIONISTA sobre cualquier dependencia (ADR-0034 §5) —ese es el
       permiso que hace posible esta pantalla— pero un funcionario de otra
       dependencia sigue sin poder verlo. */
    if (!canOperateTenant(sesion, expediente.tenantId as TenantId)) {
      return NextResponse.json(
        { error: 'No tiene permiso para consultar este expediente.' },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { tieneExpediente: true, proyeccion: proyectarParaVentanilla(expediente) },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: '', modulo: 'api/ventanilla/expediente', error });
    return NextResponse.json(
      { error: 'No fue posible consultar el estado del trámite.' },
      { status: 500 },
    );
  }
}
