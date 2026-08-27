/* ══════════════════════════════════════════════════════════════
   GET /api/licencias/expedientes/{id}/constancia

   El papel que el ciudadano se lleva en la mano, con el número del libro de
   ventanilla que la funcionaria transcribió al radicar.

   SE CONSTRUYE SOLO DESDE LA ACTUACIÓN DE RADICACIÓN, que es append-only. Ni
   el estado actual del expediente ni el reloj de hoy entran en el papel: una
   constancia acredita un hecho de una fecha, así que reimprimirla en noviembre
   debe dar exactamente el mismo documento que se entregó en agosto.

   Por eso NO se materializa un archivo: se deriva, y la derivación es pura. Un
   archivo guardado podría desincronizarse del hecho; una función pura sobre un
   registro inmutable, no. La automaticidad que se pidió está donde importa —
   el papel existe desde el instante de la radicación, porque su fuente existe
   desde ese instante y no puede cambiar.

   SOLO LECTURA. Esta ruta no escribe nada.
══════════════════════════════════════════════════════════════ */
import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { canOperateTenant, InternalAuthError, requireActiveInternalUser } from '@/lib/server/internal-auth';
import {
  idActuacionRadicacion,
  type ActuacionLicenciaDoc,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import { buildConstanciaRadicacionLicenciaHtml } from '@/lib/constancias/constancia-radicacion-licencia';
import { logError } from '@/lib/logger';
import type { TenantId } from '@/src/types/radicado';

export const runtime = 'nodejs';

const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite consultar expedientes de licencias.' }, { status: 403 });
    }

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const [expSnap, actSnap] = await Promise.all([
      expedienteRef.get(),
      expedienteRef.collection('actuaciones').doc(idActuacionRadicacion(id)).get(),
    ]);

    if (!expSnap.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const exp = expSnap.data() as ExpedienteLicenciaDoc;
    if (exp.tenantId !== TENANT_LICENCIAS) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }

    /* SIN ACTUACIÓN NO HAY CONSTANCIA. No se compone un papel «provisional» a
       partir del estado actual: sería certificar un hecho que no consta. */
    if (!actSnap.exists) {
      return NextResponse.json(
        {
          error:
            'Este expediente todavía no está radicado en legal y debida forma, así que no hay constancia que expedir. ' +
            'La constancia se genera en el momento de la radicación.',
        },
        { status: 409 },
      );
    }
    const act = actSnap.data() as ActuacionLicenciaDoc;

    const html = buildConstanciaRadicacionLicenciaHtml({
      numeroRadicado: exp.numeroExpediente?.numero ?? '',
      solicitanteNombre: exp.solicitanteNombre,
      solicitanteDocumento: exp.solicitanteDocumento,
      tipoDocumento: 'CC',
      descripcionTramite: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.nombre.toLowerCase(),
      /* La fecha JURÍDICA es la de la actuación, no la del documento raíz:
         la actuación no se reescribe nunca. */
      desdeCuandoCorreElPlazo: act.fecha,
      venceEl: exp.fechaAlertaConservadora ?? null,
      requisitosVerificados: act.evidenciaRadicacion?.requisitosAplicables ?? 0,
      funcionarioNombre: act.actorNombre,
      /* Expedida el día de la radicación — que es el instante que la base de
         datos selló, no el momento en que alguien la vuelve a abrir. */
      expedidaEn: act.fecha,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // No se cachea: es un documento con efectos, y su fuente puede
        // corregirse por acto motivado.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: id, modulo: 'licencias/constancia', error });
    return NextResponse.json({ error: 'No fue posible expedir la constancia.' }, { status: 500 });
  }
}
