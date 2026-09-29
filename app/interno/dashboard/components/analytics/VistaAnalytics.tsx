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
import type { IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { ChipFiltro } from '@/app/components/design-system/ChipFiltro';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { AlertTriangle, BellRing, CheckCircle2, Clock3, FileText, Users } from 'lucide-react';

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
    <div className={`w-full ${height} rounded-full overflow-hidden`} style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
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
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--tema-borde-e4ebf0)" strokeWidth="8" />
      {pct > 0 && <circle
        cx="40" cy="40" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />}
    </svg>
  );
}

function SeccionTitulo({ label, sub }: { label: string; sub?: string }) {
  return <SectionHeader titulo={label} subtitulo={sub} variante="compact" />;
}

/* ── Sección KPIs ─────────────────────────────────────────── */

/* Ola 3 (ADR-0046): los mismos seis indicadores, con el Indicador del
   Tablero (solo lectura: no filtran). La aclaración que antes iba debajo
   del valor se conserva como segunda línea visible. */
function SectionKPIs({ g }: { g: MetricasGlobales }) {
  const kpis: IndicadorEstaticoProps[] = [
    { etiqueta: 'Total radicados', valor: g.totalPeriodo, tono: 'gris', Icono: FileText },
    {
      etiqueta: 'Tasa de resolución', valor: `${g.tasaResolucion}%`, tono: 'verde', Icono: CheckCircle2,
      descripcion: `${g.resueltos} resueltos`, descripcionVisible: true,
    },
    {
      etiqueta: 'Promedio de respuesta', valor: `${g.promedioRespuestaDias}d`, tono: 'azul', Icono: Clock3,
      descripcion: 'días hábiles (resueltos)', descripcionVisible: true,
    },
    { etiqueta: 'Vencidos activos', valor: g.vencidosActivos, tono: 'rojo', Icono: AlertTriangle },
    { etiqueta: 'Por vencer (≤ 2 días)', valor: g.porVencerHoy, tono: 'ambar', Icono: BellRing },
    {
      etiqueta: g.dependenciaMayorCarga?.nombre ?? 'Sin datos', valor: g.dependenciaMayorCarga?.total ?? 0,
      tono: 'gris', Icono: Users, descripcion: 'Dependencia mayor carga', descripcionVisible: true,
    },
  ];

  return (
    <FilaTarjetas etiqueta="Indicadores del período">
      {kpis.map((k) => (
        <TarjetaIndicador key={k.etiqueta} {...k} />
      ))}
    </FilaTarjetas>
  );
}

/* ── Ranking por dependencia ──────────────────────────────── */

function SectionDependencias({ rows }: { rows: MetricaPorDependencia[] }) {
  const max = rows[0]?.recibidos ?? 1;
  return (
    <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
      <SeccionTitulo label="Ranking por dependencia" sub="Ordenado por volumen recibido" />
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--tema-texto-64748b)' }}>Sin datos en el período</p>
        )}
        {rows.map((r) => (
          <div key={r.tenantId} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--tema-texto-172033)' }}>{r.nombre}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-black tabular-nums" style={{ color: 'var(--tema-texto-172033)' }}>{r.recibidos}</span>
                  {r.vencidos > 0 && (
                    <StatusBadge tono="danger" tamano="sm">
                      {r.vencidos} vencido{r.vencidos !== 1 ? 's' : ''}
                    </StatusBadge>
                  )}
                </div>
              </div>
              <BarraProgreso pct={(r.recibidos / max) * 100} color="bg-[var(--tema-fondo-007049)]" />
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>
                  ✓ {r.resueltos} resueltos · ~{r.promDias}d hab.
                </span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--tema-texto-64748b)' }}>{r.pctCarga}% del total</span>
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
    <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
      <SeccionTitulo label="Tipos de solicitud más frecuentes" sub="Top 6 por volumen" />
      <div className="space-y-3">
        {tipos.map((t, i) => (
          <div key={t.nombre}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs truncate flex-1" style={{ color: 'var(--tema-texto-172033)' }}>{t.nombre}</p>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{t.conteo}</span>
                <span className="text-[10px] font-bold" style={{ color: 'var(--tema-texto-64748b)' }}>{t.pct}%</span>
              </div>
            </div>
            <BarraProgreso pct={(t.pct / max) * 100} color={colores[i % colores.length]} />
          </div>
        ))}
        {tipos.length === 0 && (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--tema-texto-64748b)' }}>Sin datos en el período</p>
        )}
      </div>
    </div>
  );
}

