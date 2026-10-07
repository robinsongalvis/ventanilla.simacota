'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DesempenoDependencia,
  NivelRiesgo,
  PanoramaControlInterno,
  SemaforoKpi,
} from '@/src/types/control-interno';
import { LABEL_NIVEL_RIESGO } from '@/src/types/control-interno';
import { describirNivelRiesgo, type RecomendacionDia, type SeveridadRecomendacion } from '@/lib/control-interno/recomendaciones';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import type { TonoIndicador } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { AlertCircle, AlertOctagon, AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';

interface PanoramaResponse {
  ok?:           boolean;
  error?:        string;
  panorama?:     PanoramaControlInterno;
  dependencias?: DesempenoDependencia[];
  resumenRiesgo?: Record<NivelRiesgo, number>;
}

interface ResumenDiaResponse {
  ok?:              boolean;
  error?:           string;
  recomendaciones?: RecomendacionDia[];
  contadores?: {
    alertasAbiertas:      number;
    hallazgosAbiertos:    number;
    planesAbiertos:       number;
    planesVencidos:       number;
    dependenciasEnRiesgo: number;
  };
}

function colorSemaforo(s: SemaforoKpi): { bg: string; bd: string; fg: string } {
  if (s === 'VERDE')    return { bg: 'var(--tema-fondo-f0fdf4)', bd: 'var(--tema-borde-bbf7d0)', fg: 'var(--tema-texto-007049)' };
  if (s === 'AMARILLO') return { bg: 'var(--tema-fondo-fffbeb)', bd: 'var(--tema-borde-fde68a)', fg: 'var(--tema-texto-92400e)' };
  return                       { bg: 'var(--tema-fondo-fef2f2)', bd: 'var(--tema-borde-fecaca)', fg: 'var(--tema-texto-991b1b)' };
}

/* Ola 3 (ADR-0046): los niveles de riesgo usan el Indicador del Tablero. */
const INDICADOR_NIVEL: Record<NivelRiesgo, { tono: TonoIndicador; Icono: LucideIcon }> = {
  CRITICO: { tono: 'rojo',  Icono: AlertOctagon },
  ALTO:    { tono: 'ambar', Icono: AlertTriangle },
  MEDIO:   { tono: 'ambar', Icono: AlertCircle },
  BAJO:    { tono: 'verde', Icono: ShieldCheck },
};

function colorRecomendacion(s: SeveridadRecomendacion): { bg: string; bd: string; fg: string; Icono: LucideIcon } {
  if (s === 'URGENTE')     return { bg: 'var(--tema-fondo-fef2f2)', bd: 'var(--tema-borde-fecaca)', fg: 'var(--tema-texto-991b1b)', Icono: AlertTriangle };
  if (s === 'ATENCION')    return { bg: 'var(--tema-fondo-fffbeb)', bd: 'var(--tema-borde-fde68a)', fg: 'var(--tema-texto-92400e)', Icono: AlertCircle };
  if (s === 'INFORMATIVO') return { bg: 'var(--tema-fondo-f0f9ff)', bd: 'var(--tema-borde-bae6fd)', fg: 'var(--tema-texto-075985)', Icono: Info };
  return                          { bg: 'var(--tema-fondo-f0fdf4)', bd: 'var(--tema-borde-bbf7d0)', fg: 'var(--tema-texto-007049)', Icono: CheckCircle2 };
}

const LABEL_SEMAFORO: Record<SemaforoKpi, string> = {
  VERDE:    'Bien',
  AMARILLO: 'Atención',
  ROJO:     'Urgente',
};

export function PanoramaGeneralPanel() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data,  setData]  = useState<PanoramaResponse | null>(null);
  const [resumen, setResumen] = useState<ResumenDiaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (desde) p.set('desde', desde);
      if (hasta) p.set('hasta', hasta);
      const [panoramaRes, resumenRes] = await Promise.all([
        fetch(`/api/interno/control/panorama?${p.toString()}`, { credentials: 'include' }),
        fetch('/api/interno/control/resumen-diario', { credentials: 'include' }),
      ]);
      const panoramaJson = await panoramaRes.json() as PanoramaResponse;
      const resumenJson  = await resumenRes.json() as ResumenDiaResponse;
      if (!panoramaRes.ok || !panoramaJson.ok) throw new Error(panoramaJson.error ?? 'No se pudo cargar el resumen.');
      setData(panoramaJson);
      setResumen(resumenJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <Cargando label="Preparando su resumen del día…" />;
  if (error)    return <Aviso tipo="error" mensaje={error} />;
  if (!data?.panorama) return null;

  return (
    <div className="space-y-4">
      {/* Bloque "Qué debo revisar hoy" */}
      <section className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Acciones del día</p>
            <h2 className="mt-1 text-base sm:text-lg font-black" style={{ color: 'var(--tema-texto-172033)', fontFamily: 'var(--font-manrope)' }}>
              Qué debo revisar hoy
            </h2>
          </div>
          <BotonAccion Icono={RefreshCw} onClick={cargar}>Actualizar</BotonAccion>
        </div>
        <ul className="mt-3 space-y-2">
          {(resumen?.recomendaciones ?? []).map((r, i) => {
            const c = colorRecomendacion(r.severidad);
            return (
              <li key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ background: c.bg, border: `1px solid ${c.bd}` }}>
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ color: c.fg, background: 'var(--tema-fondo-ffffff)', border: `1px solid ${c.bd}` }} aria-hidden>
                  <c.Icono className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: c.fg }}>{r.titulo}</p>
                  {r.detalle && <p className="text-xs mt-0.5" style={{ color: 'var(--tema-texto-172033)' }}>{r.detalle}</p>}
                </div>
              </li>
            );
          })}
          {(!resumen?.recomendaciones || resumen.recomendaciones.length === 0) && (
            <li className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>Sin recomendaciones por mostrar en este momento.</li>
          )}
        </ul>
      </section>

      {/* Cómo usar este módulo */}
      <section className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Cómo usar este módulo</p>
        <ol className="mt-2 text-xs space-y-1 list-decimal pl-4" style={{ color: 'var(--tema-texto-172033)' }}>
          <li>Revise las alertas del día.</li>
          <li>Verifique los radicados vencidos o por vencer.</li>
          <li>Cree un hallazgo cuando encuentre una situación que requiera seguimiento.</li>
          <li>Solicite un plan de mejora a la dependencia responsable.</li>
          <li>Exporte el informe para soporte de seguimiento.</li>
        </ol>
      </section>

      {/* Filtros + leyenda semáforo */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
        <div className="flex-1 min-w-[220px]">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Período</p>
          <p className="text-sm font-medium" style={{ color: 'var(--tema-texto-172033)' }}>
            {data.panorama.periodo.desde} → {data.panorama.periodo.hasta}
          </p>
        </div>
        <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input-internal mt-1 text-xs" />
        </label>
        <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-64748b)' }}>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input-internal mt-1 text-xs" />
        </label>
        <BotonAccion variante="primaria" onClick={cargar}>Filtrar</BotonAccion>
      </div>

      {/* Resumen niveles */}
      {data.resumenRiesgo && (
        <FilaTarjetas etiqueta="Dependencias por nivel de riesgo">
          {(['CRITICO', 'ALTO', 'MEDIO', 'BAJO'] as NivelRiesgo[]).map((nivel) => (
            <TarjetaIndicador
              key={nivel}
              etiqueta={`Riesgo ${LABEL_NIVEL_RIESGO[nivel]}`}
              valor={data.resumenRiesgo?.[nivel] ?? 0}
              descripcion={describirNivelRiesgo(nivel)}
              descripcionVisible
              {...INDICADOR_NIVEL[nivel]}
            />
          ))}
        </FilaTarjetas>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.panorama.kpis.map((k) => {
          const c = colorSemaforo(k.semaforo);
          return (
            <div key={k.clave} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.bd}` }} title={k.descripcion}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-black tabular-nums" style={{ color: c.fg, fontFamily: 'var(--font-manrope)' }}>
                  {k.valor}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.fg }}>
                  {LABEL_SEMAFORO[k.semaforo]}
                </span>
              </div>
              <p className="text-xs font-bold mt-1" style={{ color: 'var(--tema-texto-172033)' }}>{k.label}</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--tema-texto-475569)' }}>{k.descripcion}</p>
              {k.accion && (
                <p className="text-[10px] mt-2 italic" style={{ color: c.fg }}>→ {k.accion}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda del semáforo */}
      <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Cómo leer los colores</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <LeyendaItem color="var(--tema-texto-007049)" titulo="Verde — Bien" texto="Cumplimiento dentro de lo esperado." />
          <LeyendaItem color="var(--tema-texto-d97706)" titulo="Amarillo — Atención" texto="Conviene revisar pronto." />
          <LeyendaItem color="var(--tema-texto-d81e1e)" titulo="Rojo — Urgente" texto="Requiere acción inmediata." />
        </div>
      </div>

      {/* Mejor / Peor dependencia */}
      {(data.panorama.peorDependencia || data.panorama.mejorDependencia) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.panorama.peorDependencia && (
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-fecaca)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-991b1b)' }}>Dependencia con más vencidos</p>
              <p className="text-lg font-black mt-1" style={{ color: 'var(--tema-texto-172033)', fontFamily: 'var(--font-manrope)' }}>{data.panorama.peorDependencia.nombre}</p>
              <p className="text-sm" style={{ color: 'var(--tema-texto-991b1b)' }}>{data.panorama.peorDependencia.vencidos} vencidos</p>
            </div>
          )}
          {data.panorama.mejorDependencia && (
            <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-bbf7d0)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Dependencia con mejor cumplimiento</p>
              <p className="text-lg font-black mt-1" style={{ color: 'var(--tema-texto-172033)', fontFamily: 'var(--font-manrope)' }}>{data.panorama.mejorDependencia.nombre}</p>
              <p className="text-sm" style={{ color: 'var(--tema-texto-007049)' }}>{data.panorama.mejorDependencia.cumplimiento}% resueltos</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeyendaItem({ color, titulo, texto }: { color: string; titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-3 h-3 rounded-sm shrink-0 mt-0.5" style={{ background: color }} />
      <div>
        <p className="font-bold" style={{ color: 'var(--tema-texto-172033)' }}>{titulo}</p>
        <p style={{ color: 'var(--tema-texto-64748b)' }}>{texto}</p>
      </div>
    </div>
  );
}

/* Sub-componentes pequeños reutilizables */

export function Cargando({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center py-12 gap-3" style={{ color: 'var(--tema-texto-64748b)' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Aviso({ tipo, mensaje }: { tipo: 'error' | 'info'; mensaje: string }) {
  const palette = tipo === 'error'
    ? { bg: 'var(--tema-fondo-fef2f2)', bd: 'var(--tema-borde-fecaca)', fg: 'var(--tema-texto-991b1b)' }
    : { bg: 'var(--tema-fondo-f4f9f6)', bd: 'var(--tema-borde-dce4ea)', fg: 'var(--tema-texto-007049)' };
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className="rounded-xl p-4 text-sm" style={{ background: palette.bg, border: `1px solid ${palette.bd}`, color: palette.fg }}>
      {mensaje}
    </div>
  );
}

/**
 * Estado vacío del módulo. Ola 3 (ADR-0046): delega en `EmptyState` del
 * sistema de diseño; conserva su API para no tocar los paneles que lo usan.
 */
export function EstadoVacio({ titulo, mensaje, accion }: { titulo: string; mensaje: string; accion?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--tema-fondo-ffffff)]">
      <EmptyState titulo={titulo} descripcion={mensaje} accion={accion} />
    </div>
  );
}
