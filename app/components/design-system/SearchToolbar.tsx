'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — SearchToolbar

   Barra de búsqueda unificada para tableros y listados.
   Combina: input de búsqueda + filtros + acciones.
══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

interface SearchToolbarProps {
  /** Valor del input. */
  valor: string;
  /** Callback al cambiar el input. */
  onChange: (valor: string) => void;
  /** Placeholder del input. */
  placeholder?: string;
  /** Número de resultados. */
  resultados?: number;
  /** Acciones adicionales (botones de filtro, etc.). */
  acciones?: ReactNode;
  /** Acción principal (ej: "Nuevo radicado"). */
  accionPrincipal?: ReactNode;
  /** Clases adicionales. */
  className?: string;
}

export function SearchToolbar({
  valor,
  onChange,
  placeholder = 'Buscar...',
  resultados,
  acciones,
  accionPrincipal,
  className = '',
}: SearchToolbarProps) {
  return (
    <div
      className={`flex items-center gap-2 px-3 sm:px-4 py-2 shrink-0 bg-white ${className}`}
      style={{ borderBottom: '1px solid #E5E7EB' }}
    >
      {/* Input de búsqueda */}
      <div className="relative flex-1 min-w-0">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: '#94A3B8' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700/20 transition-all"
          style={{ borderColor: '#D9E2D9', background: '#F8FAF7' }}
          aria-label={placeholder}
        />
        {valor && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ color: '#94A3B8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Contador de resultados */}
      {resultados !== undefined && (
        <span className="shrink-0 text-[10px] font-semibold" style={{ color: '#94A3B8' }}>
          {resultados} resultado{resultados !== 1 ? 's' : ''}
        </span>
      )}

      {/* Acciones secundarias */}
      {acciones}

      {/* Separador */}
      {accionPrincipal && (
        <span className="w-px h-5 shrink-0" style={{ background: '#E5E7EB' }} aria-hidden="true" />
      )}

      {/* Acción principal */}
      {accionPrincipal}
    </div>
  );
}
