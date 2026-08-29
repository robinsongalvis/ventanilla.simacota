/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/desde-radicado   (D2, Bloque A·A4)

   Handoff radicado⇄expediente: crea un expediente de licencias a partir
   de un radicado YA existente de ventanilla, vinculándolos en la MISMA
   transacción (tx multi-documento: `expedientes/{id}` + su primera
   actuación + `ventanilla_radicados/{radicadoId}.vinculoExpediente`).
   Vínculo ÚNICO — un segundo intento sobre el mismo radicado devuelve 409.

   Camino ÚNICO de creación: DEMO (candado R10 intacto, ver
   `lib/server/expedientes-licencias.ts`).

   Post-commit (N8): trazabilidad del radicado
   (`EXPEDIENTE_LICENCIA_VINCULADO`) + constancia por correo (A5,
   best-effort — un fallo de envío NUNCA revierte la vinculación).
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import {
  canOperateTenant,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { appendTrazabilidadAdmin } from '@/lib/server/radicados-security';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { describirTramiteDesdeSubtipos } from '@/lib/motor-expedientes/describir-tramite';
import {
  planCrearExpedienteDesdeRadicado,
  esErrorExpediente,
  debeEnviarComunicacionExpediente,
  construirActuacionComunicacionEnviada,
  type ErrorExpediente,
  type PlanCrearExpedienteDesdeRadicado,
} from '@/lib/server/expedientes-licencias';
import {
  buildAcuseReciboExpedienteHtml,
  buildAcuseReciboExpedienteSubject,
} from '@/lib/email/templates/acuse-recibo-expediente-licencia';
import { resumenDocumentosAcuse } from '@/lib/server/completitud-expediente';
import { enviarEmail } from '@/lib/email/mailer';
import { aplicarResultadoEnvio } from '@/lib/server/comunicacion-fallida';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible crear el expediente desde el radicado.' }, { status: 500 });
}

interface BodyDesdeRadicado {
  radicadoId?: string;
  subtipos?: string[];
  /** Modalidades del art. 2.2.6.1.1.7 — solo con la figura CONSTRUCCION. */
  modalidadesConstruccion?: string[];
  contexto?: Record<string, string | number | boolean>;
}

