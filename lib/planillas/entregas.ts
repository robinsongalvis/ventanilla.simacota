import type {
  EntregaSolicitada,
  FilaPlanilla,
  PlanillaReparto,
} from '@/src/types/planilla';

/**
 * Planilla de reparto — capa pura del ciclo de vida.
 *
 * Registrar entregas por fila, cerrar el día (lo no entregado se
 * LIBERA y vuelve a pendientes) y anular. Funciones puras: reciben la
 * planilla y devuelven una nueva; la persistencia vive en la API.
 */

export interface ResultadoEntregas {
  planilla: PlanillaReparto;
  /** Filas que quedaron ENTREGADA en esta operación (para trazabilidad). */
  entregadas: FilaPlanilla[];
  /** Filas LIBERADA por el cierre (ruedan a la planilla siguiente). */
  liberadas: FilaPlanilla[];
}

/** Valida una entrega contra la planilla; null si es aplicable. */
export function errorDeEntrega(
  planilla: PlanillaReparto,
  entrega: EntregaSolicitada,
): string | null {
  if (planilla.estado !== 'POR_ENTREGAR') {
    return `La planilla ${planilla.planillaId} ya no está por entregar.`;
  }
  const fila = planilla.filas.find((f) => f.radicadoId === entrega.radicadoId);
  if (!fila) {
    return `El radicado ${entrega.radicadoId} no está en la planilla ${planilla.planillaId}.`;
  }
  if (fila.estado !== 'PENDIENTE') {
    return `El radicado ${entrega.radicadoId} ya fue gestionado en esta planilla.`;
  }
  if (!entrega.recibidoPor?.trim()) {
    return `Falta el nombre de quien recibió el radicado ${entrega.radicadoId}.`;
  }
  return null;
}

/**
 * Aplica entregas por fila y, si `cerrar`, libera lo pendiente y
 * cierra la planilla. Lanza en la primera entrega inválida: la
 * operación es todo-o-nada para que el papel y el sistema no se
 * desincronicen.
 */
export function aplicarEntregas(
  planilla: PlanillaReparto,
  entregas: ReadonlyArray<EntregaSolicitada>,
  opciones: {
    cerrar: boolean;
    ahora: Date;
    actor: { uid: string; nombre: string };
  },
): ResultadoEntregas {
  for (const entrega of entregas) {
    const error = errorDeEntrega(planilla, entrega);
    if (error) throw new Error(error);
  }
  const vistos = new Set<string>();
  for (const entrega of entregas) {
    if (vistos.has(entrega.radicadoId)) {
      throw new Error(`Entrega duplicada para el radicado ${entrega.radicadoId}.`);
    }
    vistos.add(entrega.radicadoId);
  }

  const porRadicado = new Map(entregas.map((e) => [e.radicadoId, e]));
  const fechaIso = opciones.ahora.toISOString();
  const entregadas: FilaPlanilla[] = [];
  const liberadas: FilaPlanilla[] = [];

  const filas = planilla.filas.map((fila): FilaPlanilla => {
    const entrega = porRadicado.get(fila.radicadoId);
    if (entrega && fila.estado === 'PENDIENTE') {
      const entregada: FilaPlanilla = {
        ...fila,
        estado: 'ENTREGADA',
        entrega: {
          fecha: fechaIso,
          recibidoPor: entrega.recibidoPor.trim(),
          nota: entrega.nota?.trim() || null,
        },
      };
      entregadas.push(entregada);
      return entregada;
    }
    if (opciones.cerrar && fila.estado === 'PENDIENTE') {
      const liberada: FilaPlanilla = { ...fila, estado: 'LIBERADA' };
      liberadas.push(liberada);
      return liberada;
    }
    return fila;
  });

  const quedanPendientes = filas.some((f) => f.estado === 'PENDIENTE');

  return {
    planilla: {
      ...planilla,
      filas,
      estado: opciones.cerrar || !quedanPendientes ? 'CERRADA' : 'POR_ENTREGAR',
      cierre: opciones.cerrar || !quedanPendientes
        ? { fecha: fechaIso, actorUid: opciones.actor.uid, actorNombre: opciones.actor.nombre }
        : null,
    },
    entregadas,
    liberadas,
  };
}

/**
 * Anular solo tiene sentido antes de cualquier entrega: si ya hay una
 * firma en el papel, el registro es evidencia y no se borra (patrón
 * GSC: anulable únicamente en estado "Por entregar").
 */
export function puedeAnular(planilla: PlanillaReparto): boolean {
  return planilla.estado === 'POR_ENTREGAR'
    && planilla.filas.every((f) => f.estado !== 'ENTREGADA');
}

export function anularPlanilla(
  planilla: PlanillaReparto,
  motivo: string,
  ahora: Date,
  actor: { uid: string; nombre: string },
): PlanillaReparto {
  if (!puedeAnular(planilla)) {
    throw new Error(`La planilla ${planilla.planillaId} ya tiene entregas o está cerrada; no se puede anular.`);
  }
  if (!motivo.trim()) {
    throw new Error('La anulación necesita un motivo.');
  }
  return {
    ...planilla,
    estado: 'ANULADA',
    filas: planilla.filas.map((f) =>
      f.estado === 'PENDIENTE' ? { ...f, estado: 'LIBERADA' } : f),
    anulacion: {
      fecha: ahora.toISOString(),
      actorUid: actor.uid,
      actorNombre: actor.nombre,
      motivo: motivo.trim(),
    },
  };
}

/** Conteos para los chips de la vista Reparto. */
export function resumenPlanilla(planilla: PlanillaReparto): {
  total: number;
  pendientes: number;
  entregadas: number;
  liberadas: number;
} {
  let pendientes = 0;
  let entregadas = 0;
  let liberadas = 0;
  for (const fila of planilla.filas) {
    if (fila.estado === 'PENDIENTE') pendientes += 1;
    else if (fila.estado === 'ENTREGADA') entregadas += 1;
    else liberadas += 1;
  }
  return { total: planilla.filas.length, pendientes, entregadas, liberadas };
}
