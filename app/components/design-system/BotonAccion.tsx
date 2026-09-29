'use client';

import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   Design System — BotonAccion (ADR-0046, Ola 3)

   Botones de acción de una vista, con el lenguaje de la barra de trabajo
   del Tablero:
   - `primaria`: verde institucional lleno («Nuevo radicado»).
   - `secundaria`: blanco con borde verde («Filtros»).
   - `destacada`: dorado. SOLO para la acción del mostrador que atiende al
     ciudadano («Nueva radicación» en Ventanilla): la única superficie
     dorada del panel. Su texto es un color FIJO y no un token de tema: el
     fondo dorado es el mismo en claro y oscuro, y el token de texto
     cambiaba a dorado en oscuro (dorado sobre dorado, ilegible).

   Agnóstico al módulo: qué hace el botón lo decide quien lo usa. Acepta
   cualquier atributo de `<button>` (`title`, `disabled`, `aria-*`).
══════════════════════════════════════════════════════════════ */

export type VarianteBotonAccion = 'primaria' | 'secundaria' | 'destacada';

const BASE = 'shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTES: Record<VarianteBotonAccion, { clase: string; estilo: React.CSSProperties }> = {
  primaria: {
    clase: `micro-btn-primary text-white focus-visible:ring-emerald-700/40 ${BASE}`,
    estilo: { background: 'var(--tema-fondo-007049)' },
  },
  secundaria: {
    clase: `border transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:bg-[var(--tema-fondo-f4f9f6)] hover:shadow-sm focus-visible:ring-emerald-700/30 ${BASE}`,
    estilo: { background: 'var(--tema-fondo-ffffff)', color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-007049)' },
  },
  destacada: {
    clase: `border transition-opacity hover:opacity-90 focus-visible:ring-amber-600/40 ${BASE}`,
    estilo: { background: '#E5A31A', color: '#3D2C00', borderColor: '#B8890F' },
  },
};

export function BotonAccion({
  variante = 'secundaria',
  Icono,
  children,
  type = 'button',
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotonAccion;
  Icono?: LucideIcon;
}) {
  const v = VARIANTES[variante];
  return (
    <button type={type} {...resto} className={v.clase} style={v.estilo}>
      {Icono && <Icono size={15} strokeWidth={variante === 'secundaria' ? 1.9 : 2} aria-hidden="true" />}
      {children}
    </button>
  );
}
