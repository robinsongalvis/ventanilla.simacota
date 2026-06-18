'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DesempenoDependencia,
  NivelRiesgo,
  PanoramaControlInterno,
  SemaforoKpi,
} from '@/src/types/control-interno';
import { LABEL_NIVEL_RIESGO } from '@/src/types/control-interno';

interface PanoramaResponse {
  ok?:           boolean;
  error?:        string;
  panorama?:     PanoramaControlInterno;
  dependencias?: DesempenoDependencia[];
  resumenRiesgo?: Record<NivelRiesgo, number>;
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

export function PanoramaGeneralPanel() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data,  setData]  = useState<PanoramaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (desde) p.set('desde', desde);
      if (hasta) p.set('hasta', hasta);
      const r = await fetch(`/api/interno/control/panorama?${p.toString()}`, { credentials: 'include' });
      const j = await r.json() as PanoramaResponse;
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Error al cargar panorama.');
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <Cargando label="Calculando panorama Control Interno…" />;
  if (error)    return <Aviso tipo="error" mensaje={error} />;
  if (!data?.panorama) return null;

  return (
    <div className="space-y-4">
      {/* Filtros + resumen riesgo */}
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
            <div key={nivel} className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
              <p className="text-2xl font-black tabular-nums" style={{ color: colorNivel(nivel), fontFamily: 'var(--font-manrope)' }}>
                {data.resumenRiesgo?.[nivel] ?? 0}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#94A3B8' }}>
                Riesgo {LABEL_NIVEL_RIESGO[nivel]}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.panorama.kpis.map((k) => {
          const c = colorSemaforo(k.semaforo);
          return (
            <div key={k.clave} className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.bd}` }}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-2xl font-black tabular-nums" style={{ color: c.fg, fontFamily: 'var(--font-manrope)' }}>
                  {k.valor}
                </p>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.fg }}>
                  {k.semaforo}
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
