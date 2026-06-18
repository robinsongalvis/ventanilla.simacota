'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DesempenoDependencia,
  NivelRiesgo,
} from '@/src/types/control-interno';
import { LABEL_NIVEL_RIESGO } from '@/src/types/control-interno';
import { Aviso, Cargando } from './PanoramaGeneralPanel';

function colorNivelBadge(n: NivelRiesgo): { bg: string; bd: string; fg: string } {
  if (n === 'CRITICO') return { bg: '#FEF2F2', bd: '#FECACA', fg: '#991B1B' };
  if (n === 'ALTO')    return { bg: '#FFF7ED', bd: '#FED7AA', fg: '#9A3412' };
  if (n === 'MEDIO')   return { bg: '#FFFBEB', bd: '#FDE68A', fg: '#92400E' };
  return                       { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#14532D' };
}

function semaforoBarColor(pct: number): string {
  if (pct >= 90) return '#14532D';
  if (pct >= 75) return '#D97706';
  return '#DC2626';
}

export function PanelDependenciasControl() {
  const [data, setData] = useState<DesempenoDependencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const r = await fetch('/api/interno/control/panorama', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; error?: string; dependencias?: DesempenoDependencia[] };
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Error al cargar dependencias.');
      setData(j.dependencias ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return <Cargando label="Calculando desempeño por dependencia…" />;
  if (error)    return <Aviso tipo="error" mensaje={error} />;
  if (data.length === 0) return <Aviso tipo="info" mensaje="Sin datos de dependencias en el período." />;

  return (
    <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead style={{ background: '#F8FAF7' }}>
            <tr>
              {['Dependencia', 'Total', 'Resueltos', 'Vencidos', 'Por vencer', 'Cumpl. %', 'Días prom.', 'Sin resp.', 'Hallazgos', 'Planes', 'Notif. fallidas', 'Riesgo'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => {
              const c = colorNivelBadge(d.nivelRiesgo);
              return (
                <tr key={d.tenantId} style={{ borderTop: '1px solid #EEF4EE' }}>
                  <td className="px-3 py-2 font-medium" style={{ color: '#1F2933' }}>{d.nombre}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: '#667085' }}>{d.total}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: '#14532D' }}>{d.resueltos}</td>
                  <td className="px-3 py-2 tabular-nums font-bold" style={{ color: d.vencidos > 0 ? '#DC2626' : '#94A3B8' }}>{d.vencidos}</td>
                  <td className="px-3 py-2 tabular-nums font-bold" style={{ color: d.porVencer > 0 ? '#D97706' : '#94A3B8' }}>{d.porVencer}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF4EE' }}>
                        <div className="h-full" style={{ width: `${d.cumplimientoPct}%`, background: semaforoBarColor(d.cumplimientoPct) }} />
                      </div>
                      <span className="tabular-nums" style={{ color: '#667085' }}>{d.cumplimientoPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: '#667085' }}>{d.promedioDiasRespuesta ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: d.sinResponsable > 0 ? '#B45309' : '#94A3B8' }}>{d.sinResponsable}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: d.hallazgosAbiertos > 0 ? '#991B1B' : '#94A3B8' }}>{d.hallazgosAbiertos}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: d.planesMejoraAbiertos > 0 ? '#9A3412' : '#94A3B8' }}>{d.planesMejoraAbiertos}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: d.notificacionesFallidas > 0 ? '#991B1B' : '#94A3B8' }}>{d.notificacionesFallidas}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase" style={{
                      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
                    }}>
                      {LABEL_NIVEL_RIESGO[d.nivelRiesgo]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
