import type { VentanillaRadicado, SuspensionTermino } from '@/src/types/ventanilla';
import type { AccionAuditoria } from '@/src/types/radicado';
import {
  dentroVentanaRequerimiento,
  plazoSubsanacion,
  plazoConProrroga,
  reactivarVencimiento,
  prorrogaEsOportuna,
  subsanacionVencida,
  diasRestantesHabiles,
} from '@/lib/tiempos-radicado';

/* ══════════════════════════════════════════════════════════════
   BM-B33 — Lógica de DECISIÓN de la subsanación (Ley 1755 Art. 17).

   Funciones PURAS: reciben el radicado + actor + `ahora` + payload y
   devuelven un "plan" (campos a actualizar + evento de trazabilidad) o
   un error {status, mensaje}. Toda la aritmética del reloj vive en
   `tiempos-radicado` (piezas 1 y 3). Las rutas solo orquestan IO/auth.

   El RELOJ es SERVER-SIDE: ninguna fecha/plazo se toma del cliente
   (decisión de Seguridad); `ahora` lo inyecta la ruta con `new Date()`.
══════════════════════════════════════════════════════════════ */

export const MOTIVO_MIN = 15;

export interface ActorSubsanacion {
  uid: string;
  nombre: string;
  rol: string;
}

export interface ErrorSubsanacion {
  status: number;
  mensaje: string;
}

export interface PlanSubsanacion {
  /** Campos con dot-notation para `.update()`. */
  update: Record<string, unknown>;
  /** Evento para `appendTrazabilidadAdmin`. */
  evento: { accion: AccionAuditoria; nota: string; metadata: Record<string, unknown> };
  /** Nuevo estado, si cambia (para notificaciones/UX). */
  nuevoEstado?: string;
}

export function esError(x: PlanSubsanacion | ErrorSubsanacion): x is ErrorSubsanacion {
  return (x as ErrorSubsanacion).status !== undefined;
}

/** Fecha límite vigente (con prórroga si la hubo). */
export function fechaLimiteEfectiva(s: SuspensionTermino): string | null {
  return s.prorroga?.solicitada ? s.prorroga.nuevaFechaLimite : (s.fechaLimiteSubsanacion ?? null);
}

/**
 * ¿El cron debe PROPONER desistimiento para este radicado? (no decide, propone).
 * Requiere: en subsanación activa, aún no propuesto, y plazo vencido (con
 * prórroga si la hubo). El cron NUNCA cambia el estado.
 */
export function debeProponerDesistimiento(radicado: VentanillaRadicado, ahora: Date): boolean {
  const s = radicado.termino?.suspension;
  if (!s?.activa || radicado.estadoActual !== 'EN_SUBSANACION') return false;
  if (s.desistimientoPropuesto) return false;
  const limite = fechaLimiteEfectiva(s);
  return !!limite && subsanacionVencida(limite, ahora);
}

/**
 * Plan de la PROPUESTA de desistimiento (marca de idempotencia + evento). No
 * toca `estadoActual` — la decisión sigue siendo humana (Principio 9).
 */
export function planPropuestaDesistimiento(radicado: VentanillaRadicado, ahora: Date): PlanSubsanacion {
  const s = radicado.termino!.suspension!;
  const limite = fechaLimiteEfectiva(s);
  return {
    update: { 'termino.suspension.desistimientoPropuesto': true, ultimaActualizacion: ahora.toISOString() },
    evento: {
      accion: 'DESISTIMIENTO_TACITO_PROPUESTO',
      nota: `El plazo de subsanación venció el ${limite}. Procede confirmar el desistimiento tácito mediante acto administrativo motivado (Ley 1755 Art. 17).`,
      metadata: { origen: 'cron', fechaLimiteEfectiva: limite },
    },
  };
}

