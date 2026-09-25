'use client';

import { formatFechaCortaColombia } from '@/lib/fecha-colombia';
import type { SolicitanteConocido } from '@/lib/recepcion/sugerencias-solicitante';

/* ══════════════════════════════════════════════════════════════
   Sprint Solicitante frecuente — dropdown de sugerencias bajo los
   campos Nombre / Identificación de la Radicación Rápida.

   El documento va enmascarado (los datos completos solo se llenan al
   seleccionar) y cada fila trae la fecha de la última radicación para
   distinguir homónimos. La selección usa mousedown — se dispara antes
   del blur del input — para que Tab/blur cierren el dropdown sin
   robarse el clic de selección.
══════════════════════════════════════════════════════════════ */

export interface SugerenciasSolicitanteProps {
  sugerencias:   SolicitanteConocido[];
  onSeleccionar: (s: SolicitanteConocido) => void;
}

export function SugerenciasSolicitante({
  sugerencias,
  onSeleccionar,
}: SugerenciasSolicitanteProps) {
  if (sugerencias.length === 0) return null;

  return (
    <ul
      role="listbox"
      aria-label="Solicitantes que ya han radicado"
      className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg bg-white overflow-hidden shadow-lg"
      style={{ border: '1px solid #D9E2D9' }}
    >
      {sugerencias.map((s) => (
        <li key={s.numeroDocumento} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={false}
            aria-label={`Usar datos de ${s.nombreCompleto}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSeleccionar(s);
            }}
            className="w-full text-left px-3 py-2 transition-colors hover:bg-[#F4F8F4]"
          >
            <span className="block text-sm font-semibold truncate" style={{ color: '#12261A' }}>
              {s.nombreCompleto}
            </span>
            <span className="block text-[11px]" style={{ color: '#667085' }}>
              {s.documentoEnmascarado} · últ. radicación {formatFechaCortaColombia(s.ultimaRadicacion)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
