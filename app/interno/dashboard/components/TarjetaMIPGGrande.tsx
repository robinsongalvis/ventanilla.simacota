'use client';

import type { ReactNode } from 'react';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import type { RadicadoCritico } from '@/lib/kpis-mipg/radicado-mas-critico';
import type { TokensEstadoKpi } from '@/lib/kpis-mipg/tokens-estado-kpi';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo — Tarjeta KPI grande (rediseño 3B.2 "sala de
   operaciones"; jerarquía por severidad, sprint tablero-jerarquia).

   Una de las 4 tarjetas accionables (Vencidas, Por vencer, Radicadas,
   Asignadas). Profundidad por capas: tarjeta con riel superior de color
   + chip de estado + panel del radicado crítico tintado. El color
   comunica estado, nunca decora.

   Jerarquía por severidad: la tarjeta con `dominante` (hoy solo
   Vencidas > 0) gana peso visual (riel/borde más grueso, número más
   grande) para que la mirada aterrice ahí primero. Una tarjeta con
   `atenuada` (valor === 0) se retira visualmente pero sigue activa y
   clicable — nunca desaparece ni se deshabilita, solo dejamos de
   competir por atención con un estado que no existe hoy.

   El atenuado NO usa opacidad sobre el texto: el texto pasa a un gris
   oscuro (#0F172A) que conserva ≥ 4.5:1 de contraste incluso después
   de aplicar opacity 0.55 al contenedor completo (WCAG 2.1 AA) — solo
   el cromado (riel, tinte, chip) pierde color.

   Clic en la zona superior filtra la bandeja; clic en el radicado
   destacado abre su detalle. Nunca muestra el nombre del solicitante —
   solo id, dependencia y razón (respeta identidades reservadas).
══════════════════════════════════════════════════════════════ */

const VERDE_INST = '#14532D';

/** Trío de color neutro para el estado "atenuado" (valor === 0).
 *  El texto usa un gris casi negro a propósito: tras el opacity 0.55
 *  del contenedor sigue cumpliendo AA (ver nota arriba). */
const TOKENS_ATENUADOS: TokensEstadoKpi = {
  riel:      '#CBD5D1',
  texto:     '#0F172A',
  tinte:     '#F8FAFC',
  chipBg:    '#F1F5F9',
  chipTexto: '#0F172A',
  chipLabel: 'sin casos',
};

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
  /** Jerarquía por severidad — gana peso visual (hoy: Vencidas > 0).
   *  Mutuamente excluyente con `atenuada` en la práctica. */
  dominante?: boolean;
  /** Jerarquía por severidad — valor 0: se atenúa pero sigue visible
   *  y clicable (nunca se deshabilita). */
  atenuada?: boolean;
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
  dominante = false,
  atenuada = false,
}: TarjetaMIPGGrandeProps) {
  const t = atenuada ? TOKENS_ATENUADOS : tokens;
  const numeroFontSize = dominante ? 44 : 34;
  const rielAncho = dominante ? 5 : 3;
  const bordeAncho = dominante ? 2 : 1;

  return (
    <div
      className="shrink-0 rounded-[14px] bg-white flex flex-col overflow-hidden"
      style={{
        border: `${bordeAncho}px solid ${activo ? VERDE_INST : dominante ? t.riel : '#E3EAE3'}`,
        borderTop: `${rielAncho}px solid ${t.riel}`,
        boxShadow: dominante ? '0 2px 8px rgba(220,38,38,.12)' : '0 1px 3px rgba(20,50,30,.05)',
        opacity: atenuada ? 0.55 : 1,
        minWidth: dominante ? 225 : 205,
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
            style={{ color: t.texto }}
          >
            {icono}
            {label}
          </span>
          <span
            className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: t.chipBg, color: t.chipTexto }}
          >
            {t.chipLabel}
          </span>
        </span>
        <span
          className="block font-black tabular-nums leading-none mt-1.5"
          style={{ fontSize: numeroFontSize, color: atenuada ? t.texto : '#12261A' }}
        >
          {valor}
        </span>
      </button>

      {/* Zona inferior: panel tintado del radicado más crítico. */}
      <div className="m-2.5 mt-2 rounded-[10px] px-3 py-2.5" style={{ background: t.tinte }}>
        <span className="block text-[10px] font-semibold uppercase tracking-widest" style={{ color: atenuada ? t.texto : '#94A3B8' }}>
          {criticoLabel}
        </span>
        {critico ? (
          <button
            type="button"
            onClick={() => onAbrirRadicado(critico.radicadoId)}
            aria-label={`Abrir radicado ${critico.radicadoId}`}
            className="mt-1 text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 rounded"
          >
            <span className="block font-mono text-[13px] font-bold" style={{ color: atenuada ? t.texto : '#12261A' }}>
              {critico.radicadoId}
            </span>
            <span className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-[11px]" style={{ color: t.texto }}>
                {critico.razon} · {NOMBRES_TENANT[critico.oficinaDestino] ?? critico.oficinaDestino}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium shrink-0" style={{ color: t.texto }}>
                Abrir
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </span>
          </button>
        ) : (
          <span className="block text-[11px] italic mt-1" style={{ color: atenuada ? t.texto : '#94A3B8' }}>Sin radicados</span>
        )}
      </div>
    </div>
  );
}
