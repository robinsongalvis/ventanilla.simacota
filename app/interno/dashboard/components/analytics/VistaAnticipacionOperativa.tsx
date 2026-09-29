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
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { type IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';
import { AlertTriangle, Building2, Info, MapPin, TrendingUp } from 'lucide-react';

/* Ola 3 (ADR-0046): lenguaje del Tablero y lenguaje institucional. Los
   cálculos predictivos no cambian; solo cómo se presentan. */

interface VistaAnticipacionOperativaProps {
  radicados: VentanillaRadicado[];
}

/* ── Config visual por nivel de riesgo territorial ─────────── */
const NIVEL_STYLE = {
  CRITICO: {
    card:   { background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)' },
    badge:  'bg-red-50 oscuro:bg-red-500/15 text-red-700 oscuro:text-red-300 border-red-200 oscuro:border-red-500/30',
    bar:    'bg-red-500',
    tag:    { background: 'var(--tema-fondo-fee2e2)', color: 'var(--tema-texto-b91c1c)' },
  },
  ALTO: {
    card:   { background: 'var(--tema-fondo-fff7ed)', border: '1px solid var(--tema-borde-fed7aa)' },
    badge:  'bg-orange-50 oscuro:bg-orange-500/15 text-orange-700 oscuro:text-orange-300 border-orange-200 oscuro:border-orange-500/30',
    bar:    'bg-orange-500',
    tag:    { background: 'var(--tema-fondo-ffedd5)', color: 'var(--tema-texto-c2410c)' },
  },
  NORMAL: {
    card:   { background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)' },
    badge:  'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300 border-green-200 oscuro:border-green-500/30',
    bar:    'bg-green-500',
    tag:    { background: 'var(--tema-fondo-dcfce7)', color: 'var(--tema-texto-006b45)' },
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

  const indicadores: IndicadorEstaticoProps[] = [
    { etiqueta: 'Riesgo Crítico', valor: `${reporte.criticosCount} casos`, tono: 'rojo', Icono: AlertTriangle, descripcion: 'Probabilidad de vencimiento ≥ 80%' },
    { etiqueta: 'Secretarías Saturadas', valor: `${reporte.saturadosCount} dependencias`, tono: 'ambar', Icono: Building2, descripcion: 'Resolución diaria al límite de capacidad' },
    { etiqueta: 'Temas en alza', valor: `${reporte.tendenciasTags.filter(t => t.esAnomalia).length} anomalías`, tono: 'verde', Icono: TrendingUp, descripcion: 'Crecimiento de problemáticas ≥ 30%' },
    { etiqueta: 'Zona de mayor riesgo', valor: reporte.riesgoTerritorial.find(z => z.nivelRiesgoTerritorial === 'CRITICO')?.nombreZona || 'Ninguno', tono: 'gris', Icono: MapPin, descripcion: 'Zona con riesgo agregado más crítico' },
  ];

  return (
    <div className="animate-fade-in-up">

      <SectionHeader
        titulo="Anticipación Operativa y Análisis Predictivo"
        subtitulo="Previsión de vencimientos, cuellos de botella e insatisfacción por zona del municipio."
        nota="La IA sugiere; el funcionario decide. Estas estimaciones orientan la gestión y no reemplazan la revisión de cada caso."
        acciones={<StatusBadge tono="success" conPunto tamano="sm">Análisis predictivo activo</StatusBadge>}
      />

      {/* Indicadores (lenguaje del Tablero) */}
      <FilaTarjetas etiqueta="Indicadores de anticipación" className="px-3 sm:px-4 lg:px-6">
        {indicadores.map((i) => <TarjetaIndicador key={i.etiqueta} {...i} descripcionVisible />)}
      </FilaTarjetas>

      {/* Fila central: matriz territorial + tendencias */}
      <div className="mt-3 grid grid-cols-1 gap-3 px-3 sm:px-4 lg:px-6 md:grid-cols-3 *:min-w-0">

        {/* Riesgo por zona */}
        <div className="md:col-span-2 rounded-xl p-3 space-y-3 flex flex-col bg-[var(--tema-fondo-ffffff)]">
          <div>
            <h3 className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
              Riesgo por zona del municipio
            </h3>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Volumen activo, riesgo promedio y temas más frecuentes de cada zona, en tiempo real.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {reporte.riesgoTerritorial.map((zt) => {
              const nivel = getNivel(zt.nivelRiesgoTerritorial);
              const cfg   = NIVEL_STYLE[nivel];
              return (
                <div key={zt.zona}
                     className="p-3 rounded-xl flex flex-col justify-between gap-3 min-h-[140px] transition-all duration-200"
                     style={cfg.card}>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--tema-texto-172033)' }}>{zt.nombreZona}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest border ${cfg.badge}`}>
                        {zt.nivelRiesgoTerritorial}
                      </span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--tema-texto-475569)' }}>{zt.totalRadicadosActivos} casos activos</p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5" style={{ color: 'var(--tema-texto-475569)' }}>
                        <span>Riesgo Promedio</span>
                        <span className="font-bold">{zt.probabilidadRiesgoPromedio}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-e5e7eb)' }}>
                        <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                             style={{ width: `${zt.probabilidadRiesgoPromedio}%` }} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {zt.tagsMasComunes.length > 0 ? (
                        zt.tagsMasComunes.map((t, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={cfg.tag}>
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px]" style={{ color: 'var(--tema-texto-475569)' }}>Sin temas registrados</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temas en aumento */}
        <div className="md:col-span-1 rounded-xl p-3 space-y-3 flex flex-col bg-[var(--tema-fondo-ffffff)]">
          <div>
            <h3 className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
              Temas ciudadanos en aumento
            </h3>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Etiquetas ciudadanas emergentes: últimos 15 días frente a los 15 anteriores.
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
                       style={{ border: '1px solid var(--tema-borde-dce4ea)', background: 'var(--tema-fondo-f7f9fb)' }}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--tema-texto-172033)' }}>#{tend.tag}</p>
                      <p className="text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>
                        Historial: {tend.frecuenciaW2} → Actual: {tend.frecuenciaW1} menciones
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={`text-[10px] font-bold ${
                        esAlzaCritica ? 'text-red-700 oscuro:text-red-300' : esCreciente ? 'text-amber-700 oscuro:text-amber-300'
                          : tend.crecimientoPercent < 0 ? 'text-green-700 oscuro:text-green-300' : ''
                      }`} style={(!esAlzaCritica && !esCreciente && tend.crecimientoPercent >= 0) ? { color: 'var(--tema-texto-64748b)' } : {}}>
                        {tend.crecimientoPercent > 0 ? `+${tend.crecimientoPercent}` : `${tend.crecimientoPercent}`}%
                      </span>
                      <span className={`text-xs ${
                        esAlzaCritica ? 'text-red-700 oscuro:text-red-300 font-extrabold'
                          : esCreciente ? 'text-amber-700 oscuro:text-amber-300 font-bold' : ''
                      }`} style={(!esAlzaCritica && !esCreciente) ? { color: 'var(--tema-texto-64748b)' } : {}} aria-hidden="true">
                        {esAlzaCritica ? '↑↑' : esCreciente ? '↑' : '↓'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>
                Aún no hay datos suficientes para comparar los dos periodos.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fila inferior: tabla riesgos + explicabilidad */}
      <div className="mt-3 grid grid-cols-1 gap-3 px-3 sm:px-4 lg:px-6 md:grid-cols-3 *:min-w-0">

        {/* Solicitudes con mayor riesgo */}
        <div className="md:col-span-2 rounded-xl p-3 space-y-3 bg-[var(--tema-fondo-ffffff)]">
          <div>
            <h3 className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
              Solicitudes con mayor riesgo de vencimiento
            </h3>
            <p className="text-[10px] leading-relaxed mt-0.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Riesgo de vencer el término legal, recalculado con la carga de trabajo y la complejidad de cada solicitud.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <CabeceraTablaSticky columnas={['Consecutivo', 'Asunto', 'Plazo hábiles', 'Prob. vencimiento']} />
              <tbody>
                {reporte.analisisRiesgoDetallado.slice(0, 5).map((risko) => {
                  const seleccionado = radicadoSeleccionado?.radicadoId === risko.radicadoId;
                  const esCritico = risko.categoriaRiesgo === 'CRITICO';
                  const esMedio   = risko.categoriaRiesgo === 'MEDIO';
                  return (
                    <tr key={risko.radicadoId}
                        onClick={() => setRadicadoSeleccionado(risko)}
                        className={`cursor-pointer transition-colors ${seleccionado ? '' : 'hover:bg-[var(--tema-fondo-f7f9fb)]'}`}
                        style={{
                          borderBottom: '1px solid var(--tema-borde-f4f9f6)',
                          background: seleccionado ? 'var(--tema-fondo-f4f9f6)' : undefined,
                          borderLeft: seleccionado ? '3px solid var(--tema-borde-007049)' : undefined,
                        }}>
                      <td className="px-2 py-2.5 font-bold">
                        {/* Botón: la fila también se elige con teclado (antes solo con ratón). */}
                        <button
                          type="button"
                          aria-pressed={seleccionado}
                          aria-label={`Ver la explicación del riesgo de ${risko.radicadoId}`}
                          onClick={(e) => { e.stopPropagation(); setRadicadoSeleccionado(risko); }}
                          className="rounded font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
                          style={{ color: 'var(--tema-texto-007049)' }}
                        >
                          {risko.radicadoId}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 font-medium max-w-[200px] truncate" style={{ color: 'var(--tema-texto-172033)' }}>
                        {risko.asunto}
                      </td>
                      <td className="px-2 py-2.5 text-center font-bold tabular-nums">
                        {risko.diasHabilesRestantes < 0 ? (
                          <span className="text-red-700 oscuro:text-red-300">Vencido ({Math.abs(risko.diasHabilesRestantes)})</span>
                        ) : (
                          <span className={esCritico ? 'text-red-700 oscuro:text-red-300' : esMedio ? 'text-amber-700 oscuro:text-amber-300' : ''} style={(!esCritico && !esMedio) ? { color: 'var(--tema-texto-64748b)' } : {}}>
                            {risko.diasHabilesRestantes}d
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-3">
                          <span className={`font-black tracking-tight w-8 text-right ${
                            esCritico ? 'text-red-700 oscuro:text-red-300' : esMedio ? 'text-amber-700 oscuro:text-amber-300' : ''
                          }`} style={(!esCritico && !esMedio) ? { color: 'var(--tema-texto-64748b)' } : {}}>
                            {risko.probabilidadVencimiento}%
                          </span>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
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
        <div className="md:col-span-1 rounded-xl p-3 space-y-3 flex flex-col bg-[var(--tema-fondo-ffffff)]"
             style={{ borderLeft: '4px solid var(--tema-borde-007049)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Info className="w-4 h-4" strokeWidth={2.5} style={{ color: 'var(--tema-texto-007049)' }} aria-hidden="true" />
              <h3 className="text-xs font-black" style={{ color: 'var(--tema-texto-007049)' }}>
                Auditoría Predictiva
              </h3>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--tema-texto-64748b)' }}>
              Por qué el sistema estima este riesgo: factores y cálculo aplicados a la solicitud elegida.
            </p>
          </div>

          {radicadoSeleccionado && explicacionRadicado ? (
            <div className="flex-1 pt-2 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between pb-2"
                     style={{ borderBottom: '1px solid var(--tema-borde-dce4ea)' }}>
                  <span className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>{radicadoSeleccionado.radicadoId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                    radicadoSeleccionado.categoriaRiesgo === 'CRITICO'
                      ? 'bg-red-50 oscuro:bg-red-500/15 text-red-700 oscuro:text-red-300 border-red-200 oscuro:border-red-500/30'
                      : radicadoSeleccionado.categoriaRiesgo === 'MEDIO'
                        ? 'bg-amber-50 oscuro:bg-amber-500/15 text-amber-700 oscuro:text-amber-300 border-amber-200 oscuro:border-amber-500/30'
                        : 'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300 border-green-200 oscuro:border-green-500/30'
                  }`}>
                    {radicadoSeleccionado.categoriaRiesgo}
                  </span>
                </div>

                <p className="text-[10px] leading-normal p-2.5 rounded-lg mt-3"
                   style={{ background: 'var(--tema-fondo-f4f9f6)', border: '1px solid var(--tema-borde-dce4ea)', color: 'var(--tema-texto-007049)' }}>
                  {explicacionRadicado.resumenExplicable}
                </p>

                <div className="space-y-3 pt-3">
                  {explicacionRadicado.factores.map((fact, idx) => {
                    const esIncr = fact.impacto === 'ALTO_INCREMENTO';
                    const esMod  = fact.impacto === 'MODERADO_INCREMENTO';
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span style={{ color: 'var(--tema-texto-172033)' }}>{fact.nombre}</span>
                          <span className={esIncr ? 'text-red-700 oscuro:text-red-300' : esMod ? 'text-amber-700 oscuro:text-amber-300' : 'text-green-700 oscuro:text-green-300'}>
                            {esIncr ? 'Alto' : esMod ? 'Medio' : 'Reductor'}
                          </span>
                        </div>
                        <p className="text-[10px] leading-normal" style={{ color: 'var(--tema-texto-64748b)' }}>{fact.detalle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3" style={{ borderTop: '1px solid var(--tema-borde-dce4ea)' }}>
                <div className="flex justify-between gap-2 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>
                  <span>Modelo (función logística):</span>
                  <span className="font-bold font-mono">1 / (1 + e^-k(T_std - d))</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-[10px]" style={{ color: 'var(--tema-texto-64748b)' }}>
              Selecciona un radicado en la tabla para auditar su predicción.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
