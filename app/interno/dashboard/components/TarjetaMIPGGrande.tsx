'use client';

import type { ReactNode } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { RadicadoCritico } from '@/lib/kpis-mipg/radicado-mas-critico';
import type { TokensEstadoKpi } from '@/lib/kpis-mipg/tokens-estado-kpi';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo — Tarjeta KPI grande (rediseño 3B.2 "sala de
   operaciones").

   Una de las 4 tarjetas accionables (Vencidas, Por vencer, Radicadas,
   Asignadas). Profundidad por capas: tarjeta con riel superior de color
   + chip de estado + panel del radicado crítico tintado. El color
   comunica estado, nunca decora.

   Clic en la zona superior filtra la bandeja; clic en el radicado
   destacado abre su detalle. Nunca muestra el nombre del solicitante —
   solo id, dependencia y razón (respeta identidades reservadas).
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';

export interface TarjetaMIPGGrandeProps {
  label:        string;
  valor:        number;
  icono:        ReactNode;
  /** Trío de color por estado (riel, tinte, texto, chip). */
  tokens:       TokensEstadoKpi;
  /** Etiqueta del bloque crítico ("Más crítico", "Más antiguo sin asignar", ...). */
  criticoLabel: string;
  activo:       boolean;
  critico:      RadicadoCritico | null;
  onFiltrar:    () => void;
  onAbrirRadicado: (id: string) => void;
}

export function TarjetaMIPGGrande({
  label,
  valor,
  icono,
  tokens,
  criticoLabel,
  activo,
  critico,
  onFiltrar,
  onAbrirRadicado,
}: TarjetaMIPGGrandeProps) {
  return (
    <div
      className="shrink-0 rounded-[14px] bg-white flex flex-col overflow-hidden"
      style={{
        border: `1px solid ${activo ? VERDE_INST : '#E3EAE3'}`,
        borderTop: `3px solid ${tokens.riel}`,
        boxShadow: '0 1px 3px rgba(20,50,30,.05)',
        minWidth: 205,
      }}
    >
      {/* Zona superior: filtra la bandeja. */}
      <button
        type="button"
        onClick={onFiltrar}
        aria-pressed={activo}
        aria-label={`Filtrar bandeja por ${label} (${valor})`}
        className="text-left px-3 pt-3 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
        style={{ background: activo ? '#EEF4EE' : 'transparent' }}
      >
        <span className="flex items-center justify-between gap-2">
          <span
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: tokens.texto }}
          >
            {icono}
            {label}
          </span>
          <span
            className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: tokens.chipBg, color: tokens.chipTexto }}
          >
            {tokens.chipLabel}
          </span>
        </span>
        <span className="block font-black tabular-nums leading-none mt-1.5" style={{ fontSize: 34, color: '#12261A' }}>
          {valor}
        </span>
      </button>

      {/* Zona inferior: panel tintado del radicado más crítico. */}
      <div className="m-2.5 mt-2 rounded-[10px] px-3 py-2.5" style={{ background: tokens.tinte }}>
        <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          {criticoLabel}
        </span>
        {critico ? (
          <button
            type="button"
            onClick={() => onAbrirRadicado(critico.radicadoId)}
            aria-label={`Abrir radicado ${critico.radicadoId}`}
            className="mt-1 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 rounded"
          >
            <span className="block font-mono text-[13px] font-bold" style={{ color: '#12261A' }}>
              {critico.radicadoId}
            </span>
            <span className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-[11px]" style={{ color: tokens.texto }}>
                {critico.razon} · {NOMBRES_TENANT[critico.oficinaDestino] ?? critico.oficinaDestino}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium shrink-0" style={{ color: tokens.texto }}>
                Abrir
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </span>
          </button>
        ) : (
          <span className="block text-[11px] italic mt-1" style={{ color: '#94A3B8' }}>Sin radicados</span>
        )}
      </div>
    </div>
  );
}
