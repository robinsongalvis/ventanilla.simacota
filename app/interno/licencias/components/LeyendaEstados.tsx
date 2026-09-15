'use client';

import { ESTADOS_VISUALES, type EstadoVisual } from '../estado-visual-evento';

/* ══════════════════════════════════════════════════════════════
   LEYENDA «Estado del expediente» — la clave de lectura del riel.

   Compacta y en una fila que envuelve: el color por sí solo no basta, así que
   cada estado va con su nombre. No decide nada; solo explica lo que el riel de
   al lado ya muestra. Los estados y sus colores salen de la MISMA fuente que el
   render (`ESTADOS_VISUALES`), para que nunca digan cosas distintas.
══════════════════════════════════════════════════════════════ */

/* El orden en que se leen, de «ya pasó» a «excepción». `cancelled` no se lista:
   comparte color con `suspended` y es raro; cuando aparece, su chip en el riel
   ya lo nombra. */
const ORDEN_LEYENDA: readonly EstadoVisual[] = [
  'completed', 'in_progress', 'pending', 'projected', 'warning', 'suspended',
];

export function LeyendaEstados() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg px-3 py-2"
      style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--color-border)' }}
    >
      <span
        className="text-[10.5px] font-bold uppercase tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        Estado del expediente
      </span>
      {ORDEN_LEYENDA.map((clave) => {
        const def = ESTADOS_VISUALES[clave];
        return (
          <span key={clave} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={
                clave === 'projected'
                  ? { border: `1.5px dashed ${def.color}` }
                  : { background: def.color }
              }
            />
            <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
              {def.etiqueta.charAt(0) + def.etiqueta.slice(1).toLowerCase()}
            </span>
          </span>
        );
      })}
    </div>
  );
}
