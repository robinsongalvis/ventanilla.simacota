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
  const ring: Record<typeof color, string> = {
    indigo:  'border-indigo-500/30 bg-indigo-500/10',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    rose:    'border-rose-500/30 bg-rose-500/10',
    amber:   'border-amber-500/30 bg-amber-500/10',
    sky:     'border-sky-500/30 bg-sky-500/10',
  };
  const txt: Record<typeof color, string> = {
    indigo:  'text-indigo-400',
    emerald: 'text-emerald-400',
    rose:    'text-rose-400',
    amber:   'text-amber-400',
    sky:     'text-sky-400',
  };

  return (
    <div className={`rounded-2xl border ${ring[color]} p-5 flex flex-col gap-3`}>
      <div className={`w-9 h-9 rounded-xl ${ring[color]} border flex items-center justify-center ${txt[color]}`}>
        {icono}
      </div>
      <div>
        <p className="text-2xl font-black text-slate-50 tabular-nums leading-none">{valor}</p>
        {sub && <p className={`text-xs mt-0.5 ${txt[color]}`}>{sub}</p>}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
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
    <div className={`w-full ${height} rounded-full bg-white/[0.06] overflow-hidden`}>
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
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-100">{label}</h3>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <SeccionTitulo label="Ranking por dependencia" sub="Ordenado por volumen recibido" />
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-slate-500 py-4 text-center">Sin datos en el período</p>
        )}
        {rows.map((r) => (
          <div key={r.tenantId} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-200 truncate">{r.nombre}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-black text-slate-100 tabular-nums">{r.recibidos}</span>
                  {r.vencidos > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      {r.vencidos}v
                    </span>
                  )}
                </div>
              </div>
              <BarraProgreso pct={(r.recibidos / max) * 100} color="bg-indigo-500" />
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-slate-600">
                  ✓ {r.resueltos} resueltos · ~{r.promDias}d hab.
                </span>
                <span className="text-[10px] text-slate-600 ml-auto">{r.pctCarga}% del total</span>
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
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <SeccionTitulo label="Tipos de solicitud más frecuentes" sub="Top 6 por volumen" />
      <div className="space-y-3">
        {tipos.map((t, i) => (
          <div key={t.nombre}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-300 truncate flex-1">{t.nombre}</p>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[10px] text-slate-500 tabular-nums">{t.conteo}</span>
                <span className="text-[10px] font-bold text-slate-400">{t.pct}%</span>
              </div>
            </div>
            <BarraProgreso pct={(t.pct / max) * 100} color={colores[i % colores.length]} />
          </div>
        ))}
        {tipos.length === 0 && (
          <p className="text-sm text-slate-500 py-4 text-center">Sin datos en el período</p>
        )}
      </div>
    </div>
  );
}

/* ── Zonas geográficas ────────────────────────────────────── */

const ZONA_COLOR: Record<string, { anillo: string; badge: string; bg: string }> = {
  CASCO_URBANO:   { anillo: '#6366F1', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',  bg: 'bg-indigo-500/5'  },
  ZONA_RURAL:     { anillo: '#10B981', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', bg: 'bg-emerald-500/5' },
  ZONA_YARIGUIES: { anillo: '#F59E0B', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',      bg: 'bg-amber-500/5'   },
};

function SectionZonas({ zonas }: { zonas: MetricaZona[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <SeccionTitulo label="Distribución por zona geográfica" sub="Casco Urbano · Rural · Yariguíes" />
      <div className="grid grid-cols-3 gap-3">
        {zonas.map((z) => {
          const c = ZONA_COLOR[z.zona];
          return (
            <div key={z.zona} className={`rounded-xl ${c.bg} border border-white/[0.06] p-4 flex flex-col items-center gap-2`}>
              <div className="relative flex items-center justify-center">
                <AnilloSvg pct={z.pct} color={c.anillo} />
                <span className="absolute text-base font-black text-slate-100 tabular-nums">{z.pct}%</span>
              </div>
              <p className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>{z.label}</p>
              <p className="text-xs font-black text-slate-100 tabular-nums">{z.total}</p>
              <p className="text-[10px] text-slate-500 text-center leading-tight truncate w-full px-1">
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

  const opciones: { valor: PeriodoAnalytics; label: string }[] = [
    { valor: 30,    label: 'Últimos 30 d' },
    { valor: 60,    label: 'Últimos 60 d' },
    { valor: 90,    label: 'Últimos 90 d' },
    { valor: 'TODO', label: 'Histórico completo' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0B]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0B]/90 backdrop-blur-md border-b border-white/[0.07] px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-100">Centro de Inteligencia Operativa</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {globales.totalPeriodo} radicados analizados · {totalBase} en histórico
          </p>
        </div>

        {/* Selector de período */}
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
          {opciones.map((o) => (
            <button
              key={String(o.valor)}
              onClick={() => setPeriodo(o.valor)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                periodo === o.valor
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* KPIs */}
        <SectionKPIs g={globales} />

        {/* Fila: ranking + tipos */}
        <div className="grid lg:grid-cols-2 gap-6">
          <SectionDependencias rows={porDependencia.slice(0, 8)} />
          <SectionTipos tipos={tiposFrecuentes} />
        </div>

        {/* Zonas */}
        <SectionZonas zonas={porZona} />

        {/* Footer contextual */}
        <p className="text-[10px] text-slate-700 text-center pb-2">
          Alcaldía Municipal de Simacota · Datos en tiempo real · severityScore activo (Fase 3 ready)
        </p>
      </div>
    </div>
  );
}
