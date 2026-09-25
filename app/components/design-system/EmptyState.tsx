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
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: '#F1F5F9' }}>
          {icono}
        </div>
      )}
      <p className="text-sm font-bold" style={{ color: '#475569' }}>{titulo}</p>
      {descripcion && (
        <p className="text-xs mt-1 max-w-xs" style={{ color: '#94A3B8' }}>{descripcion}</p>
      )}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}
