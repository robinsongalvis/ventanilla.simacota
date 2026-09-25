/* ══════════════════════════════════════════════════════════════
   POST /api/licencias/expedientes/{id}/vincular-radicado

   Vincula un radicado de ventanilla a un expediente que YA existe.

   POR QUÉ EXISTE. La Bandeja de Licencias tiene dos botones juntos:
   «Crear desde radicado» (el camino correcto) y «Radicar solicitud» (que
   crea el expediente SIN radicado). Hasta el 13-ago-2026, equivocarse de
   botón era irreversible: no había forma de vincular un radicado después,
   así que el expediente quedaba huérfano para siempre y no podía llegar a
   ser un trámite real. Esta ruta lo hace reversible.

   MISMA disciplina transaccional que el handoff (`desde-radicado`): el
   radicado se lee DENTRO de la transacción en la que se escribe, de modo
   que "sin vínculo previo" y la escritura del vínculo son atómicos. Dos
   vinculaciones concurrentes del mismo radicado no pueden ganar ambas.

   MISMA validación de elegibilidad (`verificarRadicadoVinculable`) que la
   otra puerta — compartida, no duplicada: si divergieran, la unicidad del
   vínculo dependería de por dónde se entró.

   NO emite constancia al ciudadano: el expediente ya existía y su
   constancia —si procedía— se decidió en su creación. Aquí solo se corrige
   un vínculo que faltaba.
══════════════════════════════════════════════════════════════ */
import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { canOperateTenant, requireActiveInternalUser } from '@/lib/server/internal-auth';
import { appendTrazabilidadAdmin } from '@/lib/server/radicados-security';
import type { TenantId } from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  esErrorExpediente,
  planVincularRadicado,
  type ExpedienteLicenciaDoc,
} from '@/lib/server/expedientes-licencias';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const usuario = await requireActiveInternalUser();
    if (!canOperateTenant(usuario, TENANT_LICENCIAS)) {
      return NextResponse.json({ error: 'Tu rol no permite operar expedientes de licencias.' }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { radicadoId?: string } | null;
    const radicadoId = typeof body?.radicadoId === 'string' ? body.radicadoId.trim() : '';
    if (!radicadoId) {
      return NextResponse.json({ error: 'Debe indicar el radicado que se va a vincular.' }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const ahora = new Date();
    const actor = { uid: usuario.uid, nombre: usuario.nombre, rol: usuario.rol };

    const resultado = await db.runTransaction(async (tx) => {
      const expedienteRef = db.doc(`expedientes/${id}`);
      const radicadoRef = db.doc(`ventanilla_radicados/${radicadoId}`);

      // Ambas lecturas ANTES de cualquier escritura (regla del Admin SDK).
      const [expedienteSnap, radicadoSnap] = await Promise.all([tx.get(expedienteRef), tx.get(radicadoRef)]);
      if (!expedienteSnap.exists) {
        return { error: { status: 404, mensaje: 'Expediente no encontrado.' }, plan: null } as const;
      }
      if (!radicadoSnap.exists) {
        return { error: { status: 404, mensaje: 'Radicado no encontrado.' }, plan: null } as const;
      }
      const expediente = expedienteSnap.data() as ExpedienteLicenciaDoc;
      if (expediente.tenantId !== TENANT_LICENCIAS) {
        return { error: { status: 404, mensaje: 'Expediente no encontrado.' }, plan: null } as const;
      }
      const radicado = radicadoSnap.data() as VentanillaRadicado;

      const plan = planVincularRadicado(expediente, radicado, actor, ahora);
      if (esErrorExpediente(plan)) {
        return { error: plan, plan: null } as const;
      }

      // Los tres documentos se confirman ATÓMICAMENTE.
      tx.update(expedienteRef, { radicadoId, actualizadoEn: ahora.toISOString() });
      tx.create(expedienteRef.collection('actuaciones').doc(plan.actuacion.id), plan.actuacion);
      tx.update(radicadoRef, { vinculoExpediente: plan.vinculoRadicado, ultimaActualizacion: ahora.toISOString() });

      return { error: null, plan } as const;
    });

    if (resultado.error) {
      return NextResponse.json({ error: resultado.error.mensaje }, { status: resultado.error.status });
    }

    // Trazabilidad del RADICADO — post-commit, mismo patrón que el handoff.
    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora.toISOString(),
      accion: 'EXPEDIENTE_LICENCIA_VINCULADO',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      nota: `Se vinculó este radicado al expediente ${resultado.plan.vinculoRadicado.numeroExpediente}, que ya existía sin radicado.`,
      metadata: {
        expedienteId: resultado.plan.vinculoRadicado.expedienteId,
        numeroExpediente: resultado.plan.vinculoRadicado.numeroExpediente,
      },
    });

    return NextResponse.json({ ok: true, radicadoId, vinculo: resultado.plan.vinculoRadicado });
  } catch (error) {
    logError({ radicadoId: id, modulo: 'licencias/expedientes/[id]/vincular-radicado/POST', error });
    return NextResponse.json({ error: 'No fue posible vincular el radicado.' }, { status: 500 });
  }
}
