'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { VentanillaRadicado, AuditoriaOverride } from '@/src/types/ventanilla';
import {
  orquestarReportePredictivo,
  explicarRiesgoRadicado,
  type ReporteInteligenciaMunicipal,
  type AnalisisRiesgoRadicado
} from '@/lib/ai/predictive';

interface VistaAnticipacionOperativaProps {
  radicados: VentanillaRadicado[];
}

/* ── Config visual por nivel de riesgo territorial ─────────── */
const NIVEL_STYLE = {
  CRITICO: {
    card:   { background: '#FEF2F2', border: '1px solid #FECACA' },
    badge:  'bg-red-50 text-red-700 border-red-200',
    bar:    'bg-red-500',
    tag:    { background: '#FEE2E2', color: '#B91C1C' },
  },
  ALTO: {
    card:   { background: '#FFF7ED', border: '1px solid #FED7AA' },
    badge:  'bg-orange-50 text-orange-700 border-orange-200',
    bar:    'bg-orange-500',
    tag:    { background: '#FFEDD5', color: '#C2410C' },
  },
  NORMAL: {
    card:   { background: '#F0FDF4', border: '1px solid #BBF7D0' },
    badge:  'bg-green-50 text-green-700 border-green-200',
    bar:    'bg-green-500',
    tag:    { background: '#DCFCE7', color: '#166534' },
  },
} as const;

type NivelKey = 'CRITICO' | 'ALTO' | 'NORMAL';

function getNivel(n: string): NivelKey {
  if (n === 'CRITICO') return 'CRITICO';
  if (n === 'ALTO') return 'ALTO';
  return 'NORMAL';
}

