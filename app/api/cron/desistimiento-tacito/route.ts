import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { autorizarCron } from '@/lib/seguridad/autorizar-cron';
import { appendTrazabilidadAdmin } from '@/lib/server/radicados-security';
import { debeProponerDesistimiento, planPropuestaDesistimiento } from '@/lib/server/subsanacion';
import { logError } from '@/lib/logger';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

/* ══════════════════════════════════════════════════════════════
   GET /api/cron/desistimiento-tacito   (BM-B33)

   Diario. Detecta radicados EN_SUBSANACION cuyo plazo (con prórroga si la
   hubo) venció y aún no se ha propuesto desistimiento, y PROPONE el
   desistimiento tácito (evento + marca de idempotencia).

   NUNCA archiva ni cambia el estado: la decisión es un ACTO ADMINISTRATIVO
   MOTIVADO que confirma un humano (Principio 9; Ley 1755 Art. 17). El
   endpoint /desistimiento (rol superior) hace la confirmación.

   Seguridad: header Authorization: Bearer <CRON_SECRET>.
══════════════════════════════════════════════════════════════ */

export async function GET(request: Request): Promise<NextResponse> {
  const auth = autorizarCron({
    authorization: request.headers.get('authorization'),
    secret: process.env.CRON_SECRET,
  });
  if (!auth.ok) {
    console.warn('[cron/desistimiento-tacito] acceso denegado', { motivo: auth.motivo });
    return NextResponse.json({ error: auth.mensaje }, { status: auth.status });
  }

  const db = getFirebaseAdminDb();
  const ahora = new Date();
  let propuestos = 0;
  let errores = 0;

  try {
    const snap = await db.collection('ventanilla_radicados').get();
    const candidatos = snap.docs
      .map((d) => ({ id: d.id, r: d.data() as VentanillaRadicado & { isTest?: boolean; excludeFromMetrics?: boolean } }))
      .filter(({ r }) => r.estadoActual === 'EN_SUBSANACION' && !r.isTest && !r.excludeFromMetrics
        && debeProponerDesistimiento(r, ahora));

    for (const { id, r } of candidatos) {
      try {
        const plan = planPropuestaDesistimiento(r, ahora);
        await db.doc(`ventanilla_radicados/${id}`).update(plan.update);
        await appendTrazabilidadAdmin(id, {
          fecha: ahora.toISOString(),
          accion: plan.evento.accion,
          actorUid: 'cron',
          actorNombre: 'Sistema (cron desistimiento)',
          nota: plan.evento.nota,
          metadata: plan.evento.metadata,
        });
        propuestos += 1;
      } catch (err) {
        errores += 1;
        logError({ radicadoId: id, modulo: 'cron/desistimiento-tacito', error: err });
      }
    }

    return NextResponse.json({ ok: true, propuestos, errores, evaluados: snap.size });
  } catch (error) {
    logError({ radicadoId: 'n/a', modulo: 'cron/desistimiento-tacito', error });
    return NextResponse.json({ error: 'Error al procesar desistimientos tácitos.' }, { status: 500 });
  }
}
