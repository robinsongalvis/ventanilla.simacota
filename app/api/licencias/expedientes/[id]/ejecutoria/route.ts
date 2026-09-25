/**
 * GET /api/licencias/expedientes/[id]/ejecutoria
 *
 * La CONSTANCIA DE EJECUTORIA, derivada de las actuaciones del expediente.
 *
 * SE NIEGA A EMITIRSE SI LA CADENA NO ESTÁ COMPLETA. Una constancia de
 * ejecutoria afirma que un acto está en firme; componerla con la cadena a
 * medias sería certificar un hecho que no consta — misma doctrina que la
 * constancia de radicación, que se niega cuando no hay actuación.
 *
 * Cada dato sale de la ACTUACIÓN que lo registró, no del documento raíz: las
 * actuaciones no se reescriben nunca, y el raíz es una proyección.
 */
import { NextResponse } from 'next/server';
import type { TenantId } from '@/src/types/radicado';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import type { ActuacionLicenciaDoc, ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { buildConstanciaEjecutoriaHtml } from '@/lib/constancias/constancia-ejecutoria';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

/** Qué sentido tuvo el acto, según la actuación que lo produjo. */
const SENTIDO_POR_TIPO: Readonly<Record<string, 'CONCEDIDA' | 'NEGADA' | 'DESISTIDA'>> = {
  'resolucion-concede': 'CONCEDIDA',
  'resolucion-niega': 'NEGADA',
  'desistimiento-expreso': 'DESISTIDA',
  'desistimiento-tacito': 'DESISTIDA',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const sesion = await requireActiveInternalUser();
    const db = getFirebaseAdminDb();

    const expSnap = await db.doc(`expedientes/${id}`).get();
    if (!expSnap.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const exp = expSnap.data() as ExpedienteLicenciaDoc;
    if (!canOperateTenant(sesion, exp.tenantId as TenantId)) {
      return NextResponse.json({ error: 'No tiene permiso sobre este expediente.' }, { status: 403 });
    }

    const actSnap = await db.collection(`expedientes/${id}/actuaciones`).orderBy('fecha', 'asc').get();
    const actuaciones = actSnap.docs.map((d) => d.data() as ActuacionLicenciaDoc);

    const actoDeFondo = [...actuaciones].reverse().find((a) => SENTIDO_POR_TIPO[a.tipo]);
    const notificacion = [...actuaciones].reverse().find((a) => a.tipo === 'notificacion');
    const firmeza = [...actuaciones].reverse().find((a) => a.tipo === 'firmeza');

    /* LOS TRES ESLABONES, NOMBRADOS. Un «faltan datos» genérico obligaría a la
       funcionaria a adivinar cuál; se dice cuál falta y qué registrar. */
    const faltan: string[] = [];
    if (!actoDeFondo?.evidenciaCierre?.resolucion) faltan.push('la resolución que decide (con su número y fecha)');
    if (!notificacion?.evidenciaCierre?.notificacion) faltan.push('la notificación al ciudadano (con su fecha)');
    if (!firmeza?.evidenciaCierre?.firmeza) faltan.push('la firmeza del acto (con su motivo y fecha)');

    if (faltan.length > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede expedir la constancia de ejecutoria porque no consta ' +
            `${faltan.join(', ni ')}. Registre esas actuaciones antes de expedirla.`,
        },
        { status: 409 },
      );
    }

    const html = buildConstanciaEjecutoriaHtml({
      numeroExpediente: exp.numeroExpediente?.numero ?? id,
      solicitanteNombre: exp.solicitanteNombre,
      sentido: SENTIDO_POR_TIPO[actoDeFondo!.tipo],
      numeroResolucion: actoDeFondo!.evidenciaCierre!.resolucion!.numeroResolucion,
      fechaResolucion: actoDeFondo!.evidenciaCierre!.resolucion!.fechaResolucion,
      fechaNotificacion: notificacion!.evidenciaCierre!.notificacion!.fechaNotificacion,
      modoNotificacion: notificacion!.evidenciaCierre!.notificacion!.modo,
      motivoFirmeza: firmeza!.evidenciaCierre!.firmeza!.motivo,
      fechaFirmeza: firmeza!.evidenciaCierre!.firmeza!.fechaFirmeza,
      /* Quien la expide es quien registró la firmeza — el último acto de la
         cadena— no quien abre la página. */
      funcionarioNombre: firmeza!.actorNombre,
      expedidaEn: firmeza!.evidenciaCierre!.firmeza!.fechaFirmeza,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // No se cachea: es un documento con efectos.
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logError({ radicadoId: id, modulo: 'licencias/ejecutoria', error });
    return NextResponse.json({ error: 'No fue posible expedir la constancia.' }, { status: 500 });
  }
}
