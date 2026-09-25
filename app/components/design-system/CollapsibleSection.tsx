'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — CollapsibleSection

   Sección expandible para información secundaria.
   Reduce carga visual al ocultar contenido detallado tras un
   toggle. La información NO se elimina — se hace accesible
   bajo demanda.
══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  /** Título de la sección. */
  titulo: string;
  /** Contenido colapsable. */
  children: ReactNode;
  /** Si empieza abierto. */
  abiertoPorDefecto?: boolean;
  /** Contador de elementos (ej: "3 activos"). */
  contador?: string | number;
  /** Badge de estado junto al título. */
  badge?: ReactNode;
  /** Clases adicionales del contenedor. */
  className?: string;
}

export function CollapsibleSection({
  titulo,
  children,
  abiertoPorDefecto = false,
  contador,
  badge,
  className = '',
}: CollapsibleSectionProps) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto);

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ border: '1px solid #E5E7EB' }}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#F8FAF7]"
        aria-expanded={abierto}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${abierto ? 'rotate-90' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            style={{ color: '#94A3B8' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
            {titulo}
          </span>
          {contador !== undefined && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>
              {contador}
            </span>
          )}
          {badge}
        </div>
      </button>

      {abierto && (
        <div className="px-3 pb-3" style={{ borderTop: '1px solid #F1F5F9' }}>
          {children}
        </div>
      )}
    </div>
  );
}
