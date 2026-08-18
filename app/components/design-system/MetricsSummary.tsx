'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — MetricsSummary

   Barra compacta de métricas que reemplaza las 4 TarjetasMIPGGrande
   y la BarraKpisOperativos en una sola línea visual.

   Diseño:
   - Fila horizontal con métricas clave en texto compacto
   - Colores por tono (danger/warning/success/info)
   - Toggle expandir para ver todas las métricas
   -_respeta la jerarquía: lo crítico primero, lo demás al expandir

   NO elimina métricas — las oculta tras "Ver detalle" y las
   muestra todas al expandir.
══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import type { ReactNode } from 'react';

interface MetricaItem {
  label: string;
  valor: number;
  color: string;
  /** Prioridad visual: crítica aparece siempre, demás se ocultan. */
  prioridad?: 'critica' | 'normal';
  onClick?: () => void;
  activo?: boolean;
}

interface MetricsSummaryProps {
  /** Métricas que siempre son visibles (NIVEL 1 — prioridad). */
  criticas: MetricaItem[];
  /** Métricas que se ocultan tras "Ver detalle" (NIVEL 2 — resumen). */
  secundarias?: MetricaItem[];
  /** Etiqueta de la sección. */
  titulo?: string;
  /** Acciones adicionales en la derecha. */
  acciones?: ReactNode;
  /** Texto del botón expandir. */
  labelExpandir?: string;
}

export function MetricsSummary({
  criticas,
  secundarias = [],
  titulo,
  acciones,
  labelExpandir = 'Ver detalle',
}: MetricsSummaryProps) {
  const [expandido, setExpandido] = useState(false);
  const haySecundarias = secundarias.length > 0;

  return (
    <div className="bg-white px-3 sm:px-4 py-2 shrink-0" style={{ borderBottom: '1px solid #E5E7EB' }}>
      <div className="flex items-center gap-3 flex-wrap">
        {titulo && (
          <span className="text-[9px] font-bold uppercase tracking-widest shrink-0" style={{ color: '#94A3B8' }}>
            {titulo}
          </span>
        )}

        {/* Métricas críticas — siempre visibles */}
        <div className="flex items-center gap-2 flex-wrap">
          {criticas.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={m.onClick}
              disabled={!m.onClick}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold tabular-nums transition-all ${
                m.onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
              } ${m.activo ? 'ring-2 ring-offset-1' : ''}`}
              style={{
                background: `${m.color}12`,
                color: m.color,
                boxShadow: m.activo ? `0 0 0 2px ${m.color}40` : undefined,
              }}
              aria-pressed={m.activo}
              aria-label={`${m.label}: ${m.valor}`}
            >
              <span>{m.valor}</span>
              <span className="font-semibold">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Separador si hay secundarias */}
        {haySecundarias && (
          <span className="w-px h-5 shrink-0" style={{ background: '#E5E7EB' }} aria-hidden="true" />
        )}

        {/* Toggle expandir */}
        {haySecundarias && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors shrink-0"
            style={{ color: '#667085', background: expandido ? '#F1F5F9' : 'transparent' }}
            aria-expanded={expandido}
          >
            {expandido ? 'Ocultar' : labelExpandir}
            <svg
              className={`w-3 h-3 ml-1 inline-block transition-transform ${expandido ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Acciones (filtro tenant, toggle compacto, etc.) */}
        {acciones && <div className="ml-auto shrink-0">{acciones}</div>}
      </div>

      {/* Métricas secundarias — se muestran al expandir */}
      {expandido && secundarias.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
          {secundarias.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={m.onClick}
              disabled={!m.onClick}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold tabular-nums transition-all ${
                m.onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
              } ${m.activo ? 'ring-2 ring-offset-1' : ''}`}
              style={{
                background: `${m.color}08`,
                color: m.color,
                boxShadow: m.activo ? `0 0 0 2px ${m.color}40` : undefined,
              }}
              aria-pressed={m.activo}
              aria-label={`${m.label}: ${m.valor}`}
            >
              <span>{m.valor}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
