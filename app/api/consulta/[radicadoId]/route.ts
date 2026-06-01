import { NextResponse, type NextRequest } from 'next/server';
import { getRadicadoAdmin } from '@/lib/firestore-admin-rest';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import type { AccionAuditoria, EstadoRadicado, TenantId } from '@/src/types/radicado';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';

export const runtime = 'nodejs';

const LEGACY_RADICADO_RE = /^EXT-\d{4}-\d{2}-\d{2}-\d{6}-[A-Z2-9]{4}$/;
const INSTITUCIONAL_RADICADO_RE = /^1-(WEB|OFICIO|EMAIL|PRESENCIAL)-\d{4}-\d{8}$/;
const RADICADO_RE = new RegExp(
  `${LEGACY_RADICADO_RE.source}|${INSTITUCIONAL_RADICADO_RE.source}`,
);

const ACCIONES_PUBLICAS = new Set<AccionAuditoria>([
  'RADICACION',
  'CLASIFICACION_IA',
  'ASIGNACION',
  'CAMBIO_ESTADO',
  'RESPUESTA_FUNCIONARIO',
  'DEVOLUCION',
  'RECLASIFICACION',
  'NOTIFICACION_WHATSAPP',
]);

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

async function getVentanillaRadicadoPublico(id: string) {
  const db = getFirebaseAdminDb();
  const snap = await db.doc(`ventanilla_radicados/${id}`).get();

  if (!snap.exists) return null;

  const data = snap.data() as VentanillaRadicado;
  const trazabilidadSnap = await db
    .collection(`ventanilla_radicados/${id}/trazabilidad`)
    .orderBy('fecha', 'asc')
    .limit(25)
    .get();

  const auditoria = trazabilidadSnap.docs
    .map((doc) => doc.data() as TrazabilidadRadicado)
    .filter((entrada) => ACCIONES_PUBLICAS.has(entrada.accion as AccionAuditoria))
    .map((entrada) => ({
      fecha: entrada.fecha,
      accion: entrada.accion as AccionAuditoria,
    }));

  return {
    radicadoId: data.radicadoId ?? id,
    fechaCreacion: data.control?.fechaRadicado,
    estadoActual: data.estadoActual,
    tipoSolicitudNombre: data.termino?.tipoSolicitudNombre,
    canalRespuesta: data.canalRespuesta ?? null,
    clasificacionIA: data.clasificacion?.oficinaDestino
      ? { oficinaDestino: data.clasificacion.oficinaDestino }
      : null,
    auditoria,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { radicadoId } = await context.params;
  const id = decodeURIComponent(radicadoId).trim().toUpperCase();

  if (!RADICADO_RE.test(id)) {
    return NextResponse.json({ error: 'Numero de radicado invalido.' }, { status: 400 });
  }

  try {
    if (INSTITUCIONAL_RADICADO_RE.test(id)) {
      const ventanilla = await getVentanillaRadicadoPublico(id);

      if (!ventanilla) {
        return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
      }

      return NextResponse.json(ventanilla);
    }

    const data = await getRadicadoAdmin(id);

    if (!data) {
      return NextResponse.json({ error: 'Radicado no encontrado.' }, { status: 404 });
    }

    const clasificacion = data.clasificacionIA as { oficinaDestino?: TenantId } | null | undefined;
    const auditoria = (Array.isArray(data.auditoria) ? data.auditoria : []) as {
      fecha?: unknown;
      accion?: unknown;
    }[];

    return NextResponse.json({
      radicadoId: data.radicadoId ?? id,
      fechaCreacion: data.fechaCreacion,
      estadoActual: data.estadoActual as EstadoRadicado | undefined,
      tipoSolicitudNombre: typeof data.tipoSolicitudNombre === 'string' ? data.tipoSolicitudNombre : undefined,
      canalRespuesta: typeof data.canalRespuesta === 'string' ? data.canalRespuesta : null,
      clasificacionIA: clasificacion?.oficinaDestino
        ? { oficinaDestino: clasificacion.oficinaDestino }
        : null,
      auditoria: auditoria
        .filter((entrada) =>
          typeof entrada.fecha === 'string'
          && typeof entrada.accion === 'string'
          && ACCIONES_PUBLICAS.has(entrada.accion as AccionAuditoria)
        )
        .map((entrada) => ({
          fecha: entrada.fecha as string,
          accion: entrada.accion as AccionAuditoria,
        })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error consultando el radicado.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
