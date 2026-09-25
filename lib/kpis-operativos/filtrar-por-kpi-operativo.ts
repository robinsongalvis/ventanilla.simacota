import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { fechaResolucion, fechaYmdColombia } from './calcular-kpis-operativos';
import { ESTADOS_ACTIVOS, ESTADOS_CERRADOS as ESTADOS_RESUELTOS } from '@/lib/radicado-estados';

/**
 * Panel Operativo Fase 2 — filtro operativo activo en la barra
 * secundaria. Se aplica DESPUÉS del filtro MIPG (los dos se combinan;
 * solo uno operativo puede estar activo a la vez).
 */

export type FiltroKpiOperativo =
  | 'NINGUNO'
  | 'HOY'
  | 'SIN_ASIGNAR'
  | 'SIN_SELLAR'
  | 'CORREO_FALLIDO'
  | 'RESUELTOS_HOY';

const DIAS_MS = 24 * 60 * 60 * 1000;
const VENTANA_SIN_SELLAR_MS = 30 * DIAS_MS;

function esActivo(r: VentanillaRadicado): boolean {
  return ESTADOS_ACTIVOS.has(r.estadoActual);
}

function tienePdfSinSellar(r: VentanillaRadicado): boolean {
  return r.archivos.some((a) => a.tipo === 'application/pdf' && !a.sellado);
}

/**
 * Aplica el filtro operativo activo. Idéntica lógica a
 * `calcularKpisOperativos` para garantizar consistencia entre el
 * contador y la lista visible.
 */
export function filtrarPorKpiOperativo(
  radicados: VentanillaRadicado[],
  filtro: FiltroKpiOperativo,
  ahora: Date = new Date(),
): VentanillaRadicado[] {
  if (filtro === 'NINGUNO') return radicados;

  const hoyYmd = fechaYmdColombia(ahora);
  const limiteSinSellarMs = ahora.getTime() - VENTANA_SIN_SELLAR_MS;

  switch (filtro) {
    case 'HOY':
      return radicados.filter(
        (r) => r.control?.fechaRadicado
          && fechaYmdColombia(r.control.fechaRadicado) === hoyYmd,
      );

    case 'SIN_ASIGNAR':
      return radicados.filter(
        (r) => r.estadoActual === 'PENDIENTE'
          && !r.clasificacion?.funcionarioResponsableUid,
      );

    case 'SIN_SELLAR':
      return radicados.filter((r) => {
        if (!esActivo(r) || !tienePdfSinSellar(r)) return false;
        const fechaMs = r.control?.fechaRadicado
          ? new Date(r.control.fechaRadicado).getTime()
          : 0;
        return !Number.isNaN(fechaMs) && fechaMs >= limiteSinSellarMs;
      });

    case 'CORREO_FALLIDO':
      return radicados.filter((r) => r.alertaNotificacionFallida === true);

    case 'RESUELTOS_HOY':
      return radicados.filter((r) => {
        if (!ESTADOS_RESUELTOS.has(r.estadoActual)) return false;
        const fecha = fechaResolucion(r);
        return Boolean(fecha) && fechaYmdColombia(fecha as string) === hoyYmd;
      });
  }
}