/**
 * Requerir subsanación. `notificable` = el ciudadano puede ser notificado
 * (lo decide la ruta con `debeNotificarCiudadano` + email). Si es notificable,
 * el requerimiento se ancla YA (reloj server-side); si no (p. ej. ANONIMA), se
 * registra el requerimiento pero NO se suspende el término (sigue corriendo) —
 * queda pendiente de notificación por vía manual (fuera de alcance v3).
 */
export function planRequerirSubsanacion(
  radicado: VentanillaRadicado,
  actor: ActorSubsanacion,
  motivo: string,
  ahora: Date,
  notificable: boolean,
): PlanSubsanacion | ErrorSubsanacion {
  const motivoLimpio = motivo.trim();
  if (motivoLimpio.length < MOTIVO_MIN) {
    return { status: 400, mensaje: `Indica con claridad qué debe subsanar el ciudadano (mínimo ${MOTIVO_MIN} caracteres).` };
  }
  if (radicado.termino?.suspension?.activa) {
    return { status: 409, mensaje: 'El radicado ya está en subsanación; no se encadenan requerimientos.' };
  }
  const fechaRadicado = radicado.control?.fechaRadicado;
  if (!fechaRadicado || !dentroVentanaRequerimiento(fechaRadicado, ahora)) {
    return { status: 409, mensaje: 'El requerimiento solo procede dentro de los 10 días hábiles siguientes a la radicación (Ley 1755 Art. 17).' };
  }

  const nowIso = ahora.toISOString();
  const base: SuspensionTermino = {
    activa: false,
    fechaRequerimiento: nowIso,
    fechaNotificacion: null,
    fechaLimiteSubsanacion: null,
    diasHabilesRestantes: null,
    motivo: motivoLimpio,
    requeridoPor: { uid: actor.uid, nombre: actor.nombre },
    prorroga: null,
  };

  if (!notificable) {
    return {
      update: { 'termino.suspension': base, ultimaActualizacion: nowIso },
      evento: {
        accion: 'REQUERIMIENTO_SUBSANACION',
        nota: `Requerimiento de subsanación emitido (pendiente de notificación por vía manual): ${motivoLimpio}`,
        metadata: { actorRol: actor.rol, notificado: false },
      },
    };
  }

  // Notificable → anclar la suspensión con el reloj SERVER-SIDE.
  const dias = diasRestantesHabiles(radicado.termino!.fechaVencimiento, ahora);
  const fechaLimite = plazoSubsanacion(ahora).toISOString();
  const suspension: SuspensionTermino = {
    ...base,
    activa: true,
    fechaNotificacion: nowIso,
    fechaLimiteSubsanacion: fechaLimite,
    diasHabilesRestantes: dias,
  };
  return {
    update: { 'termino.suspension': suspension, estadoActual: 'EN_SUBSANACION', ultimaActualizacion: nowIso },
    nuevoEstado: 'EN_SUBSANACION',
    evento: {
      accion: 'SUBSANACION_NOTIFICADA',
      nota: `Requerimiento de subsanación notificado al ciudadano. Plazo de 1 mes hasta ${fechaLimite}. ${motivoLimpio}`,
      metadata: { actorRol: actor.rol, notificado: true, fechaLimiteSubsanacion: fechaLimite, diasHabilesRestantes: dias },
    },
  };
}

/** Prórroga del ciudadano: hasta 1 mes más, una sola vez, antes de vencer. */
export function planProrrogaSubsanacion(
  radicado: VentanillaRadicado,
  actor: ActorSubsanacion,
  ahora: Date,
): PlanSubsanacion | ErrorSubsanacion {
  const s = radicado.termino?.suspension;
  if (!s?.activa) return { status: 409, mensaje: 'No hay una subsanación activa que prorrogar.' };
  if (s.prorroga?.solicitada) return { status: 409, mensaje: 'La prórroga de subsanación ya fue concedida (procede una sola vez).' };
  if (!s.fechaLimiteSubsanacion || !prorrogaEsOportuna(s.fechaLimiteSubsanacion, ahora)) {
    return { status: 409, mensaje: 'La prórroga debe solicitarse antes de vencer el plazo de subsanación.' };
  }
  const nueva = plazoConProrroga(s.fechaLimiteSubsanacion).toISOString();
  const nowIso = ahora.toISOString();
  return {
    update: { 'termino.suspension.prorroga': { solicitada: true, fechaSolicitud: nowIso, nuevaFechaLimite: nueva }, ultimaActualizacion: nowIso },
    evento: {
      accion: 'PRORROGA_SUBSANACION',
      nota: `Prórroga de subsanación concedida; nuevo plazo hasta ${nueva}.`,
      metadata: { actorRol: actor.rol, nuevaFechaLimite: nueva },
    },
  };
}

