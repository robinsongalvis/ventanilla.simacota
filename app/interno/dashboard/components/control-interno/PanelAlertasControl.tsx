'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AlertaControlInterno,
  NivelRiesgo,
} from '@/src/types/control-interno';
import { LABEL_NIVEL_RIESGO, LABEL_TIPO_ALERTA } from '@/src/types/control-interno';
import { NOMBRES_TENANT, DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';
import type { TenantId } from '@/src/types/radicado';
import { Aviso, Cargando } from './PanoramaGeneralPanel';

const NIVELES: NivelRiesgo[] = ['CRITICO', 'ALTO', 'MEDIO', 'BAJO'];

interface AlertasResponse {
  ok?:       boolean;
  error?:    string;
  total?:    number;
  resumen?:  Record<NivelRiesgo, number>;
  alertas?:  AlertaControlInterno[];
}

function colorBadgeNivel(n: NivelRiesgo): { bg: string; bd: string; fg: string } {
  if (n === 'CRITICO') return { bg: '#FEF2F2', bd: '#FECACA', fg: '#991B1B' };
  if (n === 'ALTO')    return { bg: '#FFF7ED', bd: '#FED7AA', fg: '#9A3412' };
  if (n === 'MEDIO')   return { bg: '#FFFBEB', bd: '#FDE68A', fg: '#92400E' };
  return                       { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#14532D' };
}

export function PanelAlertasControl() {
  const [data, setData] = useState<AlertasResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantFiltro, setTenantFiltro] = useState<TenantId | 'TODOS'>('TODOS');
  const [nivelFiltro, setNivelFiltro] = useState<NivelRiesgo | 'TODOS'>('TODOS');

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const p = new URLSearchParams();
      if (tenantFiltro !== 'TODOS') p.set('tenantId', tenantFiltro);
      if (nivelFiltro !== 'TODOS')  p.set('nivel', nivelFiltro);
      const r = await fetch(`/api/interno/control/alertas?${p.toString()}`, { credentials: 'include' });
      const j = await r.json() as AlertasResponse;
      if (!r.ok || !j.ok) throw new Error(j.error ?? 'Error al cargar alertas.');
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.');
    } finally {
      setCargando(false);
    }
  }, [tenantFiltro, nivelFiltro]);

  useEffect(() => { void cargar(); }, [cargar]);

  const alertasOrdenadas = useMemo(() => data?.alertas ?? [], [data]);

  const handleRevisar = async (alerta: AlertaControlInterno, estado: 'GESTIONADA' | 'DESCARTADA') => {
    if (!alerta.id) return;
    const nota = window.prompt(`Nota (${estado.toLowerCase()}):`)?.trim();
    if (estado === 'DESCARTADA' && !nota) {
      window.alert('Para descartar, indica una justificación.');
      return;
    }
    try {
      const r = await fetch(`/api/interno/control/alertas/${encodeURIComponent(alerta.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estado, nota }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null) as { error?: string } | null;
        throw new Error(j?.error ?? 'Error al marcar alerta.');
      }
      await cargar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
        <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          Dependencia
          <select className="select-internal mt-1 text-xs" value={tenantFiltro}
            onChange={(e) => setTenantFiltro(e.target.value as TenantId | 'TODOS')}>
            <option value="TODOS">Todas</option>
            {(Object.keys(DIRECTORIO_TENANTS) as TenantId[]).map((t) => (
              <option key={t} value={t}>{NOMBRES_TENANT[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
          Nivel
          <select className="select-internal mt-1 text-xs" value={nivelFiltro}
            onChange={(e) => setNivelFiltro(e.target.value as NivelRiesgo | 'TODOS')}>
            <option value="TODOS">Todos</option>
            {NIVELES.map((n) => <option key={n} value={n}>{LABEL_NIVEL_RIESGO[n]}</option>)}
          </select>
        </label>
        {data?.resumen && (() => {
          const resumen = data.resumen;
          return (
            <div className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>
              {NIVELES.map((n) => (
                <span key={n} className="px-2 py-1 rounded-md" style={{
                  background: colorBadgeNivel(n).bg, color: colorBadgeNivel(n).fg, border: `1px solid ${colorBadgeNivel(n).bd}`,
                }}>
                  {LABEL_NIVEL_RIESGO[n]}: {resumen[n] ?? 0}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {cargando ? <Cargando label="Calculando alertas…" /> : error ? <Aviso tipo="error" mensaje={error} /> : (
        alertasOrdenadas.length === 0 ? (
          <Aviso tipo="info" mensaje="No hay alertas activas con los filtros aplicados." />
        ) : (
          <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #D9E2D9' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead style={{ background: '#F8FAF7' }}>
                  <tr>
                    {['Nivel', 'Tipo', 'Radicado', 'Dependencia', 'Responsable', 'Motivo', 'Acción sugerida', 'Acciones'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertasOrdenadas.map((a, i) => {
                    const c = colorBadgeNivel(a.nivel);
                    return (
                      <tr key={`${a.id ?? i}-${a.radicadoId ?? 'g'}`} style={{ borderTop: '1px solid #EEF4EE' }}>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase" style={{
                            background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
                          }}>
                            {LABEL_NIVEL_RIESGO[a.nivel]}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium" style={{ color: '#1F2933' }}>{LABEL_TIPO_ALERTA[a.tipo]}</td>
                        <td className="px-3 py-2 font-mono" style={{ color: '#14532D' }}>{a.radicadoId ?? '—'}</td>
                        <td className="px-3 py-2" style={{ color: '#667085' }}>{a.tenantId ? NOMBRES_TENANT[a.tenantId] : '—'}</td>
                        <td className="px-3 py-2" style={{ color: '#667085' }}>{a.responsableNombre ?? '—'}</td>
                        <td className="px-3 py-2" style={{ color: '#667085' }}>{a.motivo}</td>
                        <td className="px-3 py-2" style={{ color: '#667085' }}>{a.accionSugerida}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <button
                            type="button"
                            className="px-2 py-1 rounded-md text-[10px] font-bold mr-1"
                            style={{ background: '#EEF4EE', color: '#14532D', border: '1px solid #D9E2D9' }}
                            onClick={() => handleRevisar(a, 'GESTIONADA')}
                            disabled={!a.id}
                          >Marcar revisada</button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded-md text-[10px] font-bold"
                            style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}
                            onClick={() => handleRevisar(a, 'DESCARTADA')}
                            disabled={!a.id}
                          >Descartar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
