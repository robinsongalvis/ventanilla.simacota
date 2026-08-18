'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — SectionHeader

   Encabezado de sección reutilizable para tableros y paneles.
   Proporciona: título, subtítulo, acciones, indicadores.
══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

interface SectionHeaderProps {
  /** Título principal. */
  titulo: string;
  /** Subtítulo o descripción. */
  subtitulo?: string;
  /** Acciones a la derecha (botones, toggles). */
  acciones?: ReactNode;
  /** Indicador visual junto al título (dot, badge, etc.). */
  indicador?: ReactNode;
  /** Contador de elementos junto al título (ej: "5 resultados"). */
  contador?: string;
  /**
   * Aclaración normativa o de alcance, bajo el subtítulo.
   *
   * POR QUÉ EXISTE. Al migrar el Centro de Control Interno a este
   * componente el 18-ago-2026 se perdió la frase «No reemplaza al
   * funcionario que responde el radicado» — la única en pantalla que
   * delimitaba la autoridad de Control Interno frente a quien tramita.
   * El encabezado solo admitía título y subtítulo, así que el párrafo se
   * cayó sin que nadie lo notara. No es texto decorativo: en una entidad
   * pública, decir quién NO decide es parte del control.
   */
  nota?: ReactNode;
  /** Variante visual. */
  variante?: 'default' | 'compact' | 'highlight';
  /** Clases adicionales. */
  className?: string;
}

export function SectionHeader({
  titulo,
  subtitulo,
  acciones,
  indicador,
  contador,
  nota,
  variante = 'default',
  className = '',
}: SectionHeaderProps) {
  const estilos = {
    default: { padding: 'px-4 pt-3 pb-2', bg: 'bg-white' },
    compact: { padding: 'px-3 pt-2 pb-1', bg: 'bg-[#F8FAF7]' },
    highlight: { padding: 'px-4 pt-3 pb-2', bg: 'bg-white' },
  };

  const s = estilos[variante];

  return (
    <div className={`flex items-start justify-between gap-3 ${s.padding} ${s.bg} shrink-0 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {indicador}
        <div className="min-w-0">
          <h2 className={`font-black leading-tight ${
            variante === 'compact' ? 'text-sm' : 'text-base'
          }`} style={{ color: '#12261A' }}>
            {titulo}
            {contador && (
              <span className="ml-2 text-[10px] font-semibold tabular-nums" style={{ color: '#94A3B8' }}>
                {contador}
              </span>
            )}
          </h2>
          {subtitulo && (
            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
              {subtitulo}
            </p>
          )}
          {/* --text-secondary, no --text-muted: una aclaración de alcance que
              no se puede leer no delimita nada. #667085 sobre blanco rinde
              5,3:1; el gris muted del proyecto se queda en 2,5:1. */}
          {nota && (
            <p className="text-[10px] mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
              {nota}
            </p>
          )}
        </div>
      </div>
      {acciones && <div className="shrink-0 flex items-center gap-2">{acciones}</div>}
    </div>
  );
}
