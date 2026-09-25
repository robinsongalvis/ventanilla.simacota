/* ══════════════════════════════════════════════════════════════
   POST /api/radicados/[radicadoId]/reclasificar

   Reclasifica el tipo de solicitud de un radicado existente.

   Reglas (Sprint Catálogo — Fase 9):
   - Solo RECEPCIONISTA y ADMIN pueden reclasificar.
   - Se preserva el tipo anterior en metadata para trazabilidad.
   - Se recalcula la fecha de vencimiento con el nuevo tipo.
   - Se emite el evento TIPO_SOLICITUD_RECLASIFICADO en la subcolección
     trazabilidad.
   - Si el nuevo término es menor al anterior, la respuesta incluye
     `advertenciaTerminoMenor` para que el cliente lo muestre al usuario.
══════════════════════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getFirebaseAdminDb } from '@/lib/firebase-admin';
import { removeUndefinedDeep } from '@/lib/firestore/removeUndefined';
import {
  canReclassifyTipoSolicitud,
  InternalAuthError,
  requireActiveInternalUser,
} from '@/lib/server/internal-auth';
import {
  appendTrazabilidadAdmin,
  assertNotClosed,
  getRadicadoOrFail,
  RadicadoActionError,
} from '@/lib/server/radicados-security';
import { calcularFechaVencimiento, resolverTipoSolicitud } from '@/lib/tiempos-radicado';
import { getTipoSolicitudById } from '@/lib/catalogos/tipos-solicitud';
import { sugerirSerieDocumental } from '@/lib/catalogos/series-documentales';
import { logError } from '@/lib/logger';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ radicadoId: string }>;
}

interface Payload {
  tipoSolicitudId?: string;
  motivo?: string;
}

function jsonError(error: unknown) {
  if (error instanceof InternalAuthError || error instanceof RadicadoActionError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'No fue posible reclasificar el radicado.' }, { status: 500 });
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const usuario = await requireActiveInternalUser();

    if (!canReclassifyTipoSolicitud(usuario)) {
      return NextResponse.json(
        { error: 'Tu rol no permite reclasificar el tipo de solicitud.' },
        { status: 403 },
      );
    }

    const { radicadoId } = await context.params;
    const payload = (await request.json().catch(() => null)) as Payload | null;
    const nuevoTipoId = payload?.tipoSolicitudId?.trim();
    const motivo = payload?.motivo?.trim() ?? '';

    if (!nuevoTipoId) {
      return NextResponse.json({ error: 'Tipo de solicitud destino requerido.' }, { status: 400 });
    }

    const definicionNueva = getTipoSolicitudById(nuevoTipoId);
    if (!definicionNueva || !definicionNueva.activo) {
      return NextResponse.json(
        { error: 'El tipo de solicitud destino no existe o no está activo.' },
        { status: 400 },
      );
    }

    const radicado = await getRadicadoOrFail(radicadoId);
    assertNotClosed(radicado);

    const tipoAnteriorId = radicado.termino?.tipoSolicitudId;
    const tipoAnteriorNombre = radicado.termino?.tipoSolicitudNombre ?? '';
    const diasAnteriores = radicado.termino?.diasRespuesta ?? 0;
    const unidadAnterior = radicado.termino?.unidad ?? 'HABILES';

    if (tipoAnteriorId === nuevoTipoId) {
      return NextResponse.json(
        { error: 'El radicado ya tiene este tipo asignado.' },
        { status: 400 },
      );
    }

    const ahora = new Date();
    const tipoNuevo = resolverTipoSolicitud(nuevoTipoId);
    const fechaBase = radicado.control?.fechaRadicado ?? ahora.toISOString();
    const recalculo = calcularFechaVencimiento(fechaBase, nuevoTipoId);
    const nuevaFechaVencimiento = recalculo.fechaVencimiento;
    const nuevosDias = recalculo.diasRespuesta;

    // Detección de reducción de término (advertencia institucional).
    const terminoAnteriorDiasHabilesEquivalente =
      unidadAnterior === 'HABILES' ? diasAnteriores : Math.round(diasAnteriores * 0.7);
    const terminoNuevoDiasHabilesEquivalente =
      tipoNuevo.unidad === 'HABILES' ? tipoNuevo.diasRespuesta : Math.round(tipoNuevo.diasRespuesta * 0.7);
    const advertenciaTerminoMenor =
      terminoNuevoDiasHabilesEquivalente < terminoAnteriorDiasHabilesEquivalente;

    // C1/BM-B11 — la serie TRD deriva de tipo × destino; al reclasificar el
    // tipo, se re-deriva para que la clasificación no quede desactualizada.
    // Ortogonal a H3: no toca el consecutivo, solo la foto de serie.
    const oficinaDestino = radicado.clasificacion?.oficinaDestino;
    const serieAnterior = radicado.clasificacion?.serieDocumental ?? null;
    const serieNueva = oficinaDestino
      ? sugerirSerieDocumental(nuevoTipoId, oficinaDestino)
      : null;

    const update = removeUndefinedDeep({
      'termino.tipoSolicitudId': tipoNuevo.id,
      'termino.tipoSolicitudNombre': tipoNuevo.nombre,
      'termino.diasRespuesta': tipoNuevo.diasRespuesta,
      'termino.unidad': tipoNuevo.unidad,
      'termino.fechaVencimiento': nuevaFechaVencimiento,
      ultimaActualizacion: ahora.toISOString(),
      prioridad: tipoNuevo.prioridadSugerida,
      // Solo se reescribe cuando hay destino del que derivar (si el nuevo tipo
      // no produce serie, queda null = "se clasifica en archivo").
      ...(oficinaDestino ? { 'clasificacion.serieDocumental': serieNueva } : {}),
    });

    await getFirebaseAdminDb().doc(`ventanilla_radicados/${radicadoId}`).update(update);

    await appendTrazabilidadAdmin(radicadoId, {
      fecha: ahora.toISOString(),
      accion: 'TIPO_SOLICITUD_RECLASIFICADO',
      actorUid: usuario.uid,
      actorNombre: usuario.nombre,
      oficinaOrigen: radicado.clasificacion?.oficinaDestino,
      oficinaDestino: radicado.clasificacion?.oficinaDestino,
      nota: motivo
        ? `Reclasificación de "${tipoAnteriorNombre}" a "${tipoNuevo.nombre}" — ${motivo}`
        : `Reclasificación de "${tipoAnteriorNombre}" a "${tipoNuevo.nombre}".`,
      metadata: {
        tipoAnteriorId,
        tipoAnteriorNombre,
        tipoAnteriorDias: diasAnteriores,
        tipoAnteriorUnidad: unidadAnterior,
        tipoNuevoId: tipoNuevo.id,
        tipoNuevoNombre: tipoNuevo.nombre,
        tipoNuevoDias: nuevosDias,
        tipoNuevoUnidad: tipoNuevo.unidad,
        fechaVencimientoAnterior: radicado.termino?.fechaVencimiento,
        fechaVencimientoNueva: nuevaFechaVencimiento,
        advertenciaTerminoMenor,
        requiereValidacionJuridica: definicionNueva.requiereValidacionJuridica === true,
        actorRol: usuario.rol,
        // C1/BM-B11 — trazabilidad del cambio de serie (foto documental).
        serieAnteriorCodigo: serieAnterior?.codigo ?? null,
        serieNuevaCodigo: serieNueva?.codigo ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      radicadoId,
      tipoAnteriorId,
      tipoAnteriorNombre,
      tipoNuevoId: tipoNuevo.id,
      tipoNuevoNombre: tipoNuevo.nombre,
      diasRespuesta: nuevosDias,
      unidad: tipoNuevo.unidad,
      fechaVencimiento: nuevaFechaVencimiento,
      advertenciaTerminoMenor,
      requiereValidacionJuridica: definicionNueva.requiereValidacionJuridica === true,
      serieDocumental: serieNueva,
    });
  } catch (error) {
    const { radicadoId } = await context.params.catch(() => ({ radicadoId: 'desconocido' })) as { radicadoId: string };
    logError({ radicadoId, modulo: 'radicados/reclasificar', error });
    return jsonError(error);
  }
}
