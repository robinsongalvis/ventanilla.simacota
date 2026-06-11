/* ══════════════════════════════════════════════════════════════
   RESOLVER RADICADO — Lógica desacoplada por criticidad

   DEPRECATED: las resoluciones institucionales vigentes deben pasar por
   POST /api/radicados/[radicadoId]/resolver para validar rol, usuario activo
   y blindar cumplioTermino como evidencia MIPG.

   OPERACIONES CRÍTICAS  (ejecutarResolucion)
     • Upload del PDF firmado a Firebase Storage
     • updateDoc del radicado → estadoActual: RESUELTO
     Si cualquiera falla → ok: false → el componente NO limpia
     el formulario ni dispara notificaciones.

   OPERACIONES SECUNDARIAS  (despacharNotificaciones)
     • appendTrazabilidad → subcollección Firestore
     • fetch POST /api/interno/notificar-ciudadano
     Ambas son fire-and-forget: su fallo se loguea pero nunca
     bloquea ni revierte la resolución ya confirmada.

   Separar ambas en funciones puras facilita pruebas unitarias
   sin tener que montar el componente React completo.
══════════════════════════════════════════════════════════════ */

import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';

import { getDb }        from '@/lib/firebase';
import { subirArchivo } from '@/lib/storage';
import { logError }     from '@/lib/logger';

import type { RespuestaOficial, TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';
import type { UsuarioAutenticado } from '@/lib/hooks/useAuth';
import type { TenantId }          from '@/src/types/radicado';

/* ── Tipos públicos ─────────────────────────────────────────── */

export interface EjecutarResolucionInput {
  radicado:   VentanillaRadicado;
  usuario:    UsuarioAutenticado;
  /** Texto de la nota ya recortado con .trim() */
  nota:       string;
  archivoPdf: File | null;
}

export type EjecutarResolucionResult =
  | { ok: true;  ahora: string; archivoNombre: string | null; cumplioTermino: boolean }
  | { ok: false; mensaje: string };

export interface DespacharNotificacionesParams {
  radicadoId:      string;
  actorUid:        string;
  actorNombre:     string;
  nota:            string;
  archivoNombre:   string | null;
  /** Timestamp ISO del momento en que se resolvió */
  ahora:           string;
  emailCiudadano?: string | null;
  nombreCiudadano: string;
  asunto:          string;
  tenantId:        TenantId;
  tieneArchivo:    boolean;
}

/* ══════════════════════════════════════════════════════════════
   ejecutarResolucion — OPERACIONES CRÍTICAS
   Retorna ok:true solo si Storage Y Firestore completaron bien.
══════════════════════════════════════════════════════════════ */

export async function ejecutarResolucion(
  input: EjecutarResolucionInput,
): Promise<EjecutarResolucionResult> {
  const { radicado, usuario, nota, archivoPdf } = input;
  const ahora = new Date().toISOString();

  try {
    // 1. Subir PDF firmado (Storage — crítico)
    let respuestaOficial: RespuestaOficial | null = null;
    if (archivoPdf) {
      const result = await subirArchivo(archivoPdf, radicado.radicadoId, undefined, 'respuestas');
      respuestaOficial = {
        archivoPath:   result.path,
        archivoNombre: result.nombre,
        nota,
        fecha:         ahora,
        actorUid:      usuario.uid,
        actorNombre:   usuario.nombre,
      };
    }

    // 2. Marcar radicado como RESUELTO en Firestore (crítico)
    //    cumplioTermino — MIPG Requisito 8: evidencia auditoria de cumplimiento legal.
    //    Se calcula en el momento exacto de resolución y queda inmutable en Firestore.
    const cumplioTermino: boolean =
      new Date(ahora) <= new Date(radicado.termino.fechaVencimiento);

    await updateDoc(
      doc(getDb(), 'ventanilla_radicados', radicado.radicadoId),
      {
        estadoActual:        'RESUELTO',
        ultimaActualizacion: ahora,
        cumplioTermino,
        ...(respuestaOficial ? { respuestaOficial } : {}),
      },
    );

    return {
      ok:             true,
      ahora,
      archivoNombre:  respuestaOficial?.archivoNombre ?? null,
      cumplioTermino,
    };

  } catch (err) {
    logError({
      radicadoId: radicado.radicadoId,
      modulo:     'resolver-radicado/critico',
      error:      err,
    });
    return {
      ok:      false,
      mensaje: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ══════════════════════════════════════════════════════════════
   despacharNotificaciones — OPERACIONES SECUNDARIAS
   Solo llamar cuando ejecutarResolucion() devolvió ok:true.
   Cada operación es independiente: si una falla, la otra
   continúa de todas formas.
══════════════════════════════════════════════════════════════ */

/** @internal — solo exportada para facilitar pruebas */
export function _buildTrazabilidadEntry(
  params: DespacharNotificacionesParams,
): Omit<TrazabilidadRadicado, 'eventoId'> {
  const extra: Record<string, unknown> = params.archivoNombre
    ? { archivoAdjunto: params.archivoNombre }
    : {};
  return {
    fecha:       params.ahora,
    accion:      'RESPUESTA_FUNCIONARIO',
    actorUid:    params.actorUid,
    actorNombre: params.actorNombre,
    nota:        params.nota,
    ...extra,
  };
}

export function despacharNotificaciones(params: DespacharNotificacionesParams): void {
  const { radicadoId } = params;

  // ── Trazabilidad (auditoría — secundaria) ─────────────────
  const entrada = _buildTrazabilidadEntry(params);
  addDoc(
    collection(getDb(), 'ventanilla_radicados', radicadoId, 'trazabilidad'),
    { ...entrada, eventoId: `ev_${radicadoId}_${Date.now()}` },
  ).catch((err) =>
    logError({ radicadoId, modulo: 'resolver-radicado/trazabilidad', error: err }),
  );

  // ── Email al ciudadano (notificación — secundaria) ────────
  if (!params.emailCiudadano) return;

  fetch('/api/interno/notificar-ciudadano', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      radicadoId,
      emailCiudadano:  params.emailCiudadano,
      nombreCiudadano: params.nombreCiudadano,
      asunto:          params.asunto,
      nota:            params.nota,
      tenantId:        params.tenantId,
      fechaRespuesta:  params.ahora,
      tieneArchivo:    params.tieneArchivo,
    }),
  }).catch((err) =>
    logError({ radicadoId, modulo: 'resolver-radicado/email-ciudadano', error: err }),
  );
}
