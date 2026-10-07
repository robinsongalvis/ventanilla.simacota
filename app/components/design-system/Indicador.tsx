'use client';

import type { LucideIcon } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Design System — Indicador (ADR-0046, Ola 2)

   Indicador compacto: icono + valor + etiqueta en una línea, fondo tintado
   por tono y borde de color solo cuando está activo. Extraído del Tablero
   SIN cambios de DOM ni estilo. Con `onClick` es un botón (filtra); sin él,
   un bloque de solo lectura (Ola 3). Agnóstico al módulo: no sabe de
   radicados ni de filtros; recibe valor, tono y la acción al pulsarlo.
══════════════════════════════════════════════════════════════ */

/** Tonos semánticos con tokens de tema (claro/oscuro, ADR-0043/0045). */
export const TONOS_INDICADOR = {
  rojo: { fondo: 'var(--tema-fondo-fef2f2)', borde: 'var(--tema-borde-fecaca)', texto: 'var(--tema-texto-b91c1c)' },
  ambar: { fondo: 'var(--tema-fondo-fffbeb)', borde: 'var(--tema-borde-fde68a)', texto: 'var(--tema-texto-b45309)' },
  azul: { fondo: 'var(--tema-fondo-eff6ff)', borde: 'var(--tema-borde-bfdbfe)', texto: 'var(--tema-texto-1d4ed8)' },
  verde: { fondo: 'var(--tema-fondo-f0fdf4)', borde: 'var(--tema-borde-bbf7d0)', texto: 'var(--tema-texto-006b45)' },
  gris: { fondo: 'var(--tema-fondo-f8fafc)', borde: 'var(--tema-borde-e2e8f0)', texto: 'var(--tema-texto-334155)' },
} as const;

export type TonoIndicador = keyof typeof TONOS_INDICADOR;

interface IndicadorBase {
  etiqueta: string;
  /** Número o texto ya formateado («87 %», «—», nombre de una dependencia). */
  valor: number | string;
  /** Aclaración breve: va en el tooltip y para lectores de pantalla, no a la vista. */
  descripcion?: string;
  /**
   * Muestra la aclaración como segunda línea. Solo para indicadores estáticos
   * que también se imprimen (p. ej. un reporte): en papel no hay tooltip.
   */
  descripcionVisible?: boolean;
  tono: TonoIndicador;
  Icono?: LucideIcon;
}

/** Indicador que además filtra: se pinta como botón con `aria-pressed`. */
export interface IndicadorInteractivoProps extends IndicadorBase {
  /** Lo que filtra se cuenta: siempre un número. */
  valor: number;
  activo: boolean;
  onClick: () => void;
}

/**
 * Indicador de solo lectura: sin acción no hay botón. Un botón que no hace
 * nada sería una acción falsa (ADR-0046, Ola 3).
 */
export interface IndicadorEstaticoProps extends IndicadorBase {
  activo?: undefined;
  onClick?: undefined;
}

export type IndicadorProps = IndicadorInteractivoProps | IndicadorEstaticoProps;

export function Indicador({
  etiqueta,
  valor,
  descripcion,
  descripcionVisible = false,
  tono,
  Icono,
  activo,
  onClick,
}: IndicadorProps) {
  const tonoActual = TONOS_INDICADOR[tono];

  if (!onClick) {
    return (
      <div
        title={descripcion}
        className="min-w-0 rounded-lg border px-2.5 py-1.5 text-left"
        style={{ background: tonoActual.fondo, borderColor: 'transparent' }}
      >
        {/* flex-wrap: un valor de texto («Casco Urbano», «3 dependencias») no
            estruja la etiqueta hasta partirla letra a letra; la baja de línea. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5" style={{ color: tonoActual.texto }}>
          {Icono && <Icono className="shrink-0" size={16} strokeWidth={1.9} aria-hidden="true" />}
          <span className="text-lg font-black leading-none tabular-nums">{valor}</span>
          <span className="min-w-0 break-words text-[11px] font-bold leading-tight">{etiqueta}</span>
          {descripcion && !descripcionVisible && <span className="sr-only">. {descripcion}</span>}
        </div>
        {descripcion && descripcionVisible && (
          <p className="mt-1 text-[10px] leading-tight" style={{ color: 'var(--tema-texto-475569)' }}>{descripcion}</p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={descripcion ? `${etiqueta}: ${valor}. ${descripcion}` : `${etiqueta}: ${valor}`}
      title={descripcion}
      className="tablero-interactivo min-w-0 rounded-lg border px-2.5 py-1.5 text-left transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-px hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
      style={{
        background: activo ? 'var(--tema-fondo-ffffff)' : tonoActual.fondo,
        /* Sin borde visible en reposo: el fondo tintado ya identifica el
           estado. El borde de color solo marca la tarjeta activa. */
        borderColor: activo ? tonoActual.texto : 'transparent',
        boxShadow: activo ? `0 0 0 2px color-mix(in srgb, ${tonoActual.texto} 13.3%, transparent)` : undefined,
      }}
    >
      <div className="flex min-w-0 items-center gap-2" style={{ color: tonoActual.texto }}>
        {Icono && <Icono className="shrink-0" size={16} strokeWidth={1.9} aria-hidden="true" />}
        <span className="text-lg font-black leading-none tabular-nums">{valor}</span>
        <span className="min-w-0 break-words text-[11px] font-bold leading-tight">{etiqueta}</span>
      </div>
    </button>
  );
}
