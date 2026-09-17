'use client';

/* ══════════════════════════════════════════════════════════════
   Design System — MetricsCards

   Variante en formato TARJETA de `MetricsSummary` para la cabecera del
   Tablero (Sala de operaciones). Cada métrica crítica es una tarjeta con
   icono en color pleno, número grande, label y sublabel — el mismo
   lenguaje visual que las tarjetas del resumen de documentos, para que
   Tablero y expediente se sientan del mismo sistema.

   Reglas de color (§6/§7/§8 del rediseño):
   - El FONDO de la tarjeta es un tinte MUY suave del tono (`${color}0D`),
     nunca color fuerte. El verde institucional sólido se reserva para
     navegación/CTA, no para tarjetas.
   - La SELECCIÓN usa el verde institucional suave: fondo `#E8F3EC`,
     borde/realce `#17643A`.
   - El icono va en color pleno (el tono identifica el KPI); el número usa
     `colorTexto`, obligatorio y distinto de `color` — misma disciplina
     WCAG que MetricsSummary (ADR-0030): el tono como fondo/icono no es
     legible como texto.

   NO elimina métricas: las secundarias siguen accesibles tras
   "Ver detalle".
══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import type { ReactNode } from 'react';

export interface MetricaCard {
  label: string;
  valor: number;
  /** Tono identificador del KPI: fondo tintado + icono pleno. No es color de texto. */
  color: string;
  /** Color legible del número (ADR-0030): obligatorio y distinto de `color`. */
  colorTexto: string;
  /** Línea de apoyo bajo el label ("Requieren atención", "En trámite"…). */
  sublabel?: string;
  icono?: ReactNode;
  onClick?: () => void;
  activo?: boolean;
}

interface MetricsCardsProps {
  /** Métricas destacadas — tarjetas grandes, siempre visibles. */
  criticas: MetricaCard[];
  /** Métricas que se conservan tras "Ver detalle" (no se eliminan). */
  secundarias?: MetricaCard[];
  titulo?: string;
  /** Controles de la derecha (selector de dependencia, toggles…). */
  acciones?: ReactNode;
  labelExpandir?: string;
}

export function MetricsCards({
  criticas,
  secundarias = [],
  titulo,
  acciones,
  labelExpandir = 'Ver detalle',
}: MetricsCardsProps) {
  const [expandido, setExpandido] = useState(false);
  const haySecundarias = secundarias.length > 0;

  return (
    <div className="bg-white px-3 sm:px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #E5E7EB' }}>
      {(titulo || acciones) && (
        <div className="flex items-center gap-3 mb-2">
          {titulo && (
            <span className="text-[9px] font-bold uppercase tracking-widest shrink-0" style={{ color: '#94A3B8' }}>
              {titulo}
            </span>
          )}
          {acciones && <div className="ml-auto shrink-0 flex items-center gap-2 flex-wrap justify-end">{acciones}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {criticas.map((m) => (
          <TarjetaMetrica key={m.label} m={m} />
        ))}
      </div>

      {haySecundarias && (
        <>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md transition-colors"
            style={{ color: '#667085', background: expandido ? '#F1F5F9' : 'transparent' }}
            aria-expanded={expandido}
          >
            {expandido ? 'Ocultar' : labelExpandir}
            <svg
              className={`w-3 h-3 transition-transform motion-reduce:transition-none ${expandido ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandido && (
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
                    background: `${m.color}0F`,
                    color: m.colorTexto,
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
        </>
      )}
    </div>
  );
}

function TarjetaMetrica({ m }: { m: MetricaCard }) {
  const clickable = Boolean(m.onClick);
  // Jerarquía por severidad (heredada del diseño previo): un valor 0 se
  // atenúa para no competir con lo que sí exige atención, pero sigue legible.
  const cero = m.valor === 0;
  return (
    <button
      type="button"
      onClick={m.onClick}
      disabled={!clickable}
      aria-pressed={m.activo}
      aria-label={`${m.label}: ${m.valor}${m.sublabel ? ` — ${m.sublabel}` : ''}`}
      className={`micro-card flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 ${
        clickable ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{
        background: m.activo ? '#E8F3EC' : `${m.color}0D`,
        border: `1px solid ${m.activo ? '#17643A' : `${m.color}26`}`,
        opacity: cero ? 0.72 : 1,
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: m.color }}
      >
        {m.icono}
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-black leading-none tabular-nums" style={{ color: m.colorTexto }}>
          {m.valor}
        </span>
        <span className="block text-[13px] font-bold leading-tight mt-0.5" style={{ color: '#1F2933' }}>
          {m.label}
        </span>
        {m.sublabel && (
          <span className="block text-[11px] leading-tight mt-0.5 truncate" style={{ color: '#6B7A70' }}>
            {m.sublabel}
          </span>
        )}
      </span>
    </button>
  );
}
