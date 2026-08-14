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
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '@/lib/motor-expedientes/definiciones/licencia-construccion-parcial';
import {
  planCrearExpedienteDesdeRadicado,
  esErrorExpediente,
  debeEnviarComunicacionExpediente,
  construirActuacionComunicacionEnviada,
  type ErrorExpediente,
  type PlanCrearExpedienteDesdeRadicado,
} from '@/lib/server/expedientes-licencias';
import {
  buildConstanciaExpedienteHtml,
  buildConstanciaExpedienteSubject,
} from '@/lib/email/templates/constancia-expediente-licencia';
import { enviarEmail } from '@/lib/email/mailer';
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
        { subtipos: body?.subtipos ?? [], contexto: body?.contexto },
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

    // Constancia (A5, dictamen gobierno-digital 8-ago) — post-commit,
    // best-effort: un fallo de envío NUNCA revierte la vinculación ya
    // confirmada. SOLO se emite aquí, en el acto de creación — no existe
    // ninguna ruta de reenvío.
    let constanciaEnviada = false;
    const gate = debeEnviarComunicacionExpediente(plan.expediente.tramiteId, radicado, plan.expediente.numeroExpediente?.numero);
    if (gate.debeEnviar) {
      const email = radicado.solicitante.email!;
      const numero = plan.expediente.numeroExpediente!.numero;
      try {
        await enviarEmail({
          to: email,
          subject: buildConstanciaExpedienteSubject(numero),
          html: buildConstanciaExpedienteHtml({
            numeroExpedienteFUN: numero,
            solicitanteNombre: plan.expediente.solicitanteNombre,
            solicitanteDocumento: plan.expediente.solicitanteDocumento,
            tipoDocumento: radicado.solicitante.tipoDocumento,
            descripcionTramite: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.nombre.toLowerCase(),
            // Día CIVIL de la CREACIÓN del expediente — NUNCA la fecha del radicado de ventanilla.
            fechaRadicacionLegal: plan.expediente.creadoEn,
            radicadoVentanillaId: radicadoId,
          }),
        });
        constanciaEnviada = true;
        await db.doc(`expedientes/${plan.expediente.id}`).collection('actuaciones').add(
          construirActuacionComunicacionEnviada(
            plan.expediente.id,
            TENANT_LICENCIAS,
            { tipoComunicacion: 'Constancia de radicación en legal y debida forma', destinatario: email, asunto: buildConstanciaExpedienteSubject(numero) },
            actor,
            new Date(),
          ),
        );
      } catch (err) {
        logError({ radicadoId, modulo: 'licencias/expedientes/desde-radicado/constancia', error: err });
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
