'use client';

import type { ReactNode } from 'react';
import type { KpisOperativos } from '@/lib/kpis-operativos/calcular-kpis-operativos';
import type { FiltroKpiOperativo } from '@/lib/kpis-operativos/filtrar-por-kpi-operativo';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 2 — Barra secundaria de KPIs operativos.

   Sprint tablero-jerarquia (referencia Figma BZ8X6M4nqVqlCh27k5hnEz):
   esta barra pasó a ser la ÚNICA banda de estado del Tablero — el
   `chipsExtra` opcional permite que el llamador intercale los chips
   MIPG compactos (Prioridad, En término, Devueltas/Prórroga, Fuera de
   término) ANTES de las pastillas operativas, bajo un solo rótulo
   "Estado operativo", sin duplicar el layout de banda.

   Estilo intencionalmente más discreto que las tarjetas MIPG grandes
   para dejar claro que estas métricas son operativas del día a día.
══════════════════════════════════════════════════════════════ */

interface PastillaConfig {
  id:     Exclude<FiltroKpiOperativo, 'NINGUNO'>;
  label:  string;
  valor:  number;
  tono:   'neutral' | 'ambar' | 'rojo' | 'verde';
  title:  string;
}

const TONOS: Record<PastillaConfig['tono'], { bg: string; text: string; border: string; textActivo: string; bgActivo: string }> = {
  neutral: { bg: 'white', text: '#1F2933', border: '#D9E2D9', bgActivo: '#EEF4EE', textActivo: '#14532D' },
  ambar:   { bg: 'white', text: '#B45309', border: '#FBBF24', bgActivo: '#FEF3C7', textActivo: '#78350F' },
  rojo:    { bg: 'white', text: '#B91C1C', border: '#FECACA', bgActivo: '#FEF2F2', textActivo: '#7F1D1D' },
  verde:   { bg: 'white', text: '#166534', border: '#BBF7D0', bgActivo: '#F0FDF4', textActivo: '#14532D' },
};

export interface BarraKpisOperativosProps {
  kpis:          KpisOperativos;
  filtroActivo:  FiltroKpiOperativo;
  onChange:      (filtro: FiltroKpiOperativo) => void;
  /** Sprint Cola personal — activos asignados al usuario de la sesión. */
  misAsignados?:     number;
  soloMios?:         boolean;
  onToggleSoloMios?: () => void;
  /** Sprint tablero-jerarquia — chips adicionales (hoy: MIPG compactos)
   *  que se intercalan en la misma banda, antes de las pastillas
   *  operativas, para fusionar las dos franjas en una sola. */
  chipsExtra?: ReactNode;
}

export function BarraKpisOperativos({
  kpis,
  filtroActivo,
  onChange,
  misAsignados = 0,
  soloMios = false,
  onToggleSoloMios,
  chipsExtra,
}: BarraKpisOperativosProps) {
  const pastillas: PastillaConfig[] = [
    { id: 'HOY',            label: 'Hoy',              valor: kpis.hoy,            tono: 'neutral',
      title: 'Radicados recibidos hoy (día colombiano).' },
    { id: 'SIN_ASIGNAR',    label: 'Sin asignar',      valor: kpis.sinAsignar,     tono: 'ambar',
      title: 'PENDIENTES sin responsable asignado.' },
    { id: 'SIN_SELLAR',     label: 'Sin sellar',       valor: kpis.sinSellar,      tono: 'ambar',
      title: 'Activos con al menos un PDF sin sellar en los últimos 30 días.' },
    { id: 'CORREO_FALLIDO', label: 'Correo fallido',   valor: kpis.correoFallido,  tono: 'rojo',
      title: 'Radicados con alerta de correo institucional fallido.' },
    { id: 'RESUELTOS_HOY',  label: 'Resueltos hoy',    valor: kpis.resueltosHoy,   tono: 'verde',
      title: 'Radicados con respuesta oficial registrada hoy.' },
  ];

  function handleClick(id: PastillaConfig['id']) {
    // Toggle: si ya está activo, se desactiva.
    onChange(filtroActivo === id ? 'NINGUNO' : id);
  }

  return (
    <div
      className="px-3 sm:px-4 py-1.5 shrink-0 bg-white"
      style={{ borderBottom: '1px solid #D9E2D9' }}
      aria-label="Estado operativo del día"
    >
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <span
          className="shrink-0 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: '#667085' }}
        >
          Estado operativo
        </span>
        {chipsExtra}
        {pastillas.map((p) => {
          const activo = filtroActivo === p.id;
          const t = TONOS[p.tono];
          // Jerarquía por severidad (sprint tablero-jerarquia): valor 0 se
          // atenúa (opacity ~0.55 + borde gris) pero el chip queda
          // deshabilitado igual que antes — no tiene sentido filtrar por
          // un estado vacío. El texto no pierde AA: la pastilla nunca
          // dependió de opacidad para su contraste, solo se retira del
          // primer plano visual.
          const deshabilitada = p.valor === 0 && !activo;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleClick(p.id)}
              disabled={deshabilitada}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed"
              style={{
                background:  activo ? t.bgActivo : t.bg,
                color:       activo ? t.textActivo : t.text,
                borderColor: deshabilitada ? '#D9E2D9' : t.border,
                opacity:     deshabilitada ? 0.55 : 1,
              }}
              aria-pressed={activo}
              aria-label={`KPI operativo: ${p.label} (${p.valor})`}
              title={p.title}
            >
              <span className="tabular-nums font-bold">{p.valor}</span>
              <span>{p.label}</span>
            </button>
          );
        })}

        {/* Sprint Cola personal — filtro de identidad, no un KPI: recorta
            la bandeja a lo asignado al usuario. Va al final, separado. */}
        {onToggleSoloMios && (
          <button
            type="button"
            onClick={onToggleSoloMios}
            className="shrink-0 ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide transition-all"
            style={soloMios
              ? { background: '#14532D', color: '#FFFFFF', borderColor: '#14532D' }
              : { background: 'white', color: '#14532D', borderColor: '#97C459' }}
            aria-pressed={soloMios}
            aria-label={`Solo los míos (${misAsignados} activos)`}
            title="Muestra solo los radicados asignados a ti; combinable con los demás filtros."
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="tabular-nums font-bold">{misAsignados}</span>
            <span>Solo los míos</span>
          </button>
        )}
      </div>
    </div>
  );
}
