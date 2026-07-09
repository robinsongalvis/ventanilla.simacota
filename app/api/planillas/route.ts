import { NextResponse } from 'next/server';
import {
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { obtenerPendientesDeReparto } from '@/lib/server/planillas-security';
import type { PlanillaReparto } from '@/src/types/planilla';
import { logError } from '@/lib/logger';

/* ══════════════════════════════════════════════════════════════
   Planilla de reparto — GET /api/planillas

   Una sola lectura para la vista Reparto: los radicados físicos
   pendientes de entrega + las planillas recientes. Control Interno
   también puede consultar (auditoría de la cadena de custodia);
   la escritura sigue siendo exclusiva de Recepción/Admin.
══════════════════════════════════════════════════════════════ */

export const runtime = 'nodejs';

const ROLES_LECTURA = new Set(['ADMIN', 'RECEPCIONISTA', 'CONTROL_INTERNO']);

export async function GET(): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();
    if (!ROLES_LECTURA.has(usuario.rol)) {
      return NextResponse.json(
        { error: 'Su rol no puede consultar el reparto.' },
        { status: 403 },
      );
    }

    const db = getFirebaseAdminDb();
    const [{ pendientes }, snapRecientes] = await Promise.all([
      obtenerPendientesDeReparto(db),
      db
        .collection('ventanilla_planillas')
        .orderBy('fechaGeneracion', 'desc')
        .limit(30)
        .get(),
    ]);

    const planillas = snapRecientes.docs.map((d) => d.data() as PlanillaReparto);

    // La vista solo necesita lo que imprime la planilla: nada de
    // teléfonos, correos ni descripciones en la respuesta.
    const pendientesLigeros = pendientes.map((r) => ({
      radicadoId: r.radicadoId,
      dependenciaDestino: r.clasificacion.oficinaDestino,
      asunto: r.detalle?.asunto ?? 'Sin asunto',
      fechaRadicado: r.control?.fechaRadicado ?? '',
      horaRadicado: r.control?.horaRadicado ?? '',
      numeroFolios: r.detalle?.numeroFolios ?? 0,
    }));

    return NextResponse.json({ ok: true, pendientes: pendientesLigeros, planillas });
  } catch (error) {
    logError({ radicadoId: '', modulo: 'planillas/listar', error });
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'No fue posible consultar el reparto.' },
      { status: 500 },
    );
  }
}
