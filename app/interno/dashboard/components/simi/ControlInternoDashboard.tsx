'use client';

/**
 * ControlInternoDashboard — Vista de métricas MIPG para Control Interno.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ControlInternoDashboardData } from '@/src/types/simi-control-interno';
import { type IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';
import { AlertTriangle, CheckCircle2, Clock3, Download, FileText, Gavel, Timer, UserCheck } from 'lucide-react';

/* Ola 3 (ADR-0046): indicadores, tabla y botones del sistema de diseño.
   Mismos datos y mismas descargas. */
const CLASE_ENLACE_CSV = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-[var(--tema-fondo-f4f9f6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30';
const ESTILO_ENLACE_CSV = { background: 'var(--tema-fondo-ffffff)', color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-007049)' } as const;

export function ControlInternoDashboard() {
  const [data,     setData]     = useState<ControlInternoDashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [desde,    setDesde]    = useState('');
  const [hasta,    setHasta]    = useState('');

  const cargar = useCallback(async () => {
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
  }, [desde, hasta]);

  useEffect(() => { void cargar(); }, [cargar]);

  if (cargando) return (
    <div role="status" className="flex items-center justify-center py-16 gap-3" style={{ color: 'var(--tema-texto-64748b)' }}>
      <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
      Calculando métricas MIPG...
    </div>
  );

  if (error) return (
    <div role="alert" className="rounded-xl p-4 text-sm" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}>{error}</div>
  );

  if (!data) return null;

  const principales: IndicadorEstaticoProps[] = [
    { etiqueta: 'Total PQRSD', valor: data.totalRecibidos, tono: 'gris', Icono: FileText },
    { etiqueta: 'Tasa oportunidad', valor: `${data.tasaOportunidadGlobal}%`, tono: data.tasaOportunidadGlobal >= 80 ? 'verde' : 'ambar', Icono: CheckCircle2, descripcion: 'Respondidos a tiempo' },
    { etiqueta: 'Vencidos activos', valor: data.vencidos, tono: data.vencidos > 0 ? 'rojo' : 'verde', Icono: AlertTriangle },
    { etiqueta: 'Por vencer (3d)', valor: data.porVencer, tono: data.porVencer > 0 ? 'ambar' : 'gris', Icono: Clock3 },
    { etiqueta: 'Riesgo alto', valor: data.casosRiesgoAlto, tono: data.casosRiesgoAlto > 0 ? 'rojo' : 'gris', Icono: AlertTriangle },
    { etiqueta: 'Pend. jefe', valor: data.pendientesJefe, tono: data.pendientesJefe > 0 ? 'ambar' : 'gris', Icono: UserCheck },
    { etiqueta: 'Pend. jurídica', valor: data.pendientesJuridica, tono: data.pendientesJuridica > 0 ? 'rojo' : 'gris', Icono: Gavel },
    { etiqueta: 'Tiempo prom. resp.', valor: data.promedioDiasRespuesta !== null ? `${data.promedioDiasRespuesta}d` : '—', tono: 'gris', Icono: Timer, descripcion: 'Días hábiles' },
  ];
  const borradores: IndicadorEstaticoProps[] = [
    { etiqueta: 'Generados', valor: data.borradoresGenerados, tono: 'gris' },
    { etiqueta: 'Aprobados', valor: data.aprobadosSinCambios, tono: 'verde' },
    { etiqueta: 'Devueltos', valor: data.devueltos, tono: 'ambar' },
    { etiqueta: 'Escalados jurídica', valor: data.escaladosJuridica, tono: 'rojo' },
  ];

  return (
    <div className="space-y-3">
      {/* Header + filtros */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-007049)' }}>Control Interno — MIPG</p>
          <h2 className="text-lg font-black" style={{ color: 'var(--tema-texto-172033)', fontFamily: 'var(--font-manrope)' }}>
            Dashboard de Calidad PQRSD
          </h2>
          <p className="text-xs" style={{ color: 'var(--tema-texto-64748b)' }}>
            Período: {data.periodo.desde} al {data.periodo.hasta}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
            className="input-internal text-xs" style={{ maxWidth: '130px' }} />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
            className="input-internal text-xs" style={{ maxWidth: '130px' }} />
          <BotonAccion variante="primaria" onClick={cargar}>Filtrar</BotonAccion>
          <a href="/api/simi/reportes?tipo=aprobaciones" className={CLASE_ENLACE_CSV} style={ESTILO_ENLACE_CSV}>
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            CSV
          </a>
        </div>
      </div>

      {/* Indicadores (lenguaje del Tablero) */}
      <FilaTarjetas etiqueta="Indicadores MIPG del período">
        {principales.map((k) => <TarjetaIndicador key={k.etiqueta} {...k} descripcionVisible />)}
      </FilaTarjetas>

      {/* Borradores */}
      <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-3">
        <p className="text-xs font-black mb-2" style={{ color: 'var(--tema-texto-172033)' }}>
          Gestión de borradores
        </p>
        <FilaTarjetas etiqueta="Gestión de borradores">
          {borradores.map((k) => <TarjetaIndicador key={k.etiqueta} {...k} />)}
        </FilaTarjetas>
      </div>

      {/* Por dependencia */}
      {data.porDependencia.length > 0 && (
        <div className="rounded-xl bg-[var(--tema-fondo-ffffff)] overflow-hidden">
          <p className="px-3 pt-3 pb-2 text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
            Cumplimiento por dependencia
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <CabeceraTablaSticky columnas={['Dependencia', 'Total', 'Vencidos', 'Por vencer', 'Riesgo alto', 'Tasa']} />
              <tbody>
                {data.porDependencia.slice(0, 10).map((dep, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                    <td className="px-2 py-2 font-medium" style={{ color: 'var(--tema-texto-172033)' }}>{dep.nombre}</td>
                    <td className="px-2 py-2 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{dep.total}</td>
                    <td className="px-2 py-2 tabular-nums font-bold"
                        style={{ color: dep.vencidos > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-64748b)' }}>{dep.vencidos}</td>
                    <td className="px-2 py-2 tabular-nums font-bold"
                        style={{ color: dep.porVencer > 0 ? 'var(--tema-texto-b45309)' : 'var(--tema-texto-64748b)' }}>{dep.porVencer}</td>
                    <td className="px-2 py-2 tabular-nums font-bold"
                        style={{ color: dep.riesgoAlto > 0 ? 'var(--tema-texto-d81e1e)' : 'var(--tema-texto-64748b)' }}>{dep.riesgoAlto}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
                          <div className="h-full rounded-full"
                               style={{ width: `${dep.tasaOportunidad}%`, background: dep.tasaOportunidad >= 80 ? 'var(--tema-fondo-007049)' : dep.tasaOportunidad >= 60 ? 'var(--tema-texto-d97706)' : 'var(--tema-texto-d81e1e)' }} />
                        </div>
                        <span className="tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{dep.tasaOportunidad}%</span>
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
      <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid var(--tema-borde-dce4ea)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest w-full" style={{ color: 'var(--tema-texto-64748b)' }}>Exportar</p>
        {[
          { tipo: 'aprobaciones', label: 'Aprobaciones' },
          { tipo: 'vencimientos', label: 'Vencimientos' },
          { tipo: 'metricas',     label: 'Métricas' },
        ].map(({ tipo, label }) => (
          <a key={tipo} href={`/api/simi/reportes?tipo=${tipo}`} className={CLASE_ENLACE_CSV} style={ESTILO_ENLACE_CSV}>
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {label} CSV
          </a>
        ))}
      </div>
    </div>
  );
}
