'use client';

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════
   Design System — SuperficieTabla y CabeceraTablaSticky (ADR-0046, Ola 2)

   Extraídas del Tablero SIN cambios de DOM ni estilo. Agnósticas al
   módulo: las columnas, filas y estados de cada tabla son del módulo.
══════════════════════════════════════════════════════════════ */

/**
 * Panel protagonista de una bandeja: ocupa el alto restante y recorta su
 * contenido para que el scroll ocurra dentro. `integrada` lo desactiva
 * cuando el scroll pertenece a la columna completa (p. ej. con el panel de
 * detalle abierto).
 */
export function SuperficieTabla({ integrada = false, children }: { integrada?: boolean; children: ReactNode }) {
  return (
    <div className={integrada ? '' : 'mx-3 mb-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-[var(--tema-fondo-ffffff)] sm:mx-4 lg:mx-6'}>
      {children}
    </div>
  );
}

/** Columna con ancho o alineación propios (p. ej. cifras a la derecha). */
export interface ColumnaTabla {
  etiqueta: string;
  /** Ancho fijo en px (tablas de registro con columnas estables). */
  ancho?: number;
  alineacion?: 'izquierda' | 'derecha';
  /** Nombre accesible si la etiqueta visible está vacía (columna de acciones). */
  etiquetaAccesible?: string;
}

const ESTILO_TH = {
  color: 'var(--tema-texto-007049)',
  background: 'var(--tema-fondo-f4f9f6)',
  borderBottom: '1px solid var(--tema-borde-dce4ea)',
  boxShadow: '0 1px 0 rgba(0, 112, 73,0.08)',
} as const;

/**
 * Encabezado de tabla fijo al hacer scroll, con el estilo de columnas del sistema.
 *
 * Ola 3 — aditivo: `control` pinta una primera celda para la casilla de
 * selección masiva, y cada columna puede ser un `ColumnaTabla`. Con solo
 * textos el HTML es idéntico al del Tablero.
 */
export function CabeceraTablaSticky({
  columnas,
  control,
}: {
  columnas: readonly (string | ColumnaTabla)[];
  control?: ReactNode;
}) {
  return (
    <thead className="sticky top-0 z-20">
      <tr style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}>
        {control !== undefined && (
          <th className="w-10 px-2 py-2 text-left" style={ESTILO_TH}>{control}</th>
        )}
        {columnas.map((c, i) => {
          const col: ColumnaTabla = typeof c === 'string' ? { etiqueta: c } : c;
          return (
            <th
              key={col.etiqueta || `columna-${i}`}
              className={`whitespace-nowrap px-2 py-2 ${col.alineacion === 'derecha' ? 'text-right' : 'text-left'} text-[9px] font-bold uppercase tracking-wider leading-tight`}
              style={col.ancho !== undefined ? { ...ESTILO_TH, width: col.ancho } : ESTILO_TH}
              aria-label={col.etiquetaAccesible}
            >
              {col.etiqueta}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
