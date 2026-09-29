'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — EmptyState

   Estado vacío reutilizable para cuando no hay datos.
   Muestra un ícono, título, descripción y acción opcional.
══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';

interface EmptyStateProps {
  icono?: ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

export function EmptyState({ icono, titulo, descripcion, accion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icono && (
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--tema-fondo-f1f5f9)' }}>
          {icono}
        </div>
      )}
      <p className="text-sm font-bold" style={{ color: 'var(--tema-texto-475569)' }}>{titulo}</p>
      {descripcion && (
        /* #64748B: el gris más claro que cumple AA sobre blanco (4,8:1); #94A3B8 se quedaba en 2,6:1. */
        <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--tema-texto-64748b)' }}>{descripcion}</p>
      )}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}
