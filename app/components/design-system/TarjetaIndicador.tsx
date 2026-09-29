'use client';

import type { ReactNode } from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { TONOS_INDICADOR, type TonoIndicador } from './Indicador';

/* ══════════════════════════════════════════════════════════════
   Design System — TarjetaIndicador y FilaTarjetas (ADR-0046, Ola 3)

   Tarjeta de resumen de la referencia visual oficial (decisión del
   propietario, 23-sep-2026): icono en círculo, cifra grande, etiqueta en
   versalitas y riel izquierdo del tono. COMPACTA a propósito: altura
   moderada para no robarle espacio a la tabla.

   Las tarjetas MUESTRAN el estado; los chips (`ChipFiltro`) FILTRAN. Por eso
   la tarjeta nunca es un filtro ni lleva `aria-pressed`: sin `onAbrir` es
   un bloque de lectura; con `onAbrir` es un botón que LLEVA a la vista
   donde ese estado se gestiona (p. ej. «Sin asignar» → Bandeja).

   Mismos tonos que `Indicador` (`TONOS_INDICADOR`, claro/oscuro). Agnóstica
   al módulo: no sabe de radicados, filtros ni roles.
══════════════════════════════════════════════════════════════ */

export interface TarjetaIndicadorProps {
  etiqueta: string;
  /** Número o texto ya formateado («87%», «—», «9d»). */
  valor: number | string;
  tono: TonoIndicador;
  Icono?: LucideIcon;
  /** Aclaración: va en el tooltip y para lectores de pantalla. */
  descripcion?: string;
  /** Muestra la aclaración como línea visible (p. ej. «1 resueltos»). */
  descripcionVisible?: boolean;
  /** Contenido propio del módulo bajo la etiqueta (p. ej. un enlace). */
  pie?: ReactNode;
  /** Lleva a la vista donde se gestiona este estado. No filtra. */
  onAbrir?: () => void;
  /** Qué hace `onAbrir`, para el nombre accesible («Abrir la bandeja de asignación»). */
  etiquetaAbrir?: string;
}

export function TarjetaIndicador({
  etiqueta,
  valor,
  tono,
  Icono,
  descripcion,
  descripcionVisible = false,
  pie,
  onAbrir,
  etiquetaAbrir,
}: TarjetaIndicadorProps) {
  const t = TONOS_INDICADOR[tono];
  const clase = 'flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left';
  /* Solo propiedades largas, un color por lado: mezclar `borderColor` (que
     también es un atajo) con `borderLeft` hace que React pierda uno de los
     dos al actualizar, y jsdom descarta el atajo con `var()`. */
  const estilo = {
    background: t.fondo,
    borderTopColor: t.borde,
    borderRightColor: t.borde,
    borderBottomColor: t.borde,
    borderLeftColor: t.texto,
    borderLeftWidth: 3,
  };

  const contenido = (
    <>
      {Icono && (
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
          style={{ background: `color-mix(in srgb, ${t.texto} 12%, transparent)`, color: t.texto }}
          aria-hidden="true"
        >
          <Icono size={16} strokeWidth={1.9} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-black leading-none tabular-nums" style={{ color: t.texto }}>{valor}</span>
        <span className="mt-1 break-words text-[10px] font-bold uppercase leading-tight tracking-wider" style={{ color: t.texto }}>
          {etiqueta}
        </span>
        {descripcion && descripcionVisible && (
          <span className="mt-0.5 text-[10px] leading-tight" style={{ color: 'var(--tema-texto-475569)' }}>{descripcion}</span>
        )}
        {descripcion && !descripcionVisible && !onAbrir && <span className="sr-only">. {descripcion}</span>}
        {pie}
      </span>
      {onAbrir && <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: t.texto }} strokeWidth={2.2} aria-hidden="true" />}
    </>
  );

  if (!onAbrir) {
    return <div title={descripcion} className={clase} style={estilo}>{contenido}</div>;
  }

  const partes = [`${etiqueta}: ${valor}`, descripcion, etiquetaAbrir].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onAbrir}
      title={descripcion}
      aria-label={partes.join('. ')}
      className={`tablero-interactivo ${clase} transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30`}
      style={estilo}
    >
      {contenido}
    </button>
  );
}

/**
 * Fila de tarjetas: se reparte sola según el ancho (dos por fila en móvil,
 * todas en una en escritorio), sin que cada vista calcule columnas. El
 * mínimo de 10,5 rem deja caber entera la palabra más larga de una
 * etiqueta («CUMPLIMIENTO»): más angosta, la partía a mitad de palabra.
 */
export function FilaTarjetas({
  etiqueta,
  children,
  className = '',
}: {
  /** Nombre accesible del grupo («Resumen de la bandeja»). */
  etiqueta: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-2 ${className}`}
    >
      {children}
    </div>
  );
}
