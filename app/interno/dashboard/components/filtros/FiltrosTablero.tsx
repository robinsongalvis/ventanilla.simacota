'use client';

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════
   Rediseño Sala de operaciones · Fase 3 — Filtros del listado EN VIVO.

   Reorganización PURAMENTE VISUAL de los filtros que ya existen (MIPG +
   operativos + identidad + dependencia). NO agrega lógica de filtrado ni
   toca la «Búsqueda avanzada» histórica: cada chip llama a los MISMOS
   setters del store/estado que ya usaba la banda «Estado operativo».

   Piezas:
   - `ChipFiltro`: pastilla con conteo y punto semántico; la SELECCIÓN usa
     verde institucional suave (#E8F3EC / #17643A), nunca verde sólido.
   - `FiltrosRapidos`: fila visible con los filtros frecuentes + botón
     «Filtros avanzados» con contador de filtros activos.
   - `PanelFiltrosAvanzados`: contenedor colapsable con el resto de filtros
     agrupados por categoría (el «resto» que no debe vivir permanentemente
     en pantalla, §4).
══════════════════════════════════════════════════════════════ */

export type TonoFiltro = 'rojo' | 'ambar' | 'verde' | 'azul' | 'neutral';

const PUNTO_TONO: Record<TonoFiltro, string> = {
  rojo:    '#DC2626',
  ambar:   '#D97706',
  verde:   '#16A34A',
  azul:    '#2563EB',
  neutral: '#94A3B8',
};

export interface ChipFiltroProps {
  label: string;
  valor?: number;
  activo: boolean;
  tono?: TonoFiltro;
  onClick: () => void;
  /** Conteo 0 y no activo → atenuado y no clicable (no tiene sentido filtrar por vacío). */
  deshabilitado?: boolean;
  title?: string;
}

export function ChipFiltro({ label, valor, activo, tono = 'neutral', onClick, deshabilitado = false, title }: ChipFiltroProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={deshabilitado}
      aria-pressed={activo}
      title={title}
      className="micro-card shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 motion-reduce:transition-none"
      style={{
        background: activo ? '#E8F3EC' : '#FFFFFF',
        color:      activo ? '#17643A' : '#1F2933',
        borderColor: activo ? '#17643A' : '#D9E2D9',
        opacity: deshabilitado ? 0.5 : 1,
      }}
    >
      {!activo && (
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PUNTO_TONO[tono] }} />
      )}
      <span>{label}</span>
      {typeof valor === 'number' && (
        <span className="tabular-nums font-bold" style={{ color: activo ? '#17643A' : '#667085' }}>{valor}</span>
      )}
    </button>
  );
}

export interface FiltroChipConfig {
  id: string;
  label: string;
  valor?: number;
  tono?: TonoFiltro;
  activo: boolean;
  onClick: () => void;
  deshabilitado?: boolean;
  title?: string;
}

export interface FiltrosRapidosProps {
  /** Filtros frecuentes, siempre visibles. */
  items: FiltroChipConfig[];
  /** Nº de filtros del listado en vivo activos (para el badge del botón). */
  filtrosActivos: number;
  avanzadosAbierto: boolean;
  onToggleAvanzados: () => void;
  idPanel: string;
}

export function FiltrosRapidos({ items, filtrosActivos, avanzadosAbierto, onToggleAvanzados, idPanel }: FiltrosRapidosProps) {
  return (
    <div className="bg-white px-3 sm:px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #E5E7EB' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
          Filtros rápidos
        </span>
        {items.map((it) => (
          <ChipFiltro key={it.id} {...it} />
        ))}
        <button
          type="button"
          onClick={onToggleAvanzados}
          aria-expanded={avanzadosAbierto}
          aria-controls={idPanel}
          className="micro-card shrink-0 ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 motion-reduce:transition-none"
          style={avanzadosAbierto || filtrosActivos > 0
            ? { background: '#E8F3EC', color: '#17643A', borderColor: '#17643A' }
            : { background: '#FFFFFF', color: '#17643A', borderColor: '#D9E2D9' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filtros avanzados
          {filtrosActivos > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white tabular-nums" style={{ background: '#17643A' }}>
              {filtrosActivos}
            </span>
          )}
          <svg className={`w-3.5 h-3.5 transition-transform motion-reduce:transition-none ${avanzadosAbierto ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export interface GrupoFiltro {
  titulo: string;
  contenido: ReactNode;
}

export interface PanelFiltrosAvanzadosProps {
  abierto: boolean;
  grupos: GrupoFiltro[];
  hayFiltros: boolean;
  onLimpiar: () => void;
  idPanel: string;
}

export function PanelFiltrosAvanzados({ abierto, grupos, hayFiltros, onLimpiar, idPanel }: PanelFiltrosAvanzadosProps) {
  return (
    <div
      id={idPanel}
      className="grid shrink-0 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="bg-white px-3 sm:px-4 py-3" style={{ borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex flex-col gap-3">
            {grupos.map((g) => (
              <div key={g.titulo} className="flex flex-col gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{g.titulo}</span>
                <div className="flex items-center gap-2 flex-wrap">{g.contenido}</div>
              </div>
            ))}
          </div>
          {hayFiltros && (
            <div className="mt-3 pt-2 flex justify-end" style={{ borderTop: '1px solid #F1F5F9' }}>
              <button
                type="button"
                onClick={onLimpiar}
                className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                style={{ background: 'white', color: '#854D0E', borderColor: '#FBBF24' }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
