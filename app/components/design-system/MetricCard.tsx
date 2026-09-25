'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — MetricCard

   Tarjeta de métrica compacta y reutilizable.
   Uso principal: barra de métricas del Tablero (reemplaza las
   4 TarjetasMIPGGrande con una versión más compacta).

   Jerarquía visual:
   - `dominante`: borde más grueso, número más grande (vencidas > 0)
   - `atenuada`:  opacidad reducida (valor = 0)
   - `normal`:    estándar

   NO elimina información — el detalle del radicado crítico
   se muestra en un tooltip o sección expandible.
══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

interface MetricCardProps {
  /** Etiqueta de la métrica (ej: "Vencidas"). */
  label: string;
  /** Valor numérico. */
  valor: number;
  /** Token de color (riel + texto del valor). */
  color: string;
  /** Icono opcional. */
  icono?: ReactNode;
  /** Chip de estado opcional ("crítico", "sin casos", etc.). */
  chipLabel?: string;
  /** Habilitar estado dominante (más peso visual). */
  dominante?: boolean;
  /** Habilitar estado atenuado (valor 0). */
  atenuada?: boolean;
  /** Acción al hacer clic (filtra la tabla). */
  onFiltrar?: () => void;
  /** Si está activo (filtro seleccionado). */
  activo?: boolean;
  /** Clases adicionales. */
  className?: string;
}

export function MetricCard({
  label,
  valor,
  color,
  icono,
  chipLabel,
  dominante = false,
  atenuada = false,
  onFiltrar,
  activo = false,
  className = '',
}: MetricCardProps) {
  const numeroSize = dominante ? 'text-[36px]' : 'text-[28px]';
  const rielAncho = dominante ? 4 : 2;
  const contenido = (
    <div
      className={`flex flex-col rounded-xl bg-white overflow-hidden ${className}`}
      style={{
        border: `1px solid ${activo ? '#14532D' : dominante ? color : '#E3EAE3'}`,
        borderTop: `${rielAncho}px solid ${color}`,
        opacity: atenuada ? 0.5 : 1,
        boxShadow: dominante ? `0 2px 8px ${color}22` : '0 1px 2px rgba(20,83,45,0.04)',
      }}
    >
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color }}>
            {icono}
            {label}
          </span>
          {chipLabel && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: `${color}15`, color }}
            >
              {chipLabel}
            </span>
          )}
        </div>
        <p
          className={`${numeroSize} font-black tabular-nums leading-none mt-1`}
          style={{ color: atenuada ? '#64748B' : '#12261A' }}
        >
          {valor}
        </p>
      </div>
    </div>
  );

  if (onFiltrar) {
    return (
      <button
        type="button"
        onClick={onFiltrar}
        className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 rounded-xl"
        aria-pressed={activo}
        aria-label={`Filtrar por ${label} (${valor})`}
      >
        {contenido}
      </button>
    );
  }

  return contenido;
}
