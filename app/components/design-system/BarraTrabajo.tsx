'use client';

import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Design System — BarraTrabajo (ADR-0046, Ola 2)

   Barra de trabajo de una bandeja: buscador que ocupa el espacio libre,
   contador de resultados y, a la derecha, las acciones del módulo
   (`children`). Extraída del Tablero SIN cambios de DOM ni estilo.
   Agnóstica al módulo: qué se busca, qué se cuenta y qué acciones hay
   lo decide quien la usa.

   Ola 3 — `onEnter`, `ariaLabel` y `limpiable` son opcionales: sin ellos
   el HTML es el mismo del Tablero.
══════════════════════════════════════════════════════════════ */

const CLASE_INPUT = 'micro-input w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none';
/* Con botón propio de limpiar se oculta el del navegador (solo existe en
   Chromium/Safari) para no mostrar dos. */
const CLASE_INPUT_LIMPIABLE = 'micro-input w-full rounded-lg pl-9 pr-8 py-2 text-sm outline-none [&::-webkit-search-cancel-button]:hidden';

export function BarraTrabajo({
  busqueda,
  onBusquedaChange,
  placeholder,
  contador,
  onEnter,
  ariaLabel,
  limpiable = false,
  children,
}: {
  busqueda: string;
  onBusquedaChange: (valor: string) => void;
  placeholder: string;
  /** Texto de resultados junto al buscador (p. ej. «12 resultados»). */
  contador?: ReactNode;
  /** Enter en el buscador (p. ej. abrir la coincidencia exacta). */
  onEnter?: () => void;
  /** Nombre accesible del buscador cuando el placeholder no basta. */
  ariaLabel?: string;
  /** Botón «Limpiar búsqueda» visible en todos los navegadores. */
  limpiable?: boolean;
  /** Acciones del módulo, en orden: filtros, selectores, acción principal. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-2 shrink-0 sm:px-4 lg:px-6">
      <div className="relative min-w-0 flex-[1_1_15rem]">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--tema-texto-94a3b8)' }} strokeWidth={1.9} aria-hidden="true" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          onKeyDown={onEnter ? (e) => { if (e.key === 'Enter') onEnter(); } : undefined}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={limpiable ? CLASE_INPUT_LIMPIABLE : CLASE_INPUT}
          style={{
            background: 'var(--tema-fondo-ffffff)',
            border: '1px solid var(--tema-borde-dce4ea)',
            color: 'var(--tema-texto-172033)',
          }}
        />
        {limpiable && busqueda && (
          <button
            type="button"
            onClick={() => onBusquedaChange('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={{ color: 'var(--tema-texto-64748b)' }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      {contador !== undefined && (
        <span className="text-xs shrink-0" style={{ color: 'var(--tema-texto-64748b)' }}>{contador}</span>
      )}
      {children}
    </div>
  );
}
