'use client';

import { TONOS_INDICADOR, type TonoIndicador } from './Indicador';

/* ══════════════════════════════════════════════════════════════
   Design System — ChipFiltro (ADR-0046, Ola 2)

   Chip de filtro compacto (estilo tab): etiqueta, contador opcional
   tintado con el tono del estado y estado activo (`aria-pressed`).
   Extraído del Tablero SIN cambios de DOM ni estilo. Agnóstico al
   módulo: qué filtra y cuánto cuenta lo decide quien lo usa.
══════════════════════════════════════════════════════════════ */

/** Chip de filtro rápido: compacto, con contador tintado del tono del estado. */
export function ChipFiltro({
  etiqueta,
  valor,
  tono,
  activo,
  onClick,
  titulo,
  ariaLabel,
}: {
  etiqueta: string;
  valor?: number;
  tono?: TonoIndicador;
  activo: boolean;
  onClick: () => void;
  titulo?: string;
  /** Nombre accesible cuando la etiqueta visible no basta (conserva el de la vista que migra). */
  ariaLabel?: string;
}) {
  const colores = tono ? TONOS_INDICADOR[tono] : null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={ariaLabel}
      title={titulo}
      className="tablero-interactivo inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-[background-color,border-color,box-shadow] duration-150 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
      style={activo
        ? { background: 'var(--tema-fondo-007049)', borderColor: 'var(--tema-fondo-007049)', color: '#FFFFFF' }
        : { background: 'var(--tema-fondo-ffffff)', borderColor: 'var(--tema-borde-dce4ea)', color: 'var(--tema-texto-172033)' }}
    >
      {etiqueta}
      {valor !== undefined && (
        <span
          className="min-w-[1.25rem] rounded-full px-1.5 text-center text-[10px] font-black tabular-nums"
          style={activo
            /* Velo OSCURO sobre el verde activo: con el velo blanco de antes
               el número quedaba en 4,1:1 (bajo AA). Así queda en 8:1. */
            ? { background: 'rgba(0,0,0,0.18)', color: '#FFFFFF' }
            : { background: colores?.fondo ?? 'var(--tema-fondo-f4f9f6)', color: colores?.texto ?? 'var(--tema-texto-172033)' }}
        >
          {valor}
        </span>
      )}
    </button>
  );
}
