'use client';

/**
 * VistaAnalytics.tsx — Centro de Inteligencia Operativa Municipal
 *
 * Visualiza todas las métricas calculadas por useAnalytics.
 * Sin librerías de gráficos externas: barras y anillos con CSS/SVG puro.
 */

import { useState }         from 'react';
import type { TenantId }    from '@/src/types/radicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  useAnalytics,
  type PeriodoAnalytics,
  type MetricaPorDependencia,
  type MetricaZona,
  type TipoFrecuente,
  type MetricasGlobales,
} from './useAnalytics';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';

/* ══════════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════════ */

interface Props {
  radicados:        VentanillaRadicado[];
  esAdmin:          boolean;
  tenantIdUsuario:  TenantId;
}

/* ══════════════════════════════════════════════════════════════
   SUB-COMPONENTES
══════════════════════════════════════════════════════════════ */

function KpiCard({
  label,
  valor,
  sub,
  color = 'indigo',
  icono,
}: {
  label: string;
  valor: string | number;
  sub?: string;
  color?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky';
  icono: React.ReactNode;
}) {
  const ring: Record<typeof color, { border: string; bg: string; text: string; iconBg: string }> = {
    indigo:  { border: '#D9E2D9', bg: '#EEF4EE', text: '#14532D', iconBg: '#D9E2D9' },
    emerald: { border: '#BBF7D0', bg: '#F0FDF4', text: '#166534', iconBg: '#BBF7D0' },
    rose:    { border: '#FECACA', bg: '#FEF2F2', text: '#DC2626', iconBg: '#FECACA' },
    amber:   { border: '#FDE68A', bg: '#FFFBEB', text: '#B45309', iconBg: '#FDE68A' },
    sky:     { border: '#BAE6FD', bg: '#F0F9FF', text: '#0369A1', iconBg: '#BAE6FD' },
  };
  const c = ring[color];

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 bg-white"
         style={{ border: `1px solid ${c.border}`, boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
           style={{ background: c.iconBg, color: c.text }}>
        {icono}
      </div>
      <div>
        <p className="text-2xl font-black tabular-nums leading-none" style={{ color: '#1F2933' }}>{valor}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: c.text }}>{sub}</p>}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</p>
    </div>
  );
}

