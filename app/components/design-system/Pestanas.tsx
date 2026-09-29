'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Design System — Pestanas (ADR-0046, Ola 3)

   Pestañas segmentadas con el lenguaje de los chips del Tablero. Sustituyen
   las tres implementaciones que había (Control Interno, Licencias y
   Gobernanza SIMI). Agnósticas al módulo: qué secciones hay y qué muestra
   cada una lo decide quien las usa.

   Accesibilidad (patrón WAI-ARIA «Tabs»): `role="tablist"`/`tab`/`tabpanel`,
   foco itinerante (solo la pestaña activa entra en el orden de Tab) y
   flechas, Inicio y Fin para moverse. Activación MANUAL: las flechas mueven
   el foco y Enter/Espacio cambia de sección, porque varias secciones
   cargan datos al abrirse y no deben dispararse al recorrerlas.
══════════════════════════════════════════════════════════════ */

export interface Pestana<T extends string> {
  id: T;
  etiqueta: string;
  /** Segunda línea breve (p. ej. «Qué revisar hoy»). */
  detalle?: string;
  Icono?: LucideIcon;
}

const idTab = (idBase: string, id: string) => `${idBase}-tab-${id}`;
const idPanel = (idBase: string) => `${idBase}-panel`;

export function Pestanas<T extends string>({
  idBase,
  etiquetaGrupo,
  pestanas,
  activa,
  onCambiar,
}: {
  /** Prefijo único para enlazar pestañas y panel. */
  idBase: string;
  /** Nombre accesible del grupo (p. ej. «Secciones de Control Interno»). */
  etiquetaGrupo: string;
  pestanas: readonly Pestana<T>[];
  activa: T;
  onCambiar: (id: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function alTeclear(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const n = pestanas.length;
    const destino =
      e.key === 'ArrowRight' ? (indice + 1) % n
        : e.key === 'ArrowLeft' ? (indice - 1 + n) % n
          : e.key === 'Home' ? 0
            : e.key === 'End' ? n - 1
              : -1;
    if (destino < 0) return;
    e.preventDefault();
    refs.current[destino]?.focus();
  }

  return (
    <div role="tablist" aria-label={etiquetaGrupo} className="flex max-w-full flex-wrap gap-1.5">
      {pestanas.map((p, i) => {
        const seleccionada = p.id === activa;
        const Icono = p.Icono;
        return (
          <button
            key={p.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={idTab(idBase, p.id)}
            aria-selected={seleccionada}
            aria-controls={idPanel(idBase)}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => onCambiar(p.id)}
            onKeyDown={(e) => alTeclear(e, i)}
            className="tablero-interactivo inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-[background-color,border-color,box-shadow] duration-150 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
            style={seleccionada
              ? { background: 'var(--tema-fondo-007049)', borderColor: 'var(--tema-fondo-007049)', color: '#FFFFFF' }
              : { background: 'var(--tema-fondo-ffffff)', borderColor: 'var(--tema-borde-dce4ea)', color: 'var(--tema-texto-172033)' }}
          >
            {Icono && <Icono className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
            <span className="flex min-w-0 flex-col">
              <span>{p.etiqueta}</span>
              {p.detalle && (
                <span
                  className="text-[10px] font-normal leading-tight"
                  style={{ color: seleccionada ? 'rgba(255,255,255,0.88)' : 'var(--tema-texto-64748b)' }}
                >
                  {p.detalle}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Contenedor de la sección activa, enlazado a su pestaña. */
export function PanelPestana<T extends string>({
  idBase,
  activa,
  className,
  children,
}: {
  idBase: string;
  activa: T;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="tabpanel" id={idPanel(idBase)} aria-labelledby={idTab(idBase, activa)} className={className}>
      {children}
    </div>
  );
}
