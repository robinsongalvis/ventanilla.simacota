'use client';

import { useMemo } from 'react';
import { AlertTriangle, Bot, Clock3, FileText, Scale, UsersRound, type LucideIcon } from 'lucide-react';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId } from '@/src/types/radicado';
import { calculatePqrsdDashboard } from '@/lib/simi-juridico/calculatePqrsdDashboard';

interface PqrsdDeadlineDashboardProps {
  radicados:    VentanillaRadicado[];
  filtroTenant?: TenantId | 'TODOS';
  compact?:     boolean;
}

function KpiCard({
  label, valor, color, bg, border, compact = false, Icono,
}: { label: string; valor: number | string; color: string; bg: string; border: string; compact?: boolean; Icono?: LucideIcon }) {
  /* En modo compacto (tablero) la tarjeta es una sola línea sin borde: el
     fondo tintado identifica el estado y cede altura a la tabla. */
  if (compact) {
    return (
      <div className="min-w-0 flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: bg, color }}>
        {Icono && <Icono className="shrink-0" size={16} strokeWidth={1.9} aria-hidden="true" />}
        {/* Número en el color del estado a 20 px negrita (texto grande AA ≥3:1);
            la etiqueta pequeña va en gris secundario (AA ≥4,5:1, ADR-0030). */}
        <span className="text-xl font-black leading-none tabular-nums" style={{ fontFamily: 'var(--font-manrope)' }}>{valor}</span>
        <span className="min-w-0 break-words text-[11px] font-bold leading-tight" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
    );
  }
  return (
    <div className="min-w-0 rounded-xl flex flex-col p-3 gap-1" style={{ background: bg, border: `1px solid ${border}` }}>
      <p className="text-2xl font-black tabular-nums" style={{ color, fontFamily: 'var(--font-manrope)' }}>
        {valor}
      </p>
      <p className="break-words text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
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
      <div className={`grid min-w-0 ${compact ? 'gap-1.5 grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' : 'gap-3 grid-cols-1 min-[440px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
        <KpiCard
          compact={compact}
          label="Total radicados"
          Icono={FileText}
          valor={data.totalRadicados}
          color="var(--tema-texto-172033)"
          bg="var(--tema-fondo-f7f9fb)"
          border="var(--tema-borde-dce4ea)"
        />
        <KpiCard
          compact={compact}
          label="Próximos a vencer"
          Icono={Clock3}
          valor={data.proximosAVencer}
          color={data.proximosAVencer > 0 ? 'var(--tema-texto-d97706)' : 'var(--tema-texto-007049)'}
          bg={data.proximosAVencer > 0 ? 'var(--tema-fondo-fffbeb)' : 'var(--tema-fondo-f0fdf4)'}
          border={data.proximosAVencer > 0 ? 'var(--tema-borde-fde68a)' : 'var(--tema-borde-bbf7d0)'}
        />
        <KpiCard
          compact={compact}
          label="Vencidos"
          Icono={AlertTriangle}
          valor={data.vencidos}
          color={data.vencidos > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-007049)'}
          bg={data.vencidos > 0 ? 'var(--tema-fondo-fef2f2)' : 'var(--tema-fondo-f0fdf4)'}
          border={data.vencidos > 0 ? 'var(--tema-borde-fecaca)' : 'var(--tema-borde-bbf7d0)'}
        />
        {!compact && (
          <KpiCard
            label="Riesgo alto"
            valor={data.riesgoAlto}
            color={data.riesgoAlto > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-007049)'}
            bg={data.riesgoAlto > 0 ? 'var(--tema-fondo-fef2f2)' : 'var(--tema-fondo-f0fdf4)'}
            border={data.riesgoAlto > 0 ? 'var(--tema-borde-fecaca)' : 'var(--tema-borde-bbf7d0)'}
          />
        )}
        <KpiCard
          compact={compact}
          label="Pendientes jurídica"
          Icono={Scale}
          valor={data.pendientesJuridica}
          color={data.pendientesJuridica > 0 ? 'var(--tema-texto-d97706)' : 'var(--text-secondary)'}
          bg="var(--tema-fondo-fffbeb)"
          border="var(--tema-borde-fde68a)"
        />
        <KpiCard
          compact={compact}
          label="Sin responsable"
          Icono={UsersRound}
          valor={data.pendientesJefe}
          color={data.pendientesJefe > 0 ? 'var(--tema-texto-7c3aed)' : 'var(--text-secondary)'}
          bg="var(--tema-fondo-f5f3ff)"
          border="var(--tema-borde-ddd6fe)"
        />
        <KpiCard
          compact={compact}
          label="Sin analizar SIMI"
          Icono={Bot}
          valor={data.sinAnalizarSimi}
          color={data.sinAnalizarSimi > 0 ? 'var(--tema-texto-2563eb)' : 'var(--tema-texto-007049)'}
          bg="var(--tema-fondo-eff6ff)"
          border="var(--tema-borde-bfdbfe)"
        />
      </div>

      {/* Tabla por dependencia (solo si no es compact) */}
      {!compact && data.porDependencia.length > 0 && (
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden" style={{ border: '1px solid var(--tema-borde-dce4ea)' }}>
          <div className="px-4 py-2.5" style={{ background: 'var(--tema-fondo-f4f9f6)', borderBottom: '1px solid var(--tema-borde-dce4ea)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>
              Vencimientos por dependencia
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--tema-fondo-f7f9fb)', borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                  {['Dependencia', 'Total activos', 'Vencidos', 'Próx. vencer', 'Riesgo alto'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: 'var(--text-secondary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.porDependencia.map((dep, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--tema-texto-172033)' }}>{dep.dependencia}</td>
                    <td className="px-3 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{dep.total}</td>
                    <td className="px-3 py-2.5 tabular-nums font-bold"
                        style={{ color: dep.vencidos > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--text-secondary)' }}>
                      {dep.vencidos}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold"
                        style={{ color: dep.proximosVencer > 0 ? 'var(--tema-texto-d97706)' : 'var(--text-secondary)' }}>
                      {dep.proximosVencer}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-bold"
                        style={{ color: dep.riesgoAlto > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--text-secondary)' }}>
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
