'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DesempenoDependencia,
  NivelRiesgo,
} from '@/src/types/control-interno';
import { LABEL_NIVEL_RIESGO } from '@/src/types/control-interno';
import { Aviso, Cargando, EstadoVacio } from './PanoramaGeneralPanel';
import { describirNivelRiesgo } from '@/lib/control-interno/recomendaciones';
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';

function colorNivelBadge(n: NivelRiesgo): { bg: string; bd: string; fg: string } {
  if (n === 'CRITICO') return { bg: 'var(--tema-fondo-fef2f2)', bd: 'var(--tema-borde-fecaca)', fg: 'var(--tema-texto-991b1b)' };
  if (n === 'ALTO')    return { bg: 'var(--tema-fondo-fff7ed)', bd: 'var(--tema-borde-fed7aa)', fg: 'var(--tema-texto-9a3412)' };
  if (n === 'MEDIO')   return { bg: 'var(--tema-fondo-fffbeb)', bd: 'var(--tema-borde-fde68a)', fg: 'var(--tema-texto-92400e)' };
  return                       { bg: 'var(--tema-fondo-f0fdf4)', bd: 'var(--tema-borde-bbf7d0)', fg: 'var(--tema-texto-007049)' };
}

function semaforoBarColor(pct: number): string {
  if (pct >= 90) return '#007049';
  if (pct >= 75) return '#D97706';
  return '#D81E1E';
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

  if (cargando) return <Cargando label="Revisando el cumplimiento de cada dependencia…" />;
  if (error)    return <Aviso tipo="error" mensaje={error} />;
  if (data.length === 0) return (
    <EstadoVacio
      titulo="Aún no hay información de dependencias para el período."
      mensaje="Cuando existan radicados gestionados, aparecerá aquí el resumen por dependencia."
    />
  );

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>
        Las dependencias en rojo o naranja requieren seguimiento. Las verdes muestran buen cumplimiento.
      </p>
    <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <CabeceraTablaSticky columnas={['Dependencia', 'Total', 'Resueltos', 'Vencidos', 'Por vencer', 'Cumpl. %', 'Días prom.', 'Sin resp.', 'Hallazgos', 'Planes', 'Notif. fallidas', 'Riesgo']} />
          <tbody>
            {data.map((d) => {
              const c = colorNivelBadge(d.nivelRiesgo);
              return (
                <tr key={d.tenantId} style={{ borderTop: '1px solid var(--tema-borde-f4f9f6)' }}>
                  <td className="px-2 py-2 min-w-[220px]" style={{ color: 'var(--tema-texto-172033)' }}>
                    <p className="font-medium">{d.nombre}</p>
                    <p className="mt-0.5 text-[10px]" style={{ color: d.nivelRiesgo === 'ALTO' || d.nivelRiesgo === 'CRITICO' ? 'var(--tema-texto-991b1b)' : 'var(--tema-texto-64748b)' }}>
                      {d.nivelRiesgo === 'ALTO' || d.nivelRiesgo === 'CRITICO'
                        ? 'Esta dependencia requiere seguimiento.'
                        : 'Esta dependencia presenta buen cumplimiento.'}
                    </p>
                  </td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{d.total}</td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: 'var(--tema-texto-007049)' }}>{d.resueltos}</td>
                  <td className="px-2 py-2 tabular-nums font-bold" style={{ color: d.vencidos > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-64748b)' }}>{d.vencidos}</td>
                  <td className="px-2 py-2 tabular-nums font-bold" style={{ color: d.porVencer > 0 ? 'var(--tema-texto-b45309)' : 'var(--tema-texto-64748b)' }}>{d.porVencer}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
                        <div className="h-full" style={{ width: `${d.cumplimientoPct}%`, background: semaforoBarColor(d.cumplimientoPct) }} />
                      </div>
                      <span className="tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{d.cumplimientoPct}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{d.promedioDiasRespuesta ?? '—'}</td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: d.sinResponsable > 0 ? 'var(--tema-texto-b45309)' : 'var(--tema-texto-64748b)' }}>{d.sinResponsable}</td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: d.hallazgosAbiertos > 0 ? 'var(--tema-texto-991b1b)' : 'var(--tema-texto-64748b)' }}>{d.hallazgosAbiertos}</td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: d.planesMejoraAbiertos > 0 ? 'var(--tema-texto-9a3412)' : 'var(--tema-texto-64748b)' }}>{d.planesMejoraAbiertos}</td>
                  <td className="px-2 py-2 tabular-nums" style={{ color: d.notificacionesFallidas > 0 ? 'var(--tema-texto-991b1b)' : 'var(--tema-texto-64748b)' }}>{d.notificacionesFallidas}</td>
                  <td className="px-2 py-2">
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}
                      title={describirNivelRiesgo(d.nivelRiesgo)}
                    >
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
    </div>
  );
}
