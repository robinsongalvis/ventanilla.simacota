'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — PriorityBanner

   Banner de prioridad que reemplaza el panel completo de
   "Siguiente atención sugerida". Versión más compacta que
   aparece como banner sobre la tabla, no como card grande.

   Muestra:
   - Mensaje de urgencia (icono + texto)
   - Radicado más crítico
   - Botón "Atender"
   - Toggle minimizar

   Ocupa ~60px de altura vs ~150px del panel actual.
══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

interface PriorityBannerProps {
  /** Mensaje de urgencia. */
  mensaje: string;
  /** ID del radicado. */
  radicadoId?: string;
  /** Asunto del radicado. */
  asunto?: string;
  /** Responsable. */
  responsable?: string;
  /** Botón de acción principal. */
  accion?: ReactNode;
  /** Nivel de urgencia (determina el color del borde). */
  nivel: 'critico' | 'alerta' | 'normal';
  /** Acción al minimizar. */
  onMinimizar?: () => void;
  /** Si está minimizado. */
  minimizado?: boolean;
  /** Contenido alternativo cuando está minimizado. */
  contenidoMinimizado?: ReactNode;
}

const COLORES_NIVEL = {
  critico: { border: '#DC2626', bg: '#FEF2F2', text: '#991B1B', icon: '#DC2626' },
  alerta:  { border: '#F59E0B', bg: '#FFFBEB', text: '#92400E', icon: '#F59E0B' },
  normal:  { border: '#14532D', bg: '#F0FDF4', text: '#14532D', icon: '#14532D' },
};

export function PriorityBanner({
  mensaje,
  radicadoId,
  asunto,
  responsable,
  accion,
  nivel,
  onMinimizar,
  minimizado = false,
  contenidoMinimizado,
}: PriorityBannerProps) {
  const colores = COLORES_NIVEL[nivel];

  if (minimizado && contenidoMinimizado) {
    return (
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white"
        style={{ border: `1px solid ${colores.border}22` }}
      >
        {contenidoMinimizado}
        {onMinimizar && (
          <button
            type="button"
            onClick={onMinimizar}
            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md"
            style={{ color: '#14532D', background: '#F8FAF7', border: '1px solid #D9E2D9' }}
            aria-expanded="false"
          >
            Mostrar
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-3 sm:px-4 py-2.5 rounded-xl bg-white"
      style={{
        border: `1px solid ${colores.border}33`,
        borderLeft: `4px solid ${colores.border}`,
        boxShadow: nivel === 'critico' ? `0 2px 8px ${colores.border}15` : undefined,
      }}
    >
      {/* Icono de urgencia */}
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: colores.bg }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke={colores.icon} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colores.text }}>
          {mensaje}
        </p>
        {radicadoId && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs font-bold" style={{ color: '#14532D' }}>{radicadoId}</span>
            {asunto && (
              <span className="text-[10px] truncate" style={{ color: '#667085' }}>{asunto}</span>
            )}
            {responsable && (
              <span className="text-[10px] hidden sm:inline" style={{ color: '#94A3B8' }}>· {responsable}</span>
            )}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="shrink-0 flex items-center gap-1.5">
        {accion}
        {onMinimizar && (
          <button
            type="button"
            onClick={onMinimizar}
            className="text-[10px] font-bold px-2 py-1 rounded-md"
            style={{ color: '#14532D', background: '#F8FAF7', border: '1px solid #D9E2D9' }}
            aria-expanded="true"
          >
            Minimizar
          </button>
        )}
      </div>
    </div>
  );
}
