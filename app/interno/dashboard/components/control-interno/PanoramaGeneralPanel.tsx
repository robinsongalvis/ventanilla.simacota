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
  if (s === 'VERDE')    return { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#14532D' };
  if (s === 'AMARILLO') return { bg: '#FFFBEB', bd: '#FDE68A', fg: '#92400E' };
  return                       { bg: '#FEF2F2', bd: '#FECACA', fg: '#991B1B' };
}

function colorNivel(n: NivelRiesgo): string {
  if (n === 'CRITICO') return '#DC2626';
  if (n === 'ALTO')    return '#D97706';
  if (n === 'MEDIO')   return '#CA8A04';
  return                       '#14532D';
}

function colorRecomendacion(s: SeveridadRecomendacion): { bg: string; bd: string; fg: string; icon: string } {
  if (s === 'URGENTE')     return { bg: '#FEF2F2', bd: '#FECACA', fg: '#991B1B', icon: '⚠️' };
  if (s === 'ATENCION')    return { bg: '#FFFBEB', bd: '#FDE68A', fg: '#92400E', icon: '!' };
  if (s === 'INFORMATIVO') return { bg: '#F0F9FF', bd: '#BAE6FD', fg: '#075985', icon: 'i' };
  return                          { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#14532D', icon: '✓' };
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
      <section className="rounded-2xl bg-white p-5" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Acciones del día</p>
            <h2 className="mt-1 text-base sm:text-lg font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
              Qué debo revisar hoy
            </h2>
          </div>
          <button type="button" onClick={cargar} className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md" style={{ color: '#14532D', border: '1px solid #D9E2D9' }}>
            Actualizar
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {(resumen?.recomendaciones ?? []).map((r, i) => {
            const c = colorRecomendacion(r.severidad);
            return (
              <li key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ background: c.bg, border: `1px solid ${c.bd}` }}>
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ color: c.fg, background: 'white', border: `1px solid ${c.bd}` }} aria-hidden>
                  {c.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold" style={{ color: c.fg }}>{r.titulo}</p>
                  {r.detalle && <p className="text-xs mt-0.5" style={{ color: '#1F2933' }}>{r.detalle}</p>}
                </div>
              </li>
            );
          })}
          {(!resumen?.recomendaciones || resumen.recomendaciones.length === 0) && (
            <li className="text-xs" style={{ color: '#667085' }}>Sin recomendaciones por mostrar en este momento.</li>
          )}
        </ul>
      </section>

      {/* Cómo usar este módulo */}
      <section className="rounded-2xl bg-white p-5" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Cómo usar este módulo</p>
        <ol className="mt-2 text-xs space-y-1 list-decimal pl-4" style={{ color: '#1F2933' }}>
          <li>Revise las alertas del día.</li>
          <li>Verifique los radicados vencidos o por vencer.</li>
          <li>Cree un hallazgo cuando encuentre una situación que requiera seguimiento.</li>
          <li>Solicite un plan de mejora a la dependencia responsable.</li>
          <li>Exporte el informe para soporte de seguimiento.</li>
        </ol>
      </section>

      {/* Filtros + leyenda semáforo */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <div className="flex-1 min-w-[220px]">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Período</p>
          <p className="text-sm font-medium" style={{ color: '#1F2933' }}>
            {data.panorama.periodo.desde} → {data.panorama.periodo.hasta}
          </p>
        </div>
        <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input-internal mt-1 text-xs" />
        </label>
        <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input-internal mt-1 text-xs" />
        </label>
        <button onClick={cargar} className="px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: '#14532D' }}>
          Filtrar
        </button>
      </div>

      {/* Resumen niveles */}
      {data.resumenRiesgo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['CRITICO', 'ALTO', 'MEDIO', 'BAJO'] as NivelRiesgo[]).map((nivel) => (
            <div key={nivel} className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }} title={describirNivelRiesgo(nivel)}>
              <p className="text-2xl font-black tabular-nums" style={{ color: colorNivel(nivel), fontFamily: 'var(--font-manrope)' }}>
                {data.resumenRiesgo?.[nivel] ?? 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#94A3B8' }}>
                Riesgo {LABEL_NIVEL_RIESGO[nivel]}
              </p>
              <p className="text-[10px] mt-1" style={{ color: '#667085' }}>{describirNivelRiesgo(nivel)}</p>
            </div>
          ))}
        </div>
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
              <p className="text-xs font-bold mt-1" style={{ color: '#1F2933' }}>{k.label}</p>
              <p className="text-[10px] mt-1" style={{ color: '#667085' }}>{k.descripcion}</p>
              {k.accion && (
                <p className="text-[10px] mt-2 italic" style={{ color: c.fg }}>→ {k.accion}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda del semáforo */}
      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Cómo leer los colores</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <LeyendaItem color="#14532D" titulo="Verde — Bien" texto="Cumplimiento dentro de lo esperado." />
          <LeyendaItem color="#D97706" titulo="Amarillo — Atención" texto="Conviene revisar pronto." />
          <LeyendaItem color="#DC2626" titulo="Rojo — Urgente" texto="Requiere acción inmediata." />
        </div>
      </div>

      {/* Mejor / Peor dependencia */}
      {(data.panorama.peorDependencia || data.panorama.mejorDependencia) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.panorama.peorDependencia && (
            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #FECACA' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#991B1B' }}>Dependencia con más vencidos</p>
              <p className="text-lg font-black mt-1" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>{data.panorama.peorDependencia.nombre}</p>
              <p className="text-sm" style={{ color: '#991B1B' }}>{data.panorama.peorDependencia.vencidos} vencidos</p>
            </div>
          )}
          {data.panorama.mejorDependencia && (
            <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #BBF7D0' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Dependencia con mejor cumplimiento</p>
              <p className="text-lg font-black mt-1" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>{data.panorama.mejorDependencia.nombre}</p>
              <p className="text-sm" style={{ color: '#14532D' }}>{data.panorama.mejorDependencia.cumplimiento}% resueltos</p>
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
        <p className="font-bold" style={{ color: '#1F2933' }}>{titulo}</p>
        <p style={{ color: '#667085' }}>{texto}</p>
      </div>
    </div>
  );
}

/* Sub-componentes pequeños reutilizables */

export function Cargando({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 gap-3" style={{ color: '#94A3B8' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Aviso({ tipo, mensaje }: { tipo: 'error' | 'info'; mensaje: string }) {
  const palette = tipo === 'error'
    ? { bg: '#FEF2F2', bd: '#FECACA', fg: '#991B1B' }
    : { bg: '#EEF4EE', bd: '#D9E2D9', fg: '#14532D' };
  return (
    <div className="rounded-xl p-4 text-sm" style={{ background: palette.bg, border: `1px solid ${palette.bd}`, color: palette.fg }}>
      {mensaje}
    </div>
  );
}

/** Estado vacío profesional reusable. */
export function EstadoVacio({ titulo, mensaje, accion }: { titulo: string; mensaje: string; accion?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-6 text-center" style={{ border: '1px dashed #D9E2D9' }}>
      <p className="text-sm font-bold" style={{ color: '#14532D' }}>{titulo}</p>
      <p className="text-xs mt-2" style={{ color: '#667085' }}>{mensaje}</p>
      {accion && <div className="mt-3 inline-flex">{accion}</div>}
    </div>
  );
}
