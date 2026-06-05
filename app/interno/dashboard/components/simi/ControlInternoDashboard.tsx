'use client';

/**
 * ControlInternoDashboard — Vista de métricas MIPG para Control Interno.
 */

import { useState, useEffect } from 'react';
import type { ControlInternoDashboardData } from '@/src/types/simi-control-interno';

function KpiCard({ label, valor, color, bg, border, sub }: {
  label: string; valor: number | string; color: string;
  bg: string; border: string; sub?: string;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <p className="text-2xl font-black tabular-nums" style={{ color, fontFamily: 'var(--font-manrope)' }}>{valor}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#94A3B8' }}>{label}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
    </div>
  );
}

export function ControlInternoDashboard() {
  const [data,     setData]     = useState<ControlInternoDashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [desde,    setDesde]    = useState('');
  const [hasta,    setHasta]    = useState('');

  async function cargar() {
    setCargando(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const res = await fetch(`/api/simi/control-interno?${params}`);
      const d = await res.json() as { metricas?: ControlInternoDashboardData; error?: string };
      if (!res.ok) throw new Error(d.error ?? 'Error al cargar');
      setData(d.metricas ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar métricas');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  if (cargando) return (
    <div className="flex items-center justify-center py-16 gap-3" style={{ color: '#94A3B8' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
      Calculando métricas MIPG...
    </div>
  );

  if (error) return (
    <div className="rounded-xl p-4 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>{error}</div>
  );

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Control Interno — MIPG</p>
          <h2 className="text-lg font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
            Dashboard de Calidad PQRSD
          </h2>
          <p className="text-xs" style={{ color: '#667085' }}>
            Período: {data.periodo.desde} al {data.periodo.hasta}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="input-internal text-xs" style={{ maxWidth: '130px' }} />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="input-internal text-xs" style={{ maxWidth: '130px' }} />
          <button onClick={cargar}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: '#14532D' }}>
            Filtrar
          </button>
          <a href="/api/simi/reportes?tipo=aprobaciones"
             className="px-3 py-1.5 rounded-lg text-xs font-bold"
             style={{ border: '1px solid #D9E2D9', color: '#667085' }}>
            ↓ CSV
          </a>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total PQRSD" valor={data.totalRecibidos} color="#1F2933" bg="#F8FAF7" border="#D9E2D9" />
        <KpiCard label="Tasa oportunidad" valor={`${data.tasaOportunidadGlobal}%`} color="#14532D"
          bg={data.tasaOportunidadGlobal >= 80 ? '#F0FDF4' : '#FFFBEB'}
          border={data.tasaOportunidadGlobal >= 80 ? '#BBF7D0' : '#FDE68A'}
          sub="Respondidos a tiempo" />
        <KpiCard label="Vencidos activos" valor={data.vencidos}
          color={data.vencidos > 0 ? '#DC2626' : '#14532D'}
          bg={data.vencidos > 0 ? '#FEF2F2' : '#F0FDF4'}
          border={data.vencidos > 0 ? '#FECACA' : '#BBF7D0'} />
        <KpiCard label="Por vencer (3d)" valor={data.porVencer}
          color={data.porVencer > 0 ? '#D97706' : '#667085'}
          bg={data.porVencer > 0 ? '#FFFBEB' : '#F8FAF7'}
          border={data.porVencer > 0 ? '#FDE68A' : '#D9E2D9'} />
      </div>

      {/* Fila 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Riesgo alto" valor={data.casosRiesgoAlto}
          color={data.casosRiesgoAlto > 0 ? '#DC2626' : '#667085'}
          bg="#FEF2F2" border="#FECACA" />
        <KpiCard label="Pend. jefe" valor={data.pendientesJefe}
          color={data.pendientesJefe > 0 ? '#D97706' : '#667085'} bg="#FFFBEB" border="#FDE68A" />
        <KpiCard label="Pend. jurídica" valor={data.pendientesJuridica}
          color={data.pendientesJuridica > 0 ? '#DC2626' : '#667085'} bg="#FEF2F2" border="#FECACA" />
        <KpiCard label="Tiempo prom. resp." valor={data.promedioDiasRespuesta !== null ? `${data.promedioDiasRespuesta}d` : '—'}
          color="#1F2933" bg="#F8FAF7" border="#D9E2D9" sub="Días hábiles" />
      </div>

      {/* Borradores */}
      <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>
          Gestión de borradores
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Generados', valor: data.borradoresGenerados, color: '#1F2933' },
            { label: 'Aprobados', valor: data.aprobadosSinCambios, color: '#14532D' },
            { label: 'Devueltos', valor: data.devueltos, color: '#D97706' },
            { label: 'Escalados jurídica', valor: data.escaladosJuridica, color: '#DC2626' },
          ].map(({ label, valor, color }) => (
            <div key={label} className="text-center py-3 rounded-lg" style={{ background: '#F8FAF7' }}>
              <p className="text-xl font-black tabular-nums" style={{ color }}>{valor}</p>
              <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color: '#94A3B8' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Por dependencia */}
      {data.porDependencia.length > 0 && (
        <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
          <div className="px-4 py-3" style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
              Cumplimiento por dependencia
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#F8FAF7', borderBottom: '1px solid #EEF4EE' }}>
                  {['Dependencia', 'Total', 'Vencidos', 'Por vencer', 'Riesgo alto', 'Tasa'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: '#667085' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.porDependencia.slice(0, 10).map((dep, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #EEF4EE' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: '#1F2933' }}>{dep.nombre}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: '#667085' }}>{dep.total}</td>
                    <td className="px-3 py-2 tabular-nums font-bold"
                        style={{ color: dep.vencidos > 0 ? '#DC2626' : '#94A3B8' }}>{dep.vencidos}</td>
                    <td className="px-3 py-2 tabular-nums font-bold"
                        style={{ color: dep.porVencer > 0 ? '#D97706' : '#94A3B8' }}>{dep.porVencer}</td>
                    <td className="px-3 py-2 tabular-nums font-bold"
                        style={{ color: dep.riesgoAlto > 0 ? '#DC2626' : '#94A3B8' }}>{dep.riesgoAlto}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF4EE' }}>
                          <div className="h-full rounded-full"
                               style={{ width: `${dep.tasaOportunidad}%`, background: dep.tasaOportunidad >= 80 ? '#14532D' : dep.tasaOportunidad >= 60 ? '#D97706' : '#DC2626' }} />
                        </div>
                        <span className="tabular-nums" style={{ color: '#667085' }}>{dep.tasaOportunidad}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exportar */}
      <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest w-full" style={{ color: '#94A3B8' }}>Exportar</p>
        {[
          { tipo: 'aprobaciones', label: 'Aprobaciones' },
          { tipo: 'vencimientos', label: 'Vencimientos' },
          { tipo: 'metricas',     label: 'Métricas' },
        ].map(({ tipo, label }) => (
          <a key={tipo} href={`/api/simi/reportes?tipo=${tipo}`}
             className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
             style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}>
            ↓ {label} CSV
          </a>
        ))}
      </div>
    </div>
  );
}
