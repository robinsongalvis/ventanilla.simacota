'use client';

import {
  resumirFiltrosActivos,
  type DimensionFiltro,
  type EstadoFiltros,
} from '@/lib/filtros-activos/resumir-filtros-activos';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 3A — Barra de filtros activos.

   Se muestra SOLO cuando hay al menos un filtro activo, sobre la lista
   de la bandeja. Cada chip lleva una "×" para quitar ese filtro
   individual; el botón "Limpiar todo" resetea las 5 dimensiones.

   Resuelve la confusión de "veo 1 pero dice 8": el usuario ve en claro
   qué está filtrando y lo limpia de un clic.
══════════════════════════════════════════════════════════════ */

export interface BarraFiltrosActivosProps {
  estado:            EstadoFiltros;
  onQuitarDimension: (dimension: DimensionFiltro) => void;
  onLimpiarTodo:     () => void;
}

export function BarraFiltrosActivos({
  estado,
  onQuitarDimension,
  onLimpiarTodo,
}: BarraFiltrosActivosProps) {
  const chips = resumirFiltrosActivos(estado);
  if (chips.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 flex-wrap px-3 sm:px-4 py-2 shrink-0"
      style={{ background: '#FEFCE8', borderBottom: '1px solid #FDE68A' }}
      role="region"
      aria-label="Filtros activos"
    >
      <span
        className="shrink-0 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: '#854D0E' }}
      >
        Filtrando por
      </span>

      {chips.map((chip) => (
        <span
          key={chip.dimension}
          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-[11px] font-semibold border"
          style={{ background: 'white', color: '#78350F', borderColor: '#FBBF24' }}
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onQuitarDimension(chip.dimension)}
            aria-label={`Quitar filtro ${chip.label}`}
            title={`Quitar filtro ${chip.label}`}
            className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
            style={{ color: '#92400E' }}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onLimpiarTodo}
        className="shrink-0 ml-auto text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
        style={{ background: 'white', color: '#854D0E', borderColor: '#FBBF24' }}
      >
        Limpiar todo
      </button>
    </div>
  );
}
