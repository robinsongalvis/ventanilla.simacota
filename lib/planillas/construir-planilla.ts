import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type {
  FilaPlanilla,
  PlanillaReparto,
} from '@/src/types/planilla';

/**
 * Planilla de reparto — capa pura de construcción.
 *
 * Sin React, sin Firestore: recibe radicados y devuelve la planilla
 * lista para persistir. La selección de pendientes reutiliza el mismo
 * criterio en UI y API para que los números nunca se contradigan.
 */

/** Serie anual propia, legible en papel: PL-2026-0007. */
export function formatearPlanillaId(consecutivo: number, fecha: Date): string {
  const year = fecha.getFullYear();
  return `PL-${year}-${String(consecutivo).padStart(4, '0')}`;
}

/**
 * Un radicado entra al reparto físico cuando nació en papel
 * (FISICO_ESCANER) y aún nadie ha registrado su entrega ni viaja en
 * una planilla abierta.
 */
export function esPendienteDeReparto(
  radicado: VentanillaRadicado,
  idsEnPlanillasAbiertas: ReadonlySet<string>,
): boolean {
  if (radicado.control?.origen !== 'FISICO_ESCANER') return false;
  if (radicado.entregaFisica) return false;
  return !idsEnPlanillasAbiertas.has(radicado.radicadoId);
}

/** Ids de radicados que viajan en planillas todavía POR_ENTREGAR. */
export function idsEnPlanillasAbiertas(
  planillas: ReadonlyArray<Pick<PlanillaReparto, 'estado' | 'filas'>>,
): Set<string> {
  const ids = new Set<string>();
  for (const planilla of planillas) {
    if (planilla.estado !== 'POR_ENTREGAR') continue;
    for (const fila of planilla.filas) {
      if (fila.estado === 'PENDIENTE') ids.add(fila.radicadoId);
    }
  }
  return ids;
}

export function radicadosPendientesDeReparto(
  radicados: ReadonlyArray<VentanillaRadicado>,
  planillas: ReadonlyArray<Pick<PlanillaReparto, 'estado' | 'filas'>>,
): VentanillaRadicado[] {
  const enPlanilla = idsEnPlanillasAbiertas(planillas);
  return radicados.filter((r) => esPendienteDeReparto(r, enPlanilla));
}

/**
 * La planilla viaja en papel por toda la alcaldía: los radicados
 * anónimos o de identidad reservada jamás imprimen el nombre.
 */
export function nombreParaPlanilla(radicado: VentanillaRadicado): string {
  const protegido = radicado.esAnonimo === true
    || radicado.identidadReservada === true
    || radicado.tipoPresentacion === 'ANONIMA'
    || radicado.tipoPresentacion === 'RESERVADA';
  if (protegido) return 'Identidad reservada';
  return radicado.solicitante?.nombreCompleto?.trim() || 'Sin nombre registrado';
}

export function filaDesdeRadicado(radicado: VentanillaRadicado): FilaPlanilla {
  return {
    radicadoId: radicado.radicadoId,
    dependenciaDestino: radicado.clasificacion.oficinaDestino,
    areaAsignada: typeof radicado.clasificacion.areaResponsable === 'string'
      && radicado.clasificacion.areaResponsable
      ? radicado.clasificacion.areaResponsable
      : null,
    asunto: radicado.detalle?.asunto?.trim() || 'Sin asunto',
    solicitanteNombre: nombreParaPlanilla(radicado),
    numeroFolios: radicado.detalle?.numeroFolios ?? 0,
    anexosDescripcion: radicado.detalle?.anexosDescripcion ?? null,
    fechaRadicado: radicado.control?.fechaRadicado ?? '',
    horaRadicado: radicado.control?.horaRadicado ?? '',
    estado: 'PENDIENTE',
    entrega: null,
  };
}

/**
 * Construye la planilla del día: UNA sola con todo, filas agrupadas
 * por dependencia (parámetro cerrado con la funcionaria) y, dentro de
 * cada grupo, en orden de radicación.
 */
export function construirPlanilla(
  radicados: ReadonlyArray<VentanillaRadicado>,
  consecutivo: number,
  generadaPor: { uid: string; nombre: string },
  ahora: Date,
): PlanillaReparto {
  const filas = radicados
    .map(filaDesdeRadicado)
    .sort((a, b) =>
      a.dependenciaDestino === b.dependenciaDestino
        ? a.fechaRadicado.localeCompare(b.fechaRadicado)
        : a.dependenciaDestino.localeCompare(b.dependenciaDestino));

  return {
    planillaId: formatearPlanillaId(consecutivo, ahora),
    consecutivo,
    anio: ahora.getFullYear(),
    fechaGeneracion: ahora.toISOString(),
    generadaPor,
    estado: 'POR_ENTREGAR',
    filas,
    escaneoPath: null,
    escaneoNombre: null,
    cierre: null,
    anulacion: null,
  };
}
