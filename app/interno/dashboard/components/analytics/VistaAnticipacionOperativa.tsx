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

export function VistaAnticipacionOperativa({ radicados }: VistaAnticipacionOperativaProps) {
  const [audits, setAudits] = useState<AuditoriaOverride[]>([]);
  const [radicadoSeleccionado, setRadicadoSeleccionado] = useState<AnalisisRiesgoRadicado | null>(null);

  // Escuchar ai_auditoria para acumular overrides históricos en caliente
  useEffect(() => {
    const db = getDb();
    const q = query(collection(db, 'ai_auditoria'), limit(150));
    const unsub = onSnapshot(q, (snap) => {
      setAudits(snap.docs.map(d => d.data() as AuditoriaOverride));
    }, (err) => console.error('Error al escuchar ai_auditoria:', err));

    return () => unsub();
  }, []);

  // Cómputo híbrido y determinístico del reporte predictivo maestro
  const reporte = useMemo<ReporteInteligenciaMunicipal>(() => {
    return orquestarReportePredictivo(radicados, audits);
  }, [radicados, audits]);

  // Explicabilidad detallada en caliente para el radicado interactivo seleccionado
  const explicacionRadicado = useMemo(() => {
    if (!radicadoSeleccionado) return null;
    return explicarRiesgoRadicado(radicadoSeleccionado);
  }, [radicadoSeleccionado]);

  // Selección automática del radicado de más alto riesgo si no hay uno seleccionado
  useEffect(() => {
    if (reporte.analisisRiesgoDetallado.length > 0 && !radicadoSeleccionado) {
      setRadicadoSeleccionado(reporte.analisisRiesgoDetallado[0]);
    }
  }, [reporte.analisisRiesgoDetallado, radicadoSeleccionado]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Cabecera del Visor */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-100" style={{ fontFamily: 'var(--font-manrope)' }}>
            Anticipación Operativa y Análisis Predictivo
          </h2>
          <p className="text-slate-400 text-xs mt-0.5">
            Previsión determinística de vencimientos, cuellos de botella e insatisfacción territorial.
          </p>
        </div>
        <div className="px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Radar Predictivo Activo
        </div>
      </div>

      {/* Fila de KPIs de Alerta Proactiva */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Riesgo Crítico"
          value={`${reporte.criticosCount} casos`}
          desc="Probabilidad de vencimiento >= 80%"
          color="text-rose-400"
          border="border-rose-500/10"
          bg="bg-rose-500/[0.02]"
        />
        <KpiCard
          label="Secretarías Saturadas"
          value={`${reporte.saturadosCount} dependencias`}
          desc="Resolución diaria al límite de capacidad"
          color="text-amber-400"
          border="border-amber-500/10"
          bg="bg-amber-500/[0.02]"
        />
        <KpiCard
          label="Etiquetas en Desviación"
          value={`${reporte.tendenciasTags.filter(t => t.esAnomalia).length} anomalías`}
          desc="Crecimiento de problemáticas >= 30%"
          color="text-indigo-400"
          border="border-indigo-500/10"
          bg="bg-indigo-500/[0.02]"
        />
        <KpiCard
          label="Territorio Hotspot"
          value={
            reporte.riesgoTerritorial.find(z => z.nivelRiesgoTerritorial === 'CRITICO')?.nombreZona || 'Ninguno'
          }
          desc="Zona con riesgo agregado más crítico"
          color="text-slate-300"
          border="border-white/10"
          bg="bg-white/[0.01]"
        />
      </div>

      {/* Fila Central: Matriz Territorial y Tendencias */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* 1. Matriz Territorial (Focos geográficos) */}
        <div className="md:col-span-2 rounded-2xl border border-white/10 bg-slate-900/40 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Hotspots Territoriales de Riesgo</h3>
            <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
              Correlación territorial en tiempo real de volumen activo, scores de riesgo y problemáticas prioritarias.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
            {reporte.riesgoTerritorial.map((zt) => (
              <div
                key={zt.zona}
                className={`p-4 rounded-xl border flex flex-col justify-between h-[160px] transition-all duration-200 ${
                  zt.nivelRiesgoTerritorial === 'CRITICO'
                    ? 'border-rose-500/20 bg-rose-500/[0.03] hover:bg-rose-500/[0.05]'
                    : zt.nivelRiesgoTerritorial === 'ALTO'
                      ? 'border-amber-500/20 bg-amber-500/[0.03] hover:bg-amber-500/[0.05]'
                      : 'border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.02]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200">{zt.nombreZona}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest ${
                        zt.nivelRiesgoTerritorial === 'CRITICO'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : zt.nivelRiesgoTerritorial === 'ALTO'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {zt.nivelRiesgoTerritorial}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">{zt.totalRadicadosActivos} casos activos</p>
                </div>

                <div className="space-y-2">
                  {/* Barra de progreso de riesgo */}
                  <div>
                    <div className="flex justify-between text-[9px] text-slate-400 mb-0.5">
                      <span>Riesgo Promedio</span>
                      <span className="font-bold">{zt.probabilidadRiesgoPromedio}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          zt.nivelRiesgoTerritorial === 'CRITICO'
                            ? 'bg-rose-500'
                            : zt.nivelRiesgoTerritorial === 'ALTO'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${zt.probabilidadRiesgoPromedio}%` }}
                      />
                    </div>
                  </div>

                  {/* Temas más comunes */}
                  <div className="flex flex-wrap gap-1">
                    {zt.tagsMasComunes.length > 0 ? (
                      zt.tagsMasComunes.map((t, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 text-[8px] font-medium border border-white/[0.02]">
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[8px] text-slate-600">Sin tags registrados</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Tendencias en Alza / Baja */}
        <div className="md:col-span-1 rounded-2xl border border-white/10 bg-slate-900/40 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Deriva de Tendencias Semánticas</h3>
            <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
              Etiquetas ciudadanas emergentes (últimos 15 días vs anteriores 15 días).
            </p>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[160px] pr-1.5 pt-1">
            {reporte.tendenciasTags.length > 0 ? (
              reporte.tendenciasTags.slice(0, 4).map((tend) => {
                const esAlzaCritica = tend.tendencia === 'ALTA_CRITICA';
                const esCreciente = tend.tendencia === 'CRECIENTE';
                
                return (
                  <div
                    key={tend.tag}
                    className="flex items-center justify-between p-2 rounded-xl border border-white/[0.03] bg-white/[0.01]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-300 truncate">#{tend.tag}</p>
                      <p className="text-[9px] text-slate-500">
                        Historial: {tend.frecuenciaW2} ➔ Actual: {tend.frecuenciaW1} menciones
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold ${
                        esAlzaCritica
                          ? 'text-rose-400'
                          : esCreciente
                            ? 'text-indigo-400'
                            : tend.crecimientoPercent < 0
                              ? 'text-emerald-400'
                              : 'text-slate-400'
                      }`}>
                        {tend.crecimientoPercent > 0 ? `+${tend.crecimientoPercent}` : `${tend.crecimientoPercent}`}%
                      </span>
                      <span className={`text-xs ${
                        esAlzaCritica
                          ? 'text-rose-400 font-extrabold animate-bounce'
                          : esCreciente
                            ? 'text-indigo-400 font-bold'
                            : 'text-slate-500'
                      }`}>
                        {esAlzaCritica ? '↑↑' : esCreciente ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-[10px] text-slate-600">No hay suficientes datos semánticos para mapear delta.</div>
            )}
          </div>
        </div>
      </div>

      {/* Fila Inferior: Tabla de Riesgos e Interactividad de Explicabilidad */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Tabla de Radicados en Riesgo */}
        <div className="md:col-span-2 rounded-2xl border border-white/10 bg-slate-900/40 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Ránking de Solicitudes en Riesgo</h3>
            <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
              Riesgos de término legal recomputados en caliente a partir de la cola de trabajo y la complejidad semántica.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="pb-2 font-bold uppercase tracking-wider pl-2">Consecutivo</th>
                  <th className="pb-2 font-bold uppercase tracking-wider">Asunto</th>
                  <th className="pb-2 font-bold uppercase tracking-wider text-center">Plazo Hábiles</th>
                  <th className="pb-2 font-bold uppercase tracking-wider">Prob. Vencimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-300">
                {reporte.analisisRiesgoDetallado.slice(0, 5).map((risko) => {
                  const seleccionado = radicadoSeleccionado?.radicadoId === risko.radicadoId;
                  const esCritico = risko.categoriaRiesgo === 'CRITICO';
                  const esMedio = risko.categoriaRiesgo === 'MEDIO';

                  return (
                    <tr
                      key={risko.radicadoId}
                      onClick={() => setRadicadoSeleccionado(risko)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        seleccionado
                          ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-3 pl-2 font-bold text-slate-200">{risko.radicadoId}</td>
                      <td className="py-3 font-medium text-slate-300 max-w-[200px] truncate pr-4">
                        {risko.asunto}
                      </td>
                      <td className="py-3 text-center font-bold tabular-nums">
                        {risko.diasHabilesRestantes < 0 ? (
                          <span className="text-rose-400">Vencido ({Math.abs(risko.diasHabilesRestantes)})</span>
                        ) : (
                          <span className={esCritico ? 'text-rose-400' : esMedio ? 'text-amber-400' : 'text-slate-400'}>
                            {risko.diasHabilesRestantes}d
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-3">
                          <span className={`font-black tracking-tight w-8 text-right ${
                            esCritico ? 'text-rose-400' : esMedio ? 'text-amber-400' : 'text-slate-400'
                          }`}>
                            {risko.probabilidadVencimiento}%
                          </span>
                          <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                esCritico ? 'bg-rose-500' : esMedio ? 'bg-amber-500' : 'bg-slate-500'
                              }`}
                              style={{ width: `${risko.probabilidadVencimiento}%` }}
                            />
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

        {/* Panel de Explicabilidad (Auditoría de Inferencia) */}
        <div className="md:col-span-1 rounded-2xl border border-indigo-500/20 bg-indigo-950/[0.1] p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-indigo-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-300">Auditoría Predictiva</h3>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Explicabilidad determinística. Justificación matemática del score de riesgo inyectado.
            </p>
          </div>

          {radicadoSeleccionado && explicacionRadicado ? (
            <div className="flex-1 pt-3 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                  <span className="text-xs font-black text-slate-200">{radicadoSeleccionado.radicadoId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    radicadoSeleccionado.categoriaRiesgo === 'CRITICO'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : radicadoSeleccionado.categoriaRiesgo === 'MEDIO'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {radicadoSeleccionado.categoriaRiesgo}
                  </span>
                </div>

                {/* Explicación resumida */}
                <p className="text-[10px] text-indigo-300/80 leading-normal bg-indigo-500/[0.04] p-2.5 rounded-lg border border-indigo-500/10 mt-3">
                  {explicacionRadicado.resumenExplicable}
                </p>

                {/* Factores desglosados */}
                <div className="space-y-3 pt-3">
                  {explicacionRadicado.factores.map((fact, idx) => {
                    const esIncr = fact.impacto === 'ALTO_INCREMENTO';
                    const esMod = fact.impacto === 'MODERADO_INCREMENTO';

                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-200">
                          <span>{fact.nombre}</span>
                          <span className={esIncr ? 'text-rose-400' : esMod ? 'text-amber-400' : 'text-emerald-400'}>
                            {esIncr ? 'Alto' : esMod ? 'Medio' : 'Reductor'}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-normal">{fact.detalle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón de control de gobernanza */}
              <div className="border-t border-indigo-500/10 pt-3">
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>Ecuación sigmoide:</span>
                  <span className="font-bold font-mono">1 / (1 + e^-k(T_std - d))</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-[10px] text-slate-600">Selecciona un radicado en la tabla para auditar su predicción.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  desc,
  color,
  border,
  bg
}: {
  label: string;
  value: string;
  desc: string;
  color: string;
  border: string;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${border} ${bg} transition-all duration-200 hover:border-white/20`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`text-2xl font-black mt-2 tracking-tight ${color}`} style={{ fontFamily: 'var(--font-manrope)' }}>
        {value}
      </p>
      <p className="text-[9px] text-slate-600 mt-1 leading-relaxed">{desc}</p>
    </div>
  );
}
