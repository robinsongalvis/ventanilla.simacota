import type { EventoTimelineItem } from '../tipos';

const COLOR_POR_TIPO: Record<EventoTimelineItem['tipo'], string> = {
  RADICACION: '#14532D',           // verde institucional
  ACTA: '#D97706',                 // ámbar
  SUBSANACION: '#2563EB',          // azul
  // Tono INFO del sistema de diseño (`--color-info`, `app/globals.css`) —
  // una comunicación enviada es informativa, deliberadamente NO el verde de
  // éxito (Bloque A·A4/A5): no es un logro del trámite, es un aviso.
  COMUNICACION: 'var(--color-info)',
  VENCIMIENTO_CALCULADO: 'var(--color-danger)', // rojo — es una proyección, nunca un hecho
};

/**
 * Riel vertical de la trazabilidad del expediente (Pantalla 02, panel
 * historial). Los eventos son los HECHOS (radicación, acta, subsanación);
 * el último ítem ("Vencimiento calculado") es la única fila que representa
 * una PROYECCIÓN — nunca se persiste, se recalcula en cada render a partir
 * de los hechos (ver `AvisoPoliticaSubsanacion` y `fixtures.ts`).
 */
export function EventoTimeline({ eventos }: { eventos: EventoTimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {eventos.map((evento, i) => (
        <li key={`${evento.tipo}-${i}`} className="relative pl-6 pb-5 last:pb-0">
          {i < eventos.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-[5px] top-3 bottom-0 w-px"
              style={{ background: 'var(--color-border)' }}
            />
          )}
          <span
            aria-hidden="true"
            className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ background: COLOR_POR_TIPO[evento.tipo] }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {evento.titulo}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {evento.meta}
          </p>
        </li>
      ))}
    </ol>
  );
}
