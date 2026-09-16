'use client';

import { useState } from 'react';
import type { EventoTimelineItem } from '../tipos';
import {
  construirEventosVisuales,
  ESTADOS_VISUALES,
  FONDO_EVENTO_ACTUAL,
  type ContextoEstadoExpediente,
  type EventoVisual,
} from '../estado-visual-evento';
import { LeyendaEstados } from './LeyendaEstados';

/**
 * Riel vertical de la trazabilidad del expediente.
 *
 * ── SEMÁNTICA DE ESTADOS, NO DE ESPECIE ──────────────────────────────────
 *
 * Antes el color salía del `tipo` de la actuación (APERTURA, RADICACION…), así
 * que no se leía en qué ESTADO estaba cada evento y el paso actual se confundía
 * con un hito ya cumplido. Ahora cada evento se pinta por su ESTADO VISUAL
 * —completado, en curso, proyectado, atención…— con un color, un chip de texto
 * (para no depender solo del color) y, en el evento ACTUAL, una jerarquía
 * mayor: punto más grande, halo, fondo tenue y borde lateral.
 *
 * La traducción de especie a estado vive en `../estado-visual-evento.ts`, capa
 * de presentación PURA e independiente del cálculo jurídico. Aquí solo se
 * dibuja.
 *
 * ── LOS HECHOS EN LENGUAJE DE MOSTRADOR ──────────────────────────────────
 *
 * Cada evento dice QUÉ pasó en español, CUÁNDO y QUIÉN, y una línea con lo que
 * importa. La jerga se pliega tras «ⓘ Detalle técnico», en monoespaciada — el
 * auditor la necesita, el funcionario no tropieza con ella.
 *
 * ── EL VENCIMIENTO NO ES UN HECHO ─────────────────────────────────────────
 *
 * Es una PROYECCIÓN que se recalcula en cada consulta y que un acta de
 * observaciones suspende. Se pinta como `projected` (morado), con círculo
 * PUNTEADO y su chip «PROYECTADO», nunca como una actuación histórica.
 */
export function EventoTimeline({
  eventos,
  contexto,
  leyenda = false,
}: {
  eventos: EventoTimelineItem[];
  /**
   * Estado jurídico + completitud. Cuando se da y el expediente sigue en
   * trámite, el riel marca la fase ACTUAL como un evento «en curso». Opcional:
   * sin él, el riel se dibuja igual, solo sin ese marcado.
   */
  contexto?: ContextoEstadoExpediente;
  /** Muestra la leyenda «Estado del expediente» encima del riel. */
  leyenda?: boolean;
}) {
  const visuales = construirEventosVisuales(eventos, contexto);
  return (
    <div className="flex flex-col gap-3">
      {leyenda && <LeyendaEstados />}
      <ol className="flex flex-col">
        {visuales.map((evento, i) => (
          <FilaEvento
            key={`${evento.estadoVisual}-${i}`}
            evento={evento}
            esUltimo={i === visuales.length - 1}
            siguienteEsProyeccion={visuales[i + 1]?.estadoVisual === 'projected'}
            indice={i}
          />
        ))}
      </ol>
    </div>
  );
}

function FilaEvento({
  evento,
  esUltimo,
  siguienteEsProyeccion,
  indice,
}: {
  evento: EventoVisual;
  esUltimo: boolean;
  siguienteEsProyeccion: boolean;
  indice: number;
}) {
  const [tecnicoAbierto, setTecnicoAbierto] = useState(false);
  const def = ESTADOS_VISUALES[evento.estadoVisual];
  const esProyeccion = evento.estadoVisual === 'projected';
  const idTecnico = `evento-tecnico-${indice}`;

  return (
    <li className="relative pb-5 last:pb-0">
      {/* RIEL VERTICAL — continuo entre hechos, PUNTEADO hacia la proyección
          (que aún no ocurrió). Más grueso y centrado bajo el punto. */}
      {!esUltimo && (
        <span
          aria-hidden="true"
          className="absolute left-[6px] top-4 bottom-0 w-0.5"
          style={
            siguienteEsProyeccion
              ? { backgroundImage: `repeating-linear-gradient(var(--color-border) 0 4px, transparent 4px 8px)` }
              : { background: 'var(--color-border-strong, var(--color-border))' }
          }
        />
      )}

      {/* EL PUNTO — su forma y su color dicen el estado sin leer nada.
          `data-punto-timeline`: asidero ESTABLE para las pruebas (no depende
          del orden del DOM). */}
      <span
        aria-hidden="true"
        data-punto-timeline
        className="absolute left-0 top-0.5 flex items-center justify-center rounded-full ring-2 ring-white h-3.5 w-3.5"
        style={
          esProyeccion
            ? { background: 'transparent', border: `1.5px dashed ${def.color}` }
            : evento.esActual
              ? { background: def.color, boxShadow: `0 0 0 4px ${FONDO_EVENTO_ACTUAL.replace('0.06', '0.20')}` }
              : { background: def.color }
        }
      >
        {evento.estadoVisual === 'completed' && (
          <span className="text-white leading-none" style={{ fontSize: '8px' }} aria-hidden>✓</span>
        )}
        {evento.esActual && <span className="rounded-full bg-white" style={{ width: 5, height: 5 }} aria-hidden />}
        {evento.estadoVisual === 'warning' && (
          <span className="text-white font-black leading-none" style={{ fontSize: '9px' }} aria-hidden>!</span>
        )}
      </span>

      {/* CONTENIDO — para el evento ACTUAL, en una tarjeta tenue con borde
          lateral; para los demás, alineado a la derecha del punto. */}
      <div
        className={evento.esActual ? 'microtarjeta ml-6 rounded-lg px-3 py-2' : 'pl-6'}
        style={
          evento.esActual
            ? { background: FONDO_EVENTO_ACTUAL, border: `1px solid ${def.chipFondo}`, borderLeft: `3px solid ${def.color}` }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p
            className="text-sm"
            style={{ color: 'var(--text-primary)', fontWeight: evento.esActual ? 800 : 700 }}
          >
            {evento.titulo}
          </p>
          <ChipEstado def={def} />
        </div>

        {(evento.cuando || evento.quien) && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {evento.cuando}
            {evento.cuando && evento.quien && ' · '}
            {evento.quien}
          </p>
        )}

        {evento.resumen && (
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {evento.resumen}
          </p>
        )}

        {!evento.resumen && !evento.cuando && evento.meta && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {evento.meta}
          </p>
        )}

        {evento.detalleTecnico && (
          <>
            <button
              type="button"
              onClick={() => setTecnicoAbierto((v) => !v)}
              aria-expanded={tecnicoAbierto}
              aria-controls={idTecnico}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 rounded"
              style={{ color: '#667085' }}
            >
              <span aria-hidden>ⓘ</span>
              {tecnicoAbierto ? 'Ocultar detalle técnico' : 'Detalle técnico'}
            </button>
            <p
              id={idTecnico}
              hidden={!tecnicoAbierto}
              className="mt-1 rounded px-2 py-1.5 text-[11px] font-mono leading-relaxed"
              style={{ background: 'var(--bg-surface-2)', color: 'var(--text-secondary)' }}
            >
              {evento.detalleTecnico}
            </p>
          </>
        )}
      </div>
    </li>
  );
}

/** El chip textual del estado — redundante al color, para no depender de él. */
function ChipEstado({ def }: { def: (typeof ESTADOS_VISUALES)[keyof typeof ESTADOS_VISUALES] }) {
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: def.chipFondo, color: def.chipTexto }}
    >
      {def.etiqueta}
    </span>
  );
}
