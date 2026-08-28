/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/[id]/actuaciones

   Registra un HECHO ('acta-observaciones' | 'respuesta-subsanacion') sobre
   un expediente de licencias y transiciona su `estadoJuridico` según el
   mapa de `lib/motor-expedientes/estados-licencia.ts`. El EFECTO sobre el
   término sigue ⚖️ dual/bloqueado (`lib/motor-expedientes/termino.ts`,
   hueco 1 ADR-0029) — esta ruta NO decide ni persiste ningún vencimiento
   real, ninguna de las dos políticas. Lo que SÍ recalcula y persiste, en el
   MISMO batch que la actuación, es el espejo denormalizado
   `fechaAlertaConservadora` (R11, ver JSDoc en `lib/server/expedientes-
   licencias.ts`) — la fecha MÁS TEMPRANA entre ambas políticas, para que la
   bandeja la lea sin N+1. Ese espejo tampoco elige una política: expone la
   MÁS CONSERVADORA de las dos, el hueco 1 sigue sin default.

   Bloque "Integración UI y demo" / Bloque A·A5. Para 'acta-observaciones'
   el body admite el campo opcional `fechaComunicacion` (ISO): si viene, se
   calcula `fechaLimiteRespuesta` (30 días hábiles desde la comunicación,
   NO la expedición — condición del dictamen) y se imprime en el aviso al
   ciudadano; si NO viene, el aviso se envía igual pero SIN esa fecha.
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
import {
  planRegistrarActuacion,
  esErrorExpediente,
  debeEnviarComunicacionExpediente,
  calcularFechaLimiteRespuestaActa,
  construirActuacionComunicacionEnviada,
  type ExpedienteLicenciaDoc,
  type ActuacionLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { buildAvisoActaHtml, buildAvisoActaSubject } from '@/lib/email/templates/aviso-acta-observaciones';
import { enviarEmail } from '@/lib/email/mailer';
import type { RegistrarActuacionInput } from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible registrar la actuación.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    const { id } = await context.params;

    const db = getFirebaseAdminDb();
    const expedienteRef = db.doc(`expedientes/${id}`);
    const doc = await expedienteRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Expediente no encontrado.' }, { status: 404 });
    }
    const expediente = doc.data() as ExpedienteLicenciaDoc;

    if (!canOperateTenant(usuario, expediente.tenantId as TenantId)) {
      return NextResponse.json({ error: 'Tu rol no permite registrar actuaciones en este expediente.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as {
      tipo?: string;
      detalle?: string;
      fechaComunicacion?: string;
      resolucion?: RegistrarActuacionInput['resolucion'];
      notificacion?: RegistrarActuacionInput['notificacion'];
      firmeza?: RegistrarActuacionInput['firmeza'];
    } | null;

    // Se traen los documentos COMPLETOS (no solo `tipo`): además del guard
    // de acta única, `planRegistrarActuacion` recalcula el espejo
    // `fechaAlertaConservadora` (R11) sobre esta serie + la actuación nueva,
    // y ese cómputo necesita `fecha`/`origen` de cada actuación previa.
    const actuacionesSnap = await expedienteRef.collection('actuaciones').get();
    const actuacionesExistentes = actuacionesSnap.docs.map((d) => d.data() as ActuacionLicenciaDoc);

    const ahora = new Date();
    const plan = planRegistrarActuacion(
      expediente.estadoJuridico,
      actuacionesExistentes,
      id,
      expediente.tenantId,
      {
        tipo: body?.tipo ?? '',
        detalle: body?.detalle ?? '',
        /* La evidencia de cierre viaja TAL CUAL: el planificador la valida y
           rechaza con el motivo. La ruta no la interpreta ni la completa. */
        resolucion: body?.resolucion,
        notificacion: body?.notificacion,
        firmeza: body?.firmeza,
      },
      { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol },
      ahora,
    );
    if (esErrorExpediente(plan)) {
      return NextResponse.json({ error: plan.mensaje }, { status: plan.status });
    }

    const batch = db.batch();
    batch.set(expedienteRef.collection('actuaciones').doc(plan.actuacion.id), plan.actuacion);
    batch.update(expedienteRef, {
      estadoJuridico: plan.nuevoEstadoJuridico,
      actualizadoEn: ahora.toISOString(),
      // Espejo denormalizado (R11) — MISMO batch que la actuación: si la
      // actuación se escribe, el espejo se actualiza; si el batch falla,
      // ninguna de las dos queda escrita. Nunca una escritura suelta.
      fechaAlertaConservadora: plan.fechaAlertaConservadora,
    });
    await batch.commit();

    // Aviso de acta (A5, dictamen gobierno-digital 8-ago) — SOLO para
    // 'acta-observaciones', post-commit, best-effort: un fallo de envío
    // NUNCA revierte el registro de la actuación ya confirmado.
    let avisoEnviado = false;
    const actor = { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol };
    if (body?.tipo === 'acta-observaciones' && expediente.radicadoId) {
      const radicadoSnap = await db.doc(`ventanilla_radicados/${expediente.radicadoId}`).get();
      const radicado = radicadoSnap.exists ? (radicadoSnap.data() as VentanillaRadicado) : null;
      const gate = debeEnviarComunicacionExpediente(expediente.tramiteId, radicado, expediente.numeroExpediente?.numero);
      if (gate.debeEnviar && radicado) {
        const email = radicado.solicitante.email!;
        const numero = expediente.numeroExpediente?.numero ?? id;
        // La fecha límite SOLO se imprime si el funcionario registró
        // fechaComunicacion (condición del dictamen: el plazo corre desde
        // la comunicación, no la expedición) — sin ella, se omite.
        const fechaLimiteRespuesta = body?.fechaComunicacion
          ? calcularFechaLimiteRespuestaActa(body.fechaComunicacion)
          : undefined;
        try {
          await enviarEmail({
            to: email,
            subject: buildAvisoActaSubject(numero),
            html: buildAvisoActaHtml({
              numeroExpedienteFUN: numero,
              solicitanteNombre: expediente.solicitanteNombre,
              fechaLimiteRespuesta,
            }),
          });
          avisoEnviado = true;
          await expedienteRef.collection('actuaciones').add(
            construirActuacionComunicacionEnviada(
              id,
              expediente.tenantId,
              { tipoComunicacion: 'Aviso de acta de observaciones y correcciones', destinatario: email, asunto: buildAvisoActaSubject(numero) },
              actor,
              new Date(),
            ),
          );
        } catch (err) {
          logError({ radicadoId: id, modulo: 'licencias/expedientes/[id]/actuaciones/aviso-acta', error: err });
        }
      }
    }

    return NextResponse.json({ ok: true, actuacion: plan.actuacion, estadoJuridico: plan.nuevoEstadoJuridico, avisoEnviado });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'licencias/expedientes/[id]/actuaciones/POST', error });
    return jsonError(error);
  }
}
