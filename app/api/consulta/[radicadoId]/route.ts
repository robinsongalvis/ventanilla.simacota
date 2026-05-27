import { NextResponse, type NextRequest } from 'next/server';
import { getRadicadoAdmin } from '@/lib/firestore-admin-rest';
import type { AccionAuditoria, EstadoRadicado, TenantId } from '@/src/types/radicado';

export const runtime = 'nodejs';

const RADICADO_RE = /^EXT-\d{4}-\d{2}-\d{2}-\d{6}-[A-Z2-9]{4}$/;

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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { radicadoId } = await context.params;
  const id = decodeURIComponent(radicadoId).trim().toUpperCase();

  if (!RADICADO_RE.test(id)) {
    return NextResponse.json({ error: 'Numero de radicado invalido.' }, { status: 400 });
  }

  try {
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
