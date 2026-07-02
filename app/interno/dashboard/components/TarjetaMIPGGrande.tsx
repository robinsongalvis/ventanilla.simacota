'use client';

import type { ReactNode } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { RadicadoCritico } from '@/lib/kpis-mipg/radicado-mas-critico';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 3B — Tarjeta KPI grande.

   Una de las 4 tarjetas accionables (Vencidas, Por vencer, Radicadas,
   Asignadas). Muestra ícono + etiqueta + número grande + el radicado
   más crítico del grupo. Clic en la tarjeta filtra la bandeja; clic en
   el radicado destacado abre su detalle.

   Nunca muestra el nombre del solicitante — solo id, dependencia y la
   razón de criticidad (respeta identidades reservadas).
══════════════════════════════════════════════════════════════ */

export interface TarjetaMIPGGrandeProps {
  label:        string;
  valor:        number;
  icono:        ReactNode;
  /** Color del riel y del acento (hex). */
  color:        string;
  /** Color del texto de la razón de criticidad (hex). */
  razonColor:   string;
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
  color,
  razonColor,
  criticoLabel,
  activo,
  critico,
  onFiltrar,
  onAbrirRadicado,
}: TarjetaMIPGGrandeProps) {
  return (
    <div
      className="shrink-0 rounded-xl bg-white flex flex-col"
      style={{
        border: `1px solid ${activo ? '#14532D' : '#D9E2D9'}`,
        borderLeft: `3px solid ${color}`,
        minWidth: 150,
      }}
    >
      {/* Zona superior: filtra la bandeja. */}
      <button
        type="button"
        onClick={onFiltrar}
        aria-pressed={activo}
        aria-label={`Filtrar bandeja por ${label} (${valor})`}
        className="text-left px-3.5 py-3 rounded-t-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
        style={{ background: activo ? '#EEF4EE' : 'transparent' }}
      >
        <span
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: razonColor }}
        >
          {icono}
          {label}
        </span>
        <span className="block text-3xl font-black tabular-nums leading-none mt-1.5" style={{ color: '#1F2933' }}>
          {valor}
        </span>
      </button>

      {/* Zona inferior: radicado más crítico (abre su detalle). */}
      <div className="px-3.5 pb-3 pt-2" style={{ borderTop: '1px solid #EEF4EE' }}>
        <span className="block text-[9px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          {criticoLabel}
        </span>
        {critico ? (
          <button
            type="button"
            onClick={() => onAbrirRadicado(critico.radicadoId)}
            aria-label={`Abrir radicado ${critico.radicadoId}`}
            className="mt-1 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 rounded"
          >
            <span className="block font-mono text-xs font-bold underline underline-offset-2" style={{ color: '#14532D' }}>
              {critico.radicadoId}
            </span>
            <span className="block text-[11px] mt-0.5" style={{ color: razonColor }}>
              {critico.razon} · {NOMBRES_TENANT[critico.oficinaDestino] ?? critico.oficinaDestino}
            </span>
          </button>
        ) : (
          <span className="block text-[11px] italic mt-1" style={{ color: '#94A3B8' }}>Sin radicados</span>
        )}
      </div>
    </div>
  );
}