/* ── Zonas geográficas ────────────────────────────────────── */

const ZONA_COLOR: Record<string, { anillo: string; badge: string; bg: string; border: string }> = {
  CASCO_URBANO:   { anillo: '#007049', badge: 'bg-[var(--tema-fondo-f4f9f6)] text-[var(--tema-texto-007049)] border-[var(--tema-borde-dce4ea)]', bg: 'var(--tema-fondo-f4f9f6)', border: 'var(--tema-borde-dce4ea)' },
  ZONA_RURAL:     { anillo: '#008F5A', badge: 'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300 border-green-200 oscuro:border-green-500/30',   bg: 'var(--tema-fondo-f0fdf4)', border: 'var(--tema-borde-bbf7d0)' },
  ZONA_YARIGUIES: { anillo: '#D97706', badge: 'bg-amber-50 oscuro:bg-amber-500/15 text-amber-700 oscuro:text-amber-300 border-amber-200 oscuro:border-amber-500/30',   bg: 'var(--tema-fondo-fffbeb)', border: 'var(--tema-borde-fde68a)' },
};

function SectionZonas({ zonas }: { zonas: MetricaZona[] }) {
  return (
    <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] px-3.5 py-3" style={{ border: '1px solid var(--tema-borde-e4ebf0)' }}>
      <SeccionTitulo label="Distribución por zona geográfica" sub="Casco Urbano · Rural · Yariguíes" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {zonas.map((z) => {
          const c = ZONA_COLOR[z.zona] ?? { anillo: '#94A3B8', badge: 'bg-gray-100 oscuro:bg-white/5 text-gray-600 oscuro:text-slate-400 border-gray-200 oscuro:border-white/10', bg: 'var(--tema-fondo-f7f9fb)', border: 'var(--tema-borde-dce4ea)' };
          return (
            <div key={z.zona} className="rounded-xl p-4 flex flex-col items-center gap-2"
                 style={{ background: c.bg, border: `1px solid ${c.border}` }}>
              <div className="relative flex items-center justify-center">
                <AnilloSvg pct={z.pct} color={c.anillo} />
                <span className="absolute text-sm font-black tabular-nums" style={{ color: 'var(--tema-texto-172033)' }}>{z.pct}%</span>
              </div>
              <p className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>{z.label}</p>
              <p className="text-xs font-black tabular-nums" style={{ color: 'var(--tema-texto-172033)' }}>{z.total}</p>
              {/* Sobre la tarjeta tintada, #475569: #64748B quedaba en 4,47:1. */}
              <p className="text-[10px] text-center leading-tight truncate w-full px-1" style={{ color: 'var(--tema-texto-475569)' }}>
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
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* Header */}
      <SectionHeader
        titulo="Centro de Inteligencia Operativa"
        subtitulo={`${globales.totalPeriodo} radicados analizados · ${totalBase} en ventana operativa`}
        acciones={
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período del análisis">
            {opciones.map((o) => (
              <ChipFiltro
                key={String(o.valor)}
                etiqueta={o.label}
                activo={periodo === o.valor}
                onClick={() => setPeriodo(o.valor)}
              />
            ))}
          </div>
        }
      />

      {/* Contenido */}
      <div className="px-4 pt-2 pb-4 space-y-3 md:px-6">
        <SectionKPIs g={globales} />
        <div className="grid lg:grid-cols-2 gap-3">
          <SectionDependencias rows={porDependencia.slice(0, 8)} />
          <SectionTipos tipos={tiposFrecuentes} />
        </div>
        <SectionZonas zonas={porZona} />
        <p className="text-[10px] pb-2" style={{ color: 'var(--tema-texto-64748b)' }}>
          Alcaldía Municipal de Simacota · Datos en tiempo real · Alertas ordenadas por severidad
        </p>
      </div>
    </div>
  );
}
