'use client';

import type { KpisOperativos } from '@/lib/kpis-operativos/calcular-kpis-operativos';
import type { FiltroKpiOperativo } from '@/lib/kpis-operativos/filtrar-por-kpi-operativo';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 2 — Barra secundaria de KPIs operativos.

   Ubicada bajo la barra MIPG oficial. Cinco pastillas compactas
   que la funcionaria de Ventanilla puede usar como filtro adicional
   (combinable con el filtro MIPG activo; solo un filtro operativo
   activo a la vez).

   Estilo intencionalmente más discreto que la barra MIPG para dejar
   claro que estas métricas son operativas del día a día, no del set
   MIPG oficial de gerencia.
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
}

export function BarraKpisOperativos({
  kpis,
  filtroActivo,
  onChange,
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
        {pastillas.map((p) => {
          const activo = filtroActivo === p.id;
          const t = TONOS[p.tono];
          const deshabilitada = p.valor === 0 && !activo;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleClick(p.id)}
              disabled={deshabilitada}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background:  activo ? t.bgActivo : t.bg,
                color:       activo ? t.textActivo : t.text,
                borderColor: t.border,
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
      </div>
    </div>
  );
}
