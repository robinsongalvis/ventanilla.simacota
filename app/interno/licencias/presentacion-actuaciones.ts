/**
 * Presentación de `Actuacion[]` como riel de `EventoTimeline` — extraído
 * de `fixtures.ts` (bloque "Integración UI y demo") para que la MISMA
 * función sirva a los fixtures (preview de componentes) y a la Pantalla 02
 * real (`[expedienteId]/DetalleLicenciaClient.tsx`) sin duplicar el mapa
 * de etiquetas ni el orden cronológico. Función PURA de presentación —
 * no calcula ningún término, solo traduce hechos ya ocurridos a texto.
 */

import type { Actuacion, OrigenActuacion } from '@/lib/motor-expedientes/tipos';
import { formatFechaColombia } from '@/lib/fecha-colombia';
import type { EventoTimelineItem } from './tipos';

export const TITULO_ACTUACION: Record<string, string> = {
  'radicacion-debida-forma': 'Radicación en debida forma',
  'acta-observaciones': 'Acta de observaciones',
  'respuesta-subsanacion': 'Respuesta de subsanación',
  'modificacion-solicitud': 'Modificación de la solicitud',
};

export const TIPO_TIMELINE: Record<string, EventoTimelineItem['tipo']> = {
  'radicacion-debida-forma': 'RADICACION',
  'acta-observaciones': 'ACTA',
  'respuesta-subsanacion': 'SUBSANACION',
  'modificacion-solicitud': 'SUBSANACION',
};

/**
 * Construye el timeline de presentación a partir de la trazabilidad REAL
 * (`Actuacion[]`). `origenExpediente` controla si se añade la fila de
 * "Vencimiento calculado": para `RECONSTRUIDO` nunca se añade (R9 — no hay
 * término que proyectar sobre un histórico migrado), igual que hacía
 * `fixtures.ts` antes de este extraído.
 */
export function construirTimelineDesdeActuaciones(
  actuaciones: Actuacion[],
  origenExpediente: OrigenActuacion | undefined,
  vigente: Date | null,
): EventoTimelineItem[] {
  const items: EventoTimelineItem[] = actuaciones
    .slice()
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    .map((a) => ({
      tipo: TIPO_TIMELINE[a.tipo] ?? 'SUBSANACION',
      titulo: TITULO_ACTUACION[a.tipo] ?? a.tipo,
      meta: a.detalle ? `${formatFechaColombia(a.fecha)} · ${a.detalle}` : formatFechaColombia(a.fecha),
    }));

  if (origenExpediente !== 'RECONSTRUIDO' && vigente) {
    items.push({
      tipo: 'VENCIMIENTO_CALCULADO',
      titulo: `Vencimiento calculado: ${formatFechaColombia(vigente)}`,
      meta: 'Proyección, nunca almacenado — se recalcula en cada consulta a partir de los hechos anteriores.',
    });
  }

  return items;
}
