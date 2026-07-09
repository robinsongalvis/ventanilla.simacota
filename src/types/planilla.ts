import type { TenantId } from '@/src/types/radicado';

/**
 * Sprint Planilla de reparto — el papel que viaja con la funcionaria.
 *
 * Digitaliza el control de entrega física de correspondencia (patrón
 * GSC Bucaramanga, formato F-GSC-8200-238-37-001) en talla Simacota:
 * UNA planilla del día con todo, registrada solo por Recepción, con
 * evidencia escaneada de las firmas de recibido.
 *
 * Parámetros cerrados validados con la funcionaria (jul 2026):
 *   1. Planilla única diaria agrupada por dependencia (no una por oficina).
 *   2. Evidencia por escáner (PDF), no foto.
 *   3. Solo RECEPCIONISTA/ADMIN registran entregas.
 *
 * El documento es de una sola escritura conceptual: se genera, se
 * registran entregas por fila y se cierra. Lo no entregado se LIBERA
 * y vuelve al grupo de pendientes para la planilla del día siguiente
 * ("si la oficina está cerrada, se espera").
 */

export type EstadoPlanilla = 'POR_ENTREGAR' | 'CERRADA' | 'ANULADA';

export type EstadoFilaPlanilla = 'PENDIENTE' | 'ENTREGADA' | 'LIBERADA';

/** Constancia de recibido de una fila: quién, cuándo y dónde. */
export interface EntregaFila {
  /** ISO del momento en que Recepción registró la entrega. */
  fecha: string;
  /** Nombre de quien recibió — puede ser cualquier persona de la oficina. */
  recibidoPor: string;
  /** Lugar u observación (entregas fuera del palacio municipal). */
  nota?: string | null;
}

export interface FilaPlanilla {
  radicadoId: string;
  dependenciaDestino: TenantId;
  asunto: string;
  /**
   * Nombre del solicitante o 'Identidad reservada' cuando el radicado
   * es anónimo o de identidad protegida — la planilla viaja en papel
   * por toda la alcaldía y no debe exponer datos protegidos.
   */
  solicitanteNombre: string;
  numeroFolios: number;
  anexosDescripcion: string | null;
  fechaRadicado: string;
  horaRadicado: string;
  estado: EstadoFilaPlanilla;
  entrega: EntregaFila | null;
}

export interface CierrePlanilla {
  fecha: string;
  actorUid: string;
  actorNombre: string;
}

export interface AnulacionPlanilla extends CierrePlanilla {
  motivo: string;
}

export interface PlanillaReparto {
  /** Serie propia `PL-{año}-{NNNN}` con contador anual (patrón 2-SAL). */
  planillaId: string;
  consecutivo: number;
  anio: number;
  fechaGeneracion: string;
  generadaPor: { uid: string; nombre: string };
  estado: EstadoPlanilla;
  filas: FilaPlanilla[];
  /** Path en Storage del escaneo de la hoja firmada (PDF), si ya se subió. */
  escaneoPath: string | null;
  escaneoNombre: string | null;
  cierre: CierrePlanilla | null;
  anulacion: AnulacionPlanilla | null;
}

/** Entrada de registro de entrega para una fila, tal como llega de la UI. */
export interface EntregaSolicitada {
  radicadoId: string;
  recibidoPor: string;
  nota?: string | null;
}
