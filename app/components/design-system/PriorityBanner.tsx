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
import { AlertTriangle } from 'lucide-react';

interface PriorityBannerProps {
  /** Mensaje de urgencia. */
  mensaje: string;
  /** ID del radicado. */
  radicadoId?: string;
  /** Asunto del radicado. */
  asunto?: string;
  /** Descripción breve de la atención requerida. */
  descripcion?: string;
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
  critico: { border: '#D81E1E', bg: 'var(--tema-fondo-fef2f2)', text: 'var(--tema-texto-991b1b)', icon: 'var(--tema-texto-d81e1e)' },
  alerta:  { border: '#F59E0B', bg: 'var(--tema-fondo-fffbeb)', text: 'var(--tema-texto-92400e)', icon: 'var(--tema-texto-f59e0b)' },
  normal:  { border: 'var(--tema-borde-007049)', bg: 'var(--tema-fondo-f0fdf4)', text: 'var(--tema-texto-007049)', icon: 'var(--tema-texto-007049)' },
};

export function PriorityBanner({
  mensaje,
  radicadoId,
  asunto,
  descripcion,
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
        className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--tema-fondo-ffffff)]"
        style={{ border: `1px solid color-mix(in srgb, ${colores.border} 13.3%, transparent)` }}
      >
        {contenidoMinimizado}
        {onMinimizar && (
          <button
            type="button"
            onClick={onMinimizar}
            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-md"
            style={{ color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-f7f9fb)', border: '1px solid var(--tema-borde-dce4ea)' }}
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
      className="flex items-center gap-3 px-3 sm:px-4 py-2 rounded-xl bg-[var(--tema-fondo-ffffff)] transition-shadow duration-200 hover:shadow-sm"
      style={{
        border: `1px solid color-mix(in srgb, ${colores.border} 20%, transparent)`,
        borderLeft: `4px solid ${colores.border}`,
        boxShadow: nivel === 'critico' ? `0 2px 8px color-mix(in srgb, ${colores.border} 8.2%, transparent)` : undefined,
      }}
    >
      {/* Icono de urgencia */}
      <div
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: colores.bg }}
      >
        <AlertTriangle size={17} strokeWidth={1.9} style={{ color: colores.icon }} aria-hidden="true" />
      </div>

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: colores.text }}>
          {mensaje}
        </p>
        {descripcion && (
          <p className="mt-0.5 break-words text-xs font-semibold" style={{ color: 'var(--tema-texto-172033)' }}>
            {descripcion}
          </p>
        )}
        {radicadoId && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs font-bold" style={{ color: 'var(--tema-texto-007049)' }}>{radicadoId}</span>
            {asunto && (
              <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{asunto}</span>
            )}
            {responsable && (
              <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>· {responsable}</span>
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
            style={{ color: 'var(--tema-texto-007049)', background: 'var(--tema-fondo-f7f9fb)', border: '1px solid var(--tema-borde-dce4ea)' }}
            aria-expanded="true"
          >
            Minimizar
          </button>
        )}
      </div>
    </div>
  );
}