/**
 * Reactivar el término tras subsanar. `suficiente` lo declara el FUNCIONARIO del
 * tenant (no recepción): subsanación parcial NO reactiva (decisión humana).
 */
export function planReactivarSubsanacion(
  radicado: VentanillaRadicado,
  actor: ActorSubsanacion,
  ahora: Date,
  suficiente: boolean,
): PlanSubsanacion | ErrorSubsanacion {
  const s = radicado.termino?.suspension;
  if (!s?.activa) return { status: 409, mensaje: 'No hay una subsanación activa que reactivar.' };
  if (!suficiente) {
    return { status: 400, mensaje: 'La subsanación no se declaró suficiente; el término permanece suspendido (subsanación parcial no reactiva).' };
  }
  const dias = s.diasHabilesRestantes ?? 0;
  const nuevoVenc = reactivarVencimiento(ahora, dias).toISOString();
  const nowIso = ahora.toISOString();
  return {
    update: {
      'termino.fechaVencimiento': nuevoVenc,
      'termino.suspension.activa': false,
      estadoActual: 'EN_PROCESO',
      ultimaActualizacion: nowIso,
    },
    nuevoEstado: 'EN_PROCESO',
    evento: {
      accion: 'SUBSANACION_RECIBIDA',
      nota: `Subsanación recibida y declarada suficiente. Término reanudado; nuevo vencimiento ${nuevoVenc}.`,
      metadata: { actorRol: actor.rol, fechaVencimientoNueva: nuevoVenc, diasHabilesRestantes: dias },
    },
  };
}

/**
 * Confirmar desistimiento tácito (acto motivado, decisión HUMANA). Solo procede
 * si venció el plazo (con prórroga si la hubo) y el radicado sigue en subsanación.
 */
export function planDesistimiento(
  radicado: VentanillaRadicado,
  actor: ActorSubsanacion,
  motivo: string,
  ahora: Date,
): PlanSubsanacion | ErrorSubsanacion {
  const motivoLimpio = motivo.trim();
  if (motivoLimpio.length < MOTIVO_MIN) {
    return { status: 400, mensaje: `El acto de desistimiento debe ser motivado (mínimo ${MOTIVO_MIN} caracteres).` };
  }
  const s = radicado.termino?.suspension;
  if (!s?.activa || radicado.estadoActual !== 'EN_SUBSANACION') {
    return { status: 409, mensaje: 'El radicado no está en subsanación.' };
  }
  const limite = fechaLimiteEfectiva(s);
  if (!limite || !subsanacionVencida(limite, ahora)) {
    return { status: 409, mensaje: 'El desistimiento tácito solo procede una vez vencido el plazo de subsanación (con su prórroga, si la hubo).' };
  }
  const nowIso = ahora.toISOString();
  return {
    update: { estadoActual: 'DESISTIDO', 'termino.suspension.activa': false, ultimaActualizacion: nowIso },
    nuevoEstado: 'DESISTIDO',
    evento: {
      accion: 'DESISTIMIENTO_TACITO_CONFIRMADO',
      nota: motivoLimpio,
      metadata: { actorRol: actor.rol, fechaLimiteEfectiva: limite },
    },
  };
}