type ResultadoTx =
  | { error: ErrorExpediente }
  | { plan: PlanCrearExpedienteDesdeRadicado; radicado: VentanillaRadicado };

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite vincular expedientes de licencias.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as BodyDesdeRadicado | null;
    const radicadoId = body?.radicadoId?.trim();
    if (!radicadoId) {
      return NextResponse.json({ error: 'radicadoId es obligatorio.' }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const ahora = new Date();
    const actor = { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol };

    const resultado: ResultadoTx = await db.runTransaction(async (tx) => {
      const radicadoRef = db.doc(`ventanilla_radicados/${radicadoId}`);
      const radicadoSnap = await tx.get(radicadoRef);
      if (!radicadoSnap.exists) {
        return { error: { status: 404, mensaje: 'Radicado no encontrado.' } };
      }
      const radicado = radicadoSnap.data() as VentanillaRadicado;

      const plan = planCrearExpedienteDesdeRadicado(
        radicado,
        {
          subtipos: body?.subtipos ?? [],
          // Sin capturar = ausente. No se rellena con un valor por defecto.
          modalidadesConstruccion: body?.modalidadesConstruccion,
          contexto: body?.contexto,
        },
        TENANT_LICENCIAS,
        actor,
        ahora,
      );
      if (esErrorExpediente(plan)) {
        return { error: plan };
      }

      const expedienteRef = db.doc(`expedientes/${plan.expediente.id}`);
      // tx multi-documento: expediente + primera actuación + vínculo del
      // radicado se confirman ATÓMICAMENTE — si algo falla, nada de esto queda.
      tx.create(expedienteRef, plan.expediente);
      tx.create(expedienteRef.collection('actuaciones').doc(plan.primeraActuacion.id), plan.primeraActuacion);
      tx.update(radicadoRef, { vinculoExpediente: plan.vinculoRadicado, ultimaActualizacion: ahora.toISOString() });

      return { plan, radicado };
    });

    if ('error' in resultado) {
      return NextResponse.json({ error: resultado.error.mensaje }, { status: resultado.error.status });
    }
    const { plan, radicado } = resultado;

    // Trazabilidad del RADICADO — post-commit (N8, patrón appendTrazabilidadAdmin).
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora.toISOString(),
      accion: 'EXPEDIENTE_LICENCIA_VINCULADO',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: `Expediente de licencias ${plan.vinculoRadicado.numeroExpediente} creado y vinculado a este radicado.`,
      metadata: { expedienteId: plan.vinculoRadicado.expedienteId, numeroExpediente: plan.vinculoRadicado.numeroExpediente },
    });

    /* ACUSE DE RECIBO — post-commit, best-effort: un fallo de envío NUNCA
       revierte la vinculación ya confirmada. SOLO se emite aquí, en el acto
       de creación; no existe ninguna ruta de reenvío.

       ANTES SE ENVIABA UNA CONSTANCIA DE RADICACIÓN EN LEGAL Y DEBIDA FORMA,
       fechada el día en que se abrió la carpeta. Desde el ADR-0033 el
       expediente NACE en `PRESENTADA`: ese hito NO ha ocurrido en este
       momento, y certificarlo por escrito produce nulidades. El candado R10
       lo tapaba —corta cualquier número `DEMO-`— pero eso solo aplazaba el
       daño hasta el día del arranque real, que es el peor día para
       descubrirlo.

       El acuse afirma únicamente hechos verificables hoy: qué se recibió,
       qué falta, y que el plazo legal todavía no corre. */
    let constanciaEnviada = false;
    const gate = debeEnviarComunicacionExpediente(plan.expediente.tramiteId, radicado, plan.expediente.numeroExpediente?.numero);
    if (gate.debeEnviar) {
      const email = radicado.solicitante.email!;
      const numero = plan.expediente.numeroExpediente!.numero;
      try {
        const docs = resumenDocumentosAcuse(
          plan.expediente.aportes ?? [],
          plan.expediente.contexto ?? {},
        );
        await enviarEmail({
          to: email,
          subject: buildAcuseReciboExpedienteSubject(numero),
          html: buildAcuseReciboExpedienteHtml({
            numeroExpediente: numero,
            solicitanteNombre: plan.expediente.solicitanteNombre,
            solicitanteDocumento: plan.expediente.solicitanteDocumento,
            tipoDocumento: radicado.solicitante.tipoDocumento,
            // La figura sale del EXPEDIENTE (mismo motivo que en la
            // constancia impresa): este correo afirmaba «obra nueva» a todo
            // el mundo. La modalidad no se nombra: nadie la captura.
            descripcionTramite: describirTramiteDesdeSubtipos(plan.expediente.subtipos, plan.expediente.modalidadesConstruccion),
            // Día en que la Alcaldía RECIBIÓ la solicitud. No es una fecha con
            // efecto de plazo, y el correo lo dice expresamente.
            fechaRecepcion: plan.expediente.creadoEn,
            documentosEntregados: docs.entregados,
            documentosFaltantes: docs.faltantes,
            requisitosAplicables: docs.aplicables,
            radicadoVentanillaId: radicadoId,
          }),
        });
        constanciaEnviada = true;
        await db.doc(`expedientes/${plan.expediente.id}`).collection('actuaciones').add(
          construirActuacionComunicacionEnviada(
            plan.expediente.id,
            TENANT_LICENCIAS,
            { tipoComunicacion: 'Acuse de recibo de solicitud', destinatario: email, asunto: buildAcuseReciboExpedienteSubject(numero) },
            actor,
            new Date(),
          ),
        );
      } catch (err) {
        logError({ radicadoId, modulo: 'licencias/expedientes/desde-radicado/constancia', error: err });
      }
      /* El expediente ACABA de crearse, así que no hay marca previa que
         conservar: se pasa `undefined` en vez de leerlo otra vez. */
      try {
        const marca = aplicarResultadoEnvio(undefined, 'ACUSE', {
          exito: constanciaEnviada,
          destinatario: email,
          fechaIso: new Date().toISOString(),
        });
        if (marca) {
          await db.doc(`expedientes/${plan.expediente.id}`).update({ comunicacionesFallidas: marca });
        }
      } catch (err) {
        logError({ radicadoId, modulo: 'licencias/desde-radicado/marca-comunicacion', error: err });
      }
    }

    return NextResponse.json({
      ok: true,
      expediente: plan.expediente,
      vinculoExpediente: plan.vinculoRadicado,
      constanciaEnviada,
    }, { status: 201 });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/desde-radicado/POST', error });
    return jsonError(error);
  }
}
