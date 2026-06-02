'use client';

import { useState, useEffect } from 'react';
import type { QualityMetrics } from '@/lib/simi-juridico/calculateQualityMetrics';

function MetricCard({ label, valor, color, sub }: {
  label: string; valor: number | string; color: string; sub?: string;
}) {
  return (
    <div className="rounded-xl p-4 bg-white" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.05)' }}>
      <p className="text-2xl font-black tabular-nums" style={{ color, fontFamily: 'var(--font-manrope)' }}>{valor}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: '#94A3B8' }}>{label}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: '#94A3B8' }}>{sub}</p>}
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
    <div className="flex items-center justify-center py-12 gap-3" style={{ color: '#94A3B8' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
      Calculando métricas...
    </div>
  );

  if (error) return (
    <div className="rounded-xl p-3 text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
      {error}
    </div>
  );

  if (!metricas) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Métricas</p>
        <h3 className="text-base font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
          Calidad del módulo jurídico
        </h3>
        <p className="text-xs" style={{ color: '#94A3B8' }}>Últimos 90 días</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Borradores generados" valor={metricas.totalBorradores} color="#1F2933" />
        <MetricCard label="Aprobados directo" valor={metricas.aprobadosSinCambios} color="#14532D"
          sub={`${metricas.tasaAprobacionDirecta}% tasa`} />
        <MetricCard label="Devueltos" valor={metricas.devueltos} color="#D97706" />
        <MetricCard label="Escalados jurídica" valor={metricas.escaladosJuridica} color="#DC2626" />
      </div>

      {/* Tiempo promedio */}
      {metricas.tiempoPromedioAprobHoras !== undefined && (
        <div className="rounded-lg p-3" style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
          <p className="text-sm font-black" style={{ color: '#14532D' }}>
            ⏱ {metricas.tiempoPromedioAprobHoras}h promedio de aprobación
          </p>
          <p className="text-[10px]" style={{ color: '#667085' }}>Desde creación del borrador hasta aprobación</p>
        </div>
      )}

      {/* Por nivel de riesgo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg p-3" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p className="text-lg font-black text-green-700">{metricas.porNivelRiesgo.bajo}</p>
          <p className="text-[9px] font-bold uppercase text-green-700">Riesgo bajo</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <p className="text-lg font-black text-amber-700">{metricas.porNivelRiesgo.medio}</p>
          <p className="text-[9px] font-bold uppercase text-amber-700">Riesgo medio</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p className="text-lg font-black text-red-700">{metricas.porNivelRiesgo.alto}</p>
          <p className="text-[9px] font-bold uppercase text-red-700">Riesgo alto</p>
        </div>
      </div>

      {/* Modos más usados */}
      {metricas.modosMasUsados.length > 0 && (
        <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>Modos más usados</p>
          {metricas.modosMasUsados.map((m, i) => (
            <div key={i} className="flex items-center justify-between py-1.5"
                 style={{ borderBottom: i < metricas.modosMasUsados.length - 1 ? '1px solid #EEF4EE' : undefined }}>
              <p className="text-xs" style={{ color: '#1F2933' }}>{m.modo.replace(/_/g, ' ')}</p>
              <span className="text-xs font-bold tabular-nums" style={{ color: '#14532D' }}>{m.veces}×</span>
            </div>
          ))}
        </div>
      )}

      {/* Fuentes más usadas */}
      {metricas.fuentesMasUsadas.length > 0 && (
        <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#14532D' }}>Fuentes normativas más consultadas</p>
          {metricas.fuentesMasUsadas.map((f, i) => (
            <div key={i} className="flex items-start justify-between gap-2 py-1.5"
                 style={{ borderBottom: i < metricas.fuentesMasUsadas.length - 1 ? '1px solid #EEF4EE' : undefined }}>
              <p className="text-xs" style={{ color: '#1F2933' }}>{f.titulo}</p>
              <span className="text-xs font-bold shrink-0" style={{ color: '#14532D' }}>{f.veces}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
