'use client';

import { useState } from 'react';
import type { EventoTimelineItem } from '../tipos';

const COLOR_POR_TIPO: Record<EventoTimelineItem['tipo'], string> = {
  APERTURA: '#64748B',             // gris — el expediente nace, todavía no pasa nada
  RADICACION: '#14532D',           // verde institucional
  COMPLETITUD: '#14532D',          // verde — es el hecho que ancla el término
  ACTA: '#D97706',                 // ámbar
  SUBSANACION: '#2563EB',          // azul
  // Tono INFO del sistema de diseño (`--color-info`, `app/globals.css`) —
  // una comunicación enviada es informativa, deliberadamente NO el verde de
  // éxito (Bloque A·A4/A5): no es un logro del trámite, es un aviso.
  COMUNICACION: 'var(--color-info)',
  // Punteado y GRIS, no rojo: ver abajo.
  VENCIMIENTO_CALCULADO: '#94A3B8',
};

/**
 * Riel vertical de la trazabilidad del expediente.
 *
 * ── LOS HECHOS EN LENGUAJE DE MOSTRADOR ──────────────────────────────────
 *
 * Antes esto imprimía el slug crudo de la actuación cuando no había título en
 * el mapa: el propietario vio en producción un evento que decía literalmente
 * `apertura-expediente`, con la jerga entera detrás — «handoff D2»,
 * «esPrueba: true», «candado R10». Eso es la traza interna del sistema puesta
 * delante de quien atiende a un ciudadano.
 *
 * Ahora cada evento dice QUÉ pasó en español, CUÁNDO y QUIÉN, y una línea con
 * lo que importa. La jerga no se borra —el auditor la necesita— sino que se
 * pliega tras «ⓘ Detalle técnico», en monoespaciada.
 *
 * ── EL VENCIMIENTO NO ES UN HECHO ─────────────────────────────────────────
 *
 * Era un punto ROJO, igual de sólido que los demás, y no es de la misma especie:
 * los otros ocurrieron, este es una proyección que se recalcula en cada consulta
 * y que un acta de observaciones suspende. Ahora es un círculo PUNTEADO y gris,
 * y lo dice con palabras: «si nada lo detiene».
 */
export function EventoTimeline({ eventos }: { eventos: EventoTimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {eventos.map((evento, i) => (
        <FilaEvento key={`${evento.tipo}-${i}`} evento={evento} esUltimo={i === eventos.length - 1} indice={i} />
      ))}
    </ol>
  );
}

function FilaEvento({
  evento,
  esUltimo,
  indice,
}: {
  evento: EventoTimelineItem;
  esUltimo: boolean;
  indice: number;
}) {
  const [tecnicoAbierto, setTecnicoAbierto] = useState(false);
  const esProyeccion = evento.tipo === 'VENCIMIENTO_CALCULADO';
  const idTecnico = `evento-tecnico-${indice}`;

  return (
    <li className="relative pl-6 pb-5 last:pb-0">
      {!esUltimo && (
        <span
          aria-hidden="true"
          className="absolute left-[5px] top-3 bottom-0 w-px"
          style={{ background: 'var(--color-border)' }}
        />
      )}
      {/* PUNTO SÓLIDO para lo que ocurrió; CÍRCULO PUNTEADO para lo que solo se
          proyecta. La forma distingue las dos especies sin leer nada. */}
      <span
        aria-hidden="true"
        /* Asidero ESTABLE para las pruebas. Antes se localizaba como «el último
           span[aria-hidden] de la fila», y al añadir el icono del detalle
           técnico —que va después— esa heurística empezó a agarrar el icono en
           vez del punto. Depender del ORDEN del DOM es frágil; un atributo
           propio no se mueve. */
        data-punto-timeline
        className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white"
        style={
          esProyeccion
            ? { background: 'transparent', border: `1.5px dashed ${COLOR_POR_TIPO[evento.tipo]}` }
            : { background: COLOR_POR_TIPO[evento.tipo] }
        }
      />

      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        {evento.titulo}
      </p>

      {/* CUÁNDO y QUIÉN, juntos y discretos. */}
      {(evento.cuando || evento.quien) && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {evento.cuando}
          {evento.cuando && evento.quien && ' · '}
          {evento.quien}
        </p>
      )}

      {/* LA LÍNEA QUE IMPORTA. */}
      {evento.resumen && (
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {evento.resumen}
        </p>
      )}

      {/* Compatibilidad con eventos que aún no traen los campos nuevos: si no
          hay `resumen` ni `cuando`, se muestra el `meta` de siempre en vez de
          dejar la fila muda. */}
      {!evento.resumen && !evento.cuando && evento.meta && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {evento.meta}
        </p>
      )}

      {/* LA JERGA, PLEGADA. No se borra: el auditor la necesita para saber por
          qué el sistema hizo lo que hizo. */}
      {evento.detalleTecnico && (
        <>
          <button
            type="button"
            onClick={() => setTecnicoAbierto((v) => !v)}
            aria-expanded={tecnicoAbierto}
            aria-controls={idTecnico}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 rounded"
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
    </li>
  );
}
