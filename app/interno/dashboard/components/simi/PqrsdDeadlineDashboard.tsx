'use client';

import { useMemo } from 'react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { calculatePqrsdDashboard } from '@/lib/simi-juridico/calculatePqrsdDashboard';

interface PqrsdDeadlineDashboardProps {
  radicados:    VentanillaRadicado[];
  filtroTenant?: TenantId | 'TODOS';
  compact?:     boolean;
}

function KpiCard({
  label, valor, color, bg, border,
}: { label: string; valor: number | string; color: string; bg: string; border: string }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: bg, border: `1px solid ${border}` }}>
      <p className="text-2xl font-black tabular-nums" style={{ color, fontFamily: 'var(--font-manrope)' }}>
        {valor}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
        {label}
      </p>
    </div>
  );
}

export function PqrsdDeadlineDashboard({
  radicados,
  filtroTenant,
  compact = false,
}: PqrsdDeadlineDashboardProps) {
  const data = useMemo(
    () => calculatePqrsdDashboard(radicados, filtroTenant),
    [radicados, filtroTenant],
  );

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
        <KpiCard
          label="Total radicados"
          valor={data.totalRadicados}
          color="#1F2933"
          bg="#F8FAF7"
          border="#D9E2D9"
        />
        <KpiCard
          label="Próximos a vencer"
          valor={data.proximosAVencer}
          color={data.proximosAVencer > 0 ? '#D97706' : '#14532D'}
          bg={data.proximosAVencer > 0 ? '#FFFBEB' : '#F0FDF4'}
          border={data.proximosAVencer > 0 ? '#FDE68A' : '#BBF7D0'}
        />
        <KpiCard
          label="Vencidos"
          valor={data.vencidos}
          color={data.vencidos > 0 ? '#DC2626' : '#14532D'}
          bg={data.vencidos > 0 ? '#FEF2F2' : '#F0FDF4'}
          border={data.vencidos > 0 ? '#FECACA' : '#BBF7D0'}
        />
        {!compact && (
          <KpiCard
            label="Riesgo alto"
            valor={data.riesgoAlto}
            color={data.riesgoAlto > 0 ? '#DC2626' : '#14532D'}
            bg={data.riesgoAlto > 0 ? '#FEF2F2' : '#F0FDF4'}
            border={data.riesgoAlto > 0 ? '#FECACA' : '#BBF7D0'}
          />
        )}
        <KpiCard
          label="Pendientes jurídica"
          valor={data.pendientesJuridica}
          color={data.pendientesJuridica > 0 ? '#D97706' : '#667085'}
          bg="#FFFBEB"
          border="#FDE68A"
        />
        <KpiCard
          label="Sin responsable"
          valor={data.pendientesJefe}
          color={data.pendientesJefe > 0 ? '#D97706' : '#667085'}
          bg="#FFFBEB"
          border="#FDE68A"
        />
        <KpiCard
          label="Sin analizar SIMI"
          valor={data.sinAnalizarSimi}
          color={data.sinAnalizarSimi > 0 ? '#667085' : '#14532D'}
          bg="#F8FAF7"
          border="#D9E2D9"
        />
      </div>

      {/* Tabla por dependencia (solo si no es compact) */}
      {!compact && data.porDependencia.length > 0 && (
        <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
          <div className="px-4 py-2.5" style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
              Vencimientos por dependencia
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: '#F8FAF7', borderBottom: '1px solid #EEF4EE' }}>
                  {['Dependencia', 'Total activos', 'Vencidos', 'Próx. vencer', 'Riesgo alto'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: '#667085' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.porDependencia.map((dep, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #EEF4EE' }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: '#1F2933' }}>{dep.dependencia}</td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: '#667085' }}>{dep.total}</td>
                    <td className="px-3 py-2.5 tabular-nums font-bold"
                        style={{ color: dep.vencidos > 0 ? '#DC2626' : '#94A3B8' }}>
                      {dep.vencidos}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold"
                        style={{ color: dep.proximosVencer > 0 ? '#D97706' : '#94A3B8' }}>
                      {dep.proximosVencer}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold"
                        style={{ color: dep.riesgoAlto > 0 ? '#DC2626' : '#94A3B8' }}>
                      {dep.riesgoAlto}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