function BarraProgreso({
  pct,
  color = 'bg-indigo-500',
  height = 'h-1.5',
}: {
  pct: number;
  color?: string;
  height?: string;
}) {
  return (
    <div className={`w-full ${height} rounded-full overflow-hidden`} style={{ background: '#EEF4EE' }}>
      <div
        className={`${height} rounded-full ${color} transition-all duration-700`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function AnilloSvg({ pct, color }: { pct: number; color: string }) {
  const r   = 30;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg viewBox="0 0 80 80" className="w-16 h-16 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

function SeccionTitulo({ label, sub }: { label: string; sub?: string }) {
  return <SectionHeader titulo={label} subtitulo={sub} variante="compact" />;
}

/* ── Sección KPIs ─────────────────────────────────────────── */

function SectionKPIs({ g }: { g: MetricasGlobales }) {
  const kpis = [
    {
      label: 'Total radicados',
      valor: g.totalPeriodo,
      color: 'indigo' as const,
      icono: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      label: 'Tasa de resolución',
      valor: `${g.tasaResolucion}%`,
      sub:   `${g.resueltos} resueltos`,
      color: 'emerald' as const,
      icono: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Promedio de respuesta',
      valor: `${g.promedioRespuestaDias}d`,
      sub:   'días hábiles (resueltos)',
      color: 'sky' as const,
      icono: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Vencidos activos',
      valor: g.vencidosActivos,
      color: 'rose' as const,
      icono: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
    },
    {
      label: 'Por vencer (≤ 2 días)',
      valor: g.porVencerHoy,
      color: 'amber' as const,
      icono: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
      ),
    },
    {
      label: g.dependenciaMayorCarga?.nombre ?? 'Sin datos',
      valor: g.dependenciaMayorCarga?.total ?? 0,
      sub:   'Dependencia mayor carga',
      color: 'indigo' as const,
      icono: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {kpis.map((k) => (
        <KpiCard key={k.label} {...k} />
      ))}
    </div>
  );
}

/* ── Ranking por dependencia ──────────────────────────────── */

function SectionDependencias({ rows }: { rows: MetricaPorDependencia[] }) {
  const max = rows[0]?.recibidos ?? 1;
  return (
    <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
      <SeccionTitulo label="Ranking por dependencia" sub="Ordenado por volumen recibido" />
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: '#94A3B8' }}>Sin datos en el período</p>
        )}
        {rows.map((r) => (
          <div key={r.tenantId} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold truncate" style={{ color: '#1F2933' }}>{r.nombre}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-black tabular-nums" style={{ color: '#1F2933' }}>{r.recibidos}</span>
                  {r.vencidos > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold">
                      {r.vencidos}v
                    </span>
                  )}
                </div>
              </div>
              <BarraProgreso pct={(r.recibidos / max) * 100} color="bg-[#14532D]" />
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                  ✓ {r.resueltos} resueltos · ~{r.promDias}d hab.
                </span>
                <span className="text-[10px] ml-auto" style={{ color: '#94A3B8' }}>{r.pctCarga}% del total</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tipos frecuentes ─────────────────────────────────────── */

function SectionTipos({ tipos }: { tipos: TipoFrecuente[] }) {
  const max = tipos[0]?.pct ?? 1;
  const colores = ['bg-indigo-500', 'bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
  return (
    <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
      <SeccionTitulo label="Tipos de solicitud más frecuentes" sub="Top 6 por volumen" />
      <div className="space-y-3">
        {tipos.map((t, i) => (
          <div key={t.nombre}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs truncate flex-1" style={{ color: '#1F2933' }}>{t.nombre}</p>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[10px] tabular-nums" style={{ color: '#94A3B8' }}>{t.conteo}</span>
                <span className="text-[10px] font-bold" style={{ color: '#667085' }}>{t.pct}%</span>
              </div>
            </div>
            <BarraProgreso pct={(t.pct / max) * 100} color={colores[i % colores.length]} />
          </div>
        ))}
        {tipos.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: '#94A3B8' }}>Sin datos en el período</p>
        )}
      </div>
    </div>
  );
}

/* ── Zonas geográficas ────────────────────────────────────── */

const ZONA_COLOR: Record<string, { anillo: string; badge: string; bg: string; border: string }> = {
  CASCO_URBANO:   { anillo: '#14532D', badge: 'bg-[#EEF4EE] text-[#14532D] border-[#D9E2D9]', bg: '#EEF4EE', border: '#D9E2D9' },
  ZONA_RURAL:     { anillo: '#16A34A', badge: 'bg-green-50 text-green-700 border-green-200',   bg: '#F0FDF4', border: '#BBF7D0' },
  ZONA_YARIGUIES: { anillo: '#D97706', badge: 'bg-amber-50 text-amber-700 border-amber-200',   bg: '#FFFBEB', border: '#FDE68A' },
};

function SectionZonas({ zonas }: { zonas: MetricaZona[] }) {
  return (
    <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
      <SeccionTitulo label="Distribución por zona geográfica" sub="Casco Urbano · Rural · Yariguíes" />
      <div className="grid grid-cols-3 gap-3">
        {zonas.map((z) => {
          const c = ZONA_COLOR[z.zona] ?? { anillo: '#94A3B8', badge: 'bg-gray-100 text-gray-600 border-gray-200', bg: '#F8FAF7', border: '#D9E2D9' };
          return (
            <div key={z.zona} className="rounded-xl p-4 flex flex-col items-center gap-2"
                 style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <div className="relative flex items-center justify-center">
                <AnilloSvg pct={z.pct} color={c.anillo} />
                <span className="absolute text-base font-black tabular-nums" style={{ color: '#1F2933' }}>{z.pct}%</span>
              </div>
              <p className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>{z.label}</p>
              <p className="text-xs font-black tabular-nums" style={{ color: '#1F2933' }}>{z.total}</p>
              <p className="text-[10px] text-center leading-tight truncate w-full px-1" style={{ color: '#94A3B8' }}>
                {z.tipoMasFrecuente}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

export function VistaAnalytics({ radicados, esAdmin, tenantIdUsuario }: Props) {
  const [periodo, setPeriodo] = useState<PeriodoAnalytics>(30);
  const { globales, porDependencia, tiposFrecuentes, porZona, totalBase } = useAnalytics(
    radicados,
    periodo,
    esAdmin ? 'TODOS' : tenantIdUsuario,
  );

  // ADR-0010 (R11): el stream que alimenta esta vista está acotado a una
  // ventana operativa de 180 días (useVentanillaRadicados). "TODO" ya no
  // es histórico completo desde el origen — es todo lo visible en esa
  // ventana. Copy pendiente de revisión de ux-ui (declarado en el
  // incremento 2A); se deja honesto en vez de mantener el texto anterior.
  const opciones: { valor: PeriodoAnalytics; label: string }[] = [
    { valor: 30,    label: 'Últimos 30 d' },
    { valor: 60,    label: 'Últimos 60 d' },
    { valor: 90,    label: 'Últimos 90 d' },
    { valor: 'TODO', label: 'Ventana operativa (180 d)' },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAF7' }}>
      {/* Header */}
      <SectionHeader
        titulo="Centro de Inteligencia Operativa"
        subtitulo={`${globales.totalPeriodo} radicados analizados · ${totalBase} en ventana operativa`}
        className="sticky top-0 z-10"
        acciones={
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
            {opciones.map((o) => (
              <button key={String(o.valor)} onClick={() => setPeriodo(o.valor)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150"
                style={periodo === o.valor
                  ? { background: '#14532D', color: '#ffffff' }
                  : { color: '#667085' }}>
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Contenido */}
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <SectionKPIs g={globales} />
        <div className="grid lg:grid-cols-2 gap-6">
          <SectionDependencias rows={porDependencia.slice(0, 8)} />
          <SectionTipos tipos={tiposFrecuentes} />
        </div>
        <SectionZonas zonas={porZona} />
        <p className="text-[10px] text-center pb-2" style={{ color: '#D9E2D9' }}>
          Alcaldía Municipal de Simacota · Datos en tiempo real · severityScore activo (Fase 3 ready)
        </p>
      </div>
    </div>
  );
}