export function VistaAnticipacionOperativa({ radicados }: VistaAnticipacionOperativaProps) {
  const [audits, setAudits] = useState<AuditoriaOverride[]>([]);
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState<AnalisisRiesgoRadicado | null>(null);

  useEffect(() => {
    const db = getDb();
    const q = query(collection(db, 'ai_auditoria'), limit(150));
    const unsub = onSnapshot(q, (snap) => {
      setAudits(snap.docs.map(d => d.data() as AuditoriaOverride));
    }, (err) => console.error('Error al escuchar ai_auditoria:', err));
    return () => unsub();
  }, []);

  const reporte = useMemo<ReporteInteligenciaMunicipal>(() => {
    return orquestarReportePredictivo(radicados, audits);
  }, [radicados, audits]);

  const explicacionRadicado = useMemo(() => {
    if (!radicadoSeleccionado) return null;
    return explicarRiesgoRadicado(radicadoSeleccionado);
  }, [radicadoSeleccionado]);

  useEffect(() => {
    if (reporte.analisisRiesgoDetallado.length > 0 && !radicadoSeleccionado) {
      setRadicadoSeleccionado(reporte.analisisRiesgoDetallado[0]);
    }
  }, [reporte.analisisRiesgoDetallado, radicadoSeleccionado]);

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight"
              style={{ fontFamily: 'var(--font-manrope)', color: '#1F2933' }}>
            Anticipación Operativa y Análisis Predictivo
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#667085' }}>
            Previsión determinística de vencimientos, cuellos de botella e insatisfacción territorial.
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"
             style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Radar Predictivo Activo
        </div>
      </div>

      {/* KPIs proactivos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Riesgo Crítico"
          value={`${reporte.criticosCount} casos`}
          desc="Probabilidad de vencimiento ≥ 80%"
          valueStyle={{ color: '#DC2626' }}
          cardStyle={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
        />
        <KpiCard
          label="Secretarías Saturadas"
          value={`${reporte.saturadosCount} dependencias`}
          desc="Resolución diaria al límite de capacidad"
          valueStyle={{ color: '#D97706' }}
          cardStyle={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
        />
        <KpiCard
          label="Etiquetas en Desviación"
          value={`${reporte.tendenciasTags.filter(t => t.esAnomalia).length} anomalías`}
          desc="Crecimiento de problemáticas ≥ 30%"
          valueStyle={{ color: '#14532D' }}
          cardStyle={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}
        />
        <KpiCard
          label="Territorio Hotspot"
          value={reporte.riesgoTerritorial.find(z => z.nivelRiesgoTerritorial === 'CRITICO')?.nombreZona || 'Ninguno'}
          desc="Zona con riesgo agregado más crítico"
          valueStyle={{ color: '#1F2933' }}
          cardStyle={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}
        />
      </div>

      {/* Fila central: matriz territorial + tendencias */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Matriz territorial */}
        <div className="md:col-span-2 rounded-2xl p-5 space-y-4 flex flex-col bg-white"
             style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1F2933' }}>
              Hotspots Territoriales de Riesgo
            </h3>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: '#94A3B8' }}>
              Correlación territorial en tiempo real de volumen activo, scores de riesgo y problemáticas prioritarias.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {reporte.riesgoTerritorial.map((zt) => {
              const nivel = getNivel(zt.nivelRiesgoTerritorial);
              const cfg   = NIVEL_STYLE[nivel];
              return (
                <div key={zt.zona}
                     className="p-4 rounded-xl flex flex-col justify-between h-[160px] transition-all duration-200"
                     style={cfg.card}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold" style={{ color: '#1F2933' }}>{zt.nombreZona}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest border ${cfg.badge}`}>
                        {zt.nivelRiesgoTerritorial}
                      </span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: '#667085' }}>{zt.totalRadicadosActivos} casos activos</p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[9px] mb-0.5" style={{ color: '#94A3B8' }}>
                        <span>Riesgo Promedio</span>
                        <span className="font-bold">{zt.probabilidadRiesgoPromedio}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#E5E7EB' }}>
                        <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                             style={{ width: `${zt.probabilidadRiesgoPromedio}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {zt.tagsMasComunes.length > 0 ? (
                        zt.tagsMasComunes.map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded text-[8px] font-medium" style={cfg.tag}>
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-[8px]" style={{ color: '#94A3B8' }}>Sin tags registrados</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tendencias semánticas */}
        <div className="md:col-span-1 rounded-2xl p-5 space-y-4 flex flex-col bg-white"
             style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1F2933' }}>
              Deriva de Tendencias Semánticas
            </h3>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: '#94A3B8' }}>
              Etiquetas ciudadanas emergentes (últimos 15 días vs anteriores 15 días).
            </p>
          </div>
          <div className="space-y-2.5 overflow-y-auto max-h-[160px] pr-1.5 pt-1">
            {reporte.tendenciasTags.length > 0 ? (
              reporte.tendenciasTags.slice(0, 4).map((tend) => {
                const esAlzaCritica = tend.tendencia === 'ALTA_CRITICA';
                const esCreciente  = tend.tendencia === 'CRECIENTE';
                return (
                  <div key={tend.tag}
                       className="flex items-center justify-between p-2 rounded-xl"
                       style={{ border: '1px solid #D9E2D9', background: '#F8FAF7' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: '#1F2933' }}>#{tend.tag}</p>
                      <p className="text-[9px]" style={{ color: '#94A3B8' }}>
                        Historial: {tend.frecuenciaW2} ➔ Actual: {tend.frecuenciaW1} menciones
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={`text-[10px] font-bold ${
                        esAlzaCritica ? 'text-red-600' : esCreciente ? 'text-amber-600'
                          : tend.crecimientoPercent < 0 ? 'text-green-700' : ''
                      }`} style={(!esAlzaCritica && !esCreciente && tend.crecimientoPercent >= 0) ? { color: '#94A3B8' } : {}}>
                        {tend.crecimientoPercent > 0 ? `+${tend.crecimientoPercent}` : `${tend.crecimientoPercent}`}%
                      </span>
                      <span className={`text-xs ${
                        esAlzaCritica ? 'text-red-600 font-extrabold animate-bounce'
                          : esCreciente ? 'text-amber-600 font-bold' : ''
                      }`} style={(!esAlzaCritica && !esCreciente) ? { color: '#94A3B8' } : {}}>
                        {esAlzaCritica ? '↑↑' : esCreciente ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-[10px]" style={{ color: '#94A3B8' }}>
                No hay suficientes datos semánticos para mapear delta.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fila inferior: tabla riesgos + explicabilidad */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Tabla de radicados en riesgo */}
        <div className="md:col-span-2 rounded-2xl p-5 space-y-4 bg-white"
             style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1F2933' }}>
              Ránking de Solicitudes en Riesgo
            </h3>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: '#94A3B8' }}>
              Riesgos de término legal recomputados en caliente a partir de la cola de trabajo y la complejidad semántica.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr style={{ background: '#EEF4EE', borderBottom: '1px solid #D9E2D9' }}>
                  {['Consecutivo','Asunto','Plazo hábiles','Prob. vencimiento'].map(h => (
                    <th key={h} className="pb-2 pt-2 px-2 font-bold uppercase tracking-wider"
                        style={{ color: '#14532D' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reporte.analisisRiesgoDetallado.slice(0, 5).map((risko) => {
                  const seleccionado = radicadoSeleccionado?.radicadoId === risko.radicadoId;
                  const esCritico = risko.categoriaRiesgo === 'CRITICO';
                  const esMedio   = risko.categoriaRiesgo === 'MEDIO';
                  return (
                    <tr key={risko.radicadoId}
                        onClick={() => setRadicadoSeleccionado(risko)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: '1px solid #EEF4EE',
                          background: seleccionado ? '#EEF4EE' : undefined,
                          borderLeft: seleccionado ? '3px solid #14532D' : undefined,
                        }}
                        onMouseEnter={(e) => { if (!seleccionado) (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; }}
                        onMouseLeave={(e) => { if (!seleccionado) (e.currentTarget as HTMLElement).style.background = ''; }}>
                      <td className="py-3 pl-2 font-bold" style={{ color: '#14532D' }}>{risko.radicadoId}</td>
                      <td className="py-3 font-medium max-w-[200px] truncate pr-4" style={{ color: '#1F2933' }}>
                        {risko.asunto}
                      </td>
                      <td className="py-3 text-center font-bold tabular-nums">
                        {risko.diasHabilesRestantes < 0 ? (
                          <span className="text-red-600">Vencido ({Math.abs(risko.diasHabilesRestantes)})</span>
                        ) : (
                          <span className={esCritico ? 'text-red-600' : esMedio ? 'text-amber-600' : ''} style={(!esCritico && !esMedio) ? { color: '#667085' } : {}}>
                            {risko.diasHabilesRestantes}d
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          <span className={`font-black tracking-tight w-8 text-right ${
                            esCritico ? 'text-red-600' : esMedio ? 'text-amber-600' : ''
                          }`} style={(!esCritico && !esMedio) ? { color: '#94A3B8' } : {}}>
                            {risko.probabilidadVencimiento}%
                          </span>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF4EE' }}>
                            <div className={`h-full rounded-full transition-all duration-300 ${
                              esCritico ? 'bg-red-500' : esMedio ? 'bg-amber-500' : 'bg-gray-300'
                            }`} style={{ width: `${risko.probabilidadVencimiento}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Auditoría predictiva */}
        <div className="md:col-span-1 rounded-2xl p-5 space-y-4 flex flex-col bg-white"
             style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)', borderLeft: '4px solid #14532D' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                   className="w-4 h-4" style={{ color: '#14532D' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#14532D' }}>
                Auditoría Predictiva
              </h3>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: '#94A3B8' }}>
              Explicabilidad determinística. Justificación matemática del score de riesgo inyectado.
            </p>
          </div>

          {radicadoSeleccionado && explicacionRadicado ? (
            <div className="flex-1 pt-2 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between pb-2"
                     style={{ borderBottom: '1px solid #D9E2D9' }}>
                  <span className="text-xs font-black" style={{ color: '#1F2933' }}>{radicadoSeleccionado.radicadoId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    radicadoSeleccionado.categoriaRiesgo === 'CRITICO'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : radicadoSeleccionado.categoriaRiesgo === 'MEDIO'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {radicadoSeleccionado.categoriaRiesgo}
                  </span>
                </div>

                <p className="text-[10px] leading-normal p-2.5 rounded-lg mt-3"
                   style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}>
                  {explicacionRadicado.resumenExplicable}
                </p>

                <div className="space-y-3 pt-3">
                  {explicacionRadicado.factores.map((fact, idx) => {
                    const esIncr = fact.impacto === 'ALTO_INCREMENTO';
                    const esMod  = fact.impacto === 'MODERADO_INCREMENTO';
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span style={{ color: '#1F2933' }}>{fact.nombre}</span>
                          <span className={esIncr ? 'text-red-600' : esMod ? 'text-amber-600' : 'text-green-700'}>
                            {esIncr ? 'Alto' : esMod ? 'Medio' : 'Reductor'}
                          </span>
                        </div>
                        <p className="text-[9px] leading-normal" style={{ color: '#94A3B8' }}>{fact.detalle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3" style={{ borderTop: '1px solid #D9E2D9' }}>
                <div className="flex justify-between text-[9px]" style={{ color: '#94A3B8' }}>
                  <span>Ecuación sigmoide:</span>
                  <span className="font-bold font-mono">1 / (1 + e^-k(T_std - d))</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-[10px]" style={{ color: '#94A3B8' }}>
              Selecciona un radicado en la tabla para auditar su predicción.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── KpiCard local ──────────────────────────────────────────── */

function KpiCard({
  label, value, desc, valueStyle, cardStyle,
}: {
  label: string; value: string; desc: string;
  valueStyle: React.CSSProperties; cardStyle: React.CSSProperties;
}) {
  return (
    <div className="rounded-2xl p-4 transition-all duration-200" style={{ ...cardStyle, boxShadow: '0 1px 3px rgba(20,83,45,0.04)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#667085' }}>{label}</p>
      <p className="text-2xl font-black mt-2 tracking-tight" style={{ fontFamily: 'var(--font-manrope)', ...valueStyle }}>
        {value}
      </p>
      <p className="text-[9px] mt-1 leading-relaxed" style={{ color: '#94A3B8' }}>{desc}</p>
    </div>
  );
}
