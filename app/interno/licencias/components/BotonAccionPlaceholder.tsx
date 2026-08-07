'use client';

import { useState } from 'react';

/**
 * Botón de acción todavía sin flujo conectado — Fase 1 de licencias solo
 * tiene fixtures, no hay endpoint que radicar/registrar acta/emitir acto
 * final. Dos variantes distintas de "no implementado" (spec Pantalla 01/02):
 *
 *  - `disabled=false` ("Radicar solicitud", "Registrar acta de
 *    observaciones"): el botón es real y da foco/feedback, pero la acción
 *    aún no está conectada — clic muestra una nota honesta en vez de
 *    fallar en silencio o simular una mutación que no ocurrió.
 *  - `disabled=true` ("Emitir acto final"): deshabilitado con una nota
 *    SIEMPRE visible (motivo legal/de secuencia, no solo "próximamente").
 *
 * Es el único componente 'use client' del módulo — aislado a propósito
 * para que las páginas sigan siendo Server Components.
 */
export function BotonAccionPlaceholder({
  label,
  variant,
  disabled = false,
  notaDeshabilitado,
  icono,
}: {
  label: string;
  variant: 'dorado' | 'outline';
  disabled?: boolean;
  /** Solo se usa (y se muestra siempre) cuando `disabled=true`. */
  notaDeshabilitado?: string;
  icono?: React.ReactNode;
}) {
  const [mostrarNota, setMostrarNota] = useState(false);

  const claseBase =
    'inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

  const estiloDorado: React.CSSProperties = {
    background: '#D4A017',
    color: '#14532D',
    boxShadow: '0 2px 8px rgba(212,160,23,0.25)',
  };
  const estiloOutline: React.CSSProperties = {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--color-border)',
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-describedby={
          disabled && notaDeshabilitado
            ? `${label.replace(/\s+/g, '-').toLowerCase()}-nota`
            : undefined
        }
        onClick={disabled ? undefined : () => setMostrarNota((v) => !v)}
        className={`${claseBase} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95 active:scale-[0.98]'}`}
        style={variant === 'dorado' ? estiloDorado : estiloOutline}
      >
        {icono}
        {label}
      </button>
      {disabled && notaDeshabilitado && (
        <p
          id={`${label.replace(/\s+/g, '-').toLowerCase()}-nota`}
          className="text-xs"
          style={{ color: '#9A6206' }}
        >
          {notaDeshabilitado}
        </p>
      )}
      {!disabled && mostrarNota && (
        <p role="status" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Esta acción se habilitará cuando se conecte con el flujo de radicación del motor de expedientes (próxima fase).
        </p>
      )}
    </div>
  );
}
