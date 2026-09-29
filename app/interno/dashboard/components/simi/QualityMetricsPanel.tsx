'use client';

import { useState, useEffect } from 'react';
import type { QualityMetrics } from '@/lib/simi-juridico/calculateQualityMetrics';

function MetricCard({ label, valor, color, sub }: {
  label: string; valor: number | string; color: string; sub?: string;
}) {
  return (
    <div className="rounded-xl p-4 bg-[var(--tema-fondo-ffffff)]" style={{ border: '1px solid var(--tema-borde-dce4ea)', boxShadow: '0 1px 3px rgba(0, 112, 73,0.05)' }}>
      <p className="text-2xl font-black tabular-nums" style={{ color, fontFamily: 'var(--font-manrope)' }}>{valor}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--tema-texto-94a3b8)' }}>{label}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--tema-texto-94a3b8)' }}>{sub}</p>}
    </div>
  );
}

export function QualityMetricsPanel() {
  const [metricas, setMetricas] = useState<QualityMetrics | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/simi/metricas')
      .then((r) => r.json())
      .then((d: { metricas?: QualityMetrics; error?: string }) => {
        if (d.metricas) setMetricas(d.metricas);
        else setError(d.error ?? 'Error al cargar métricas');
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return (
    <div className="flex items-center justify-center py-12 gap-3" style={{ color: 'var(--tema-texto-94a3b8)' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
      Calculando métricas...
    </div>
  );

  if (error) return (
    <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-d81e1e)' }}>
      {error}
    </div>
  );

  if (!metricas) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Métricas</p>
        <h3 className="text-base font-black" style={{ color: 'var(--tema-texto-172033)', fontFamily: 'var(--font-manrope)' }}>
          Calidad del módulo jurídico
        </h3>
        <p className="text-xs" style={{ color: 'var(--tema-texto-94a3b8)' }}>Últimos 90 días</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Borradores generados" valor={metricas.totalBorradores} color="var(--tema-texto-172033)" />
        <MetricCard label="Aprobados directo" valor={metricas.aprobadosSinCambios} color="var(--tema-texto-007049)"
          sub={`${metricas.tasaAprobacionDirecta}% tasa`} />
        <MetricCard label="Devueltos" valor={metricas.devueltos} color="var(--tema-texto-d97706)" />
        <MetricCard label="Escalados jurídica" valor={metricas.escaladosJuridica} color="var(--tema-texto-d81e1e)" />
      </div>

      {/* Tiempo promedio */}
      {metricas.tiempoPromedioAprobHoras !== undefined && (
        <div className="rounded-lg p-3" style={{ background: 'var(--tema-fondo-f4f9f6)', border: '1px solid var(--tema-borde-dce4ea)' }}>
          <p className="text-sm font-black" style={{ color: 'var(--tema-texto-007049)' }}>
            ⏱ {metricas.tiempoPromedioAprobHoras}h promedio de aprobación
          </p>
          <p className="text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>Desde creación del borrador hasta aprobación</p>
        </div>
      )}

      {/* Por nivel de riesgo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)' }}>
          <p className="text-lg font-black text-green-700 oscuro:text-green-300">{metricas.porNivelRiesgo.bajo}</p>
          <p className="text-[9px] font-bold uppercase text-green-700 oscuro:text-green-300">Riesgo bajo</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--tema-fondo-fffbeb)', border: '1px solid var(--tema-borde-fde68a)' }}>
          <p className="text-lg font-black text-amber-700 oscuro:text-amber-300">{metricas.porNivelRiesgo.medio}</p>
          <p className="text-[9px] font-bold uppercase text-amber-700 oscuro:text-amber-300">Riesgo medio</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)' }}>
          <p className="text-lg font-black text-red-700 oscuro:text-red-300">{metricas.porNivelRiesgo.alto}</p>
          <p className="text-[9px] font-bold uppercase text-red-700 oscuro:text-red-300">Riesgo alto</p>
        </div>
      </div>

      {/* Modos más usados */}
      {metricas.modosMasUsados.length > 0 && (
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>Modos más usados</p>
          {metricas.modosMasUsados.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-1.5"
                 style={{ borderBottom: i < metricas.modosMasUsados.length - 1 ? '1px solid var(--tema-borde-f4f9f6)' : undefined }}>
              <p className="text-xs" style={{ color: 'var(--tema-texto-172033)' }}>{m.modo.replace(/_/g, ' ')}</p>
              <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--tema-texto-007049)' }}>{m.veces}×</span>
            </div>
          ))}
        </div>
      )}

      {/* Fuentes más usadas */}
      {metricas.fuentesMasUsadas.length > 0 && (
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-4" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--tema-texto-007049)' }}>Fuentes normativas más consultadas</p>
          {metricas.fuentesMasUsadas.map((f, i) => (
            <div key={i} className="flex items-start justify-between gap-2 py-1.5"
                 style={{ borderBottom: i < metricas.fuentesMasUsadas.length - 1 ? '1px solid var(--tema-borde-f4f9f6)' : undefined }}>
              <p className="text-xs" style={{ color: 'var(--tema-texto-172033)' }}>{f.titulo}</p>
              <span className="text-xs font-bold shrink-0" style={{ color: 'var(--tema-texto-007049)' }}>{f.veces}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
