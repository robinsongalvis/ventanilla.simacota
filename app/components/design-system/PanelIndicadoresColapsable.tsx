'use client';

import type { ReactNode } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { Indicador, TONOS_INDICADOR, type IndicadorProps } from './Indicador';

/* ══════════════════════════════════════════════════════════════
   Design System — PanelIndicadoresColapsable (ADR-0046, Ola 2)
   Extraído del Tablero SIN cambios de DOM ni estilo. Agnóstico al
   módulo: título, ayuda e indicadores los pone quien lo usa.
══════════════════════════════════════════════════════════════ */

/**
 * Panel de indicadores colapsable (Resumen de trámites / Seguimiento de
 * gestión). Cerrado conserva los valores en una línea — se reduce el ruido,
 * no la información —; abierto muestra exactamente las mismas tarjetas.
 */
export function PanelIndicadoresColapsable({
  id,
  titulo,
  subtitulo,
  ayuda,
  accesorio,
  indicadores,
  abierto,
  onAlternar,
  clasesGrid,
}: {
  id: string;
  titulo: string;
  subtitulo: string;
  ayuda?: string;
  accesorio?: ReactNode;
  indicadores: IndicadorProps[];
  abierto: boolean;
  onAlternar: () => void;
  clasesGrid: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierto}
          aria-controls={id}
          className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-[var(--tema-fondo-f7f9fb)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${abierto ? '' : '-rotate-90'}`}
            style={{ color: 'var(--tema-texto-64748b)' }}
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>{titulo}</span>
          <span className="hidden text-[10px] sm:inline" style={{ color: 'var(--tema-texto-64748b)' }}>{subtitulo}</span>
        </button>
        {ayuda && (
          <span className="inline-flex cursor-help" style={{ color: 'var(--tema-texto-64748b)' }} title={ayuda}>
            <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">{ayuda}</span>
          </span>
        )}
        {accesorio}
        {!abierto && (
          <span className="ml-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
            {indicadores.map((ind) => (
              <span
                key={ind.etiqueta}
                className={`inline-flex items-baseline gap-1 whitespace-nowrap ${ind.activo ? 'underline underline-offset-2' : ''}`}
                style={{ color: TONOS_INDICADOR[ind.tono].texto }}
              >
                <span className="font-black tabular-nums">{ind.valor}</span>
                <span className="font-semibold">{ind.etiqueta.toLowerCase()}</span>
              </span>
            ))}
          </span>
        )}
      </div>
      {abierto && (
        <div id={id} className={`mt-1.5 grid min-w-0 gap-1.5 ${clasesGrid}`}>
          {indicadores.map((ind) => (
            <Indicador key={ind.etiqueta} {...ind} />
          ))}
        </div>
      )}
    </div>
  );
}
