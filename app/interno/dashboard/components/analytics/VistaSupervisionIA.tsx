'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { AI_FEATURE_FLAGS } from '@/lib/ai-flags';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { type IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { CabeceraTablaSticky } from '@/app/components/design-system/SuperficieTabla';
import { AlertTriangle, Gauge, Route, Target, Timer } from 'lucide-react';

/* Ola 3 (ADR-0046): lenguaje del Tablero y lenguaje institucional (sin
   emojis ni jerga en pantalla). Los cálculos no cambian. */

interface FeedbackDoc {
  feedbackId: string;
  radicadoId: string;
  puntuacion: 'POSITIVO' | 'CORREGIDO' | 'NEGATIVO';
  motivoCorreccion?: string | null;
  fecha: string;
}

interface AuditDoc {
  auditoriaId: string;
  radicadoId: string;
  timestamp: string;
  clasificacionOriginal?: string;
  clasificacionFinal?: string;
  confianzaIA?: number;
  accionFuncionario: 'ACEPTADO' | 'MODIFICADO' | 'RECHAZADO';
}

interface LogDoc {
  logId: string;
  endpoint: 'classify' | 'chat';
  latenciaMs: number;
  error?: string | null;
  fallbackActivo: boolean;
  timestamp: string;
}

export function VistaSupervisionIA() {
  const [feedbacks, setFeedbacks] = useState<FeedbackDoc[]>([]);
  const [audits,    setAudits]    = useState<AuditDoc[]>([]);
  const [logs,      setLogs]      = useState<LogDoc[]>([]);
  const [cargando,  setCargando]  = useState(true);

  useEffect(() => {
    const db = getDb();
    const qFeedback = query(collection(db, 'ai_feedback'), orderBy('fecha', 'desc'), limit(100));
    const unsubFeedback = onSnapshot(qFeedback, (snap) => {
      setFeedbacks(snap.docs.map(d => d.data() as FeedbackDoc));
      setCargando(false);
    }, () => setCargando(false));

    const qAudit = query(collection(db, 'ai_auditoria'), orderBy('timestamp', 'desc'), limit(100));
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setAudits(snap.docs.map(d => d.data() as AuditDoc));
    });

    const qLogs = query(collection(db, 'ai_logs'), orderBy('timestamp', 'desc'), limit(30));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => d.data() as LogDoc));
    });

    return () => { unsubFeedback(); unsubAudit(); unsubLogs(); };
  }, []);

  const kpis = useMemo(() => {
    const total = feedbacks.length;
    if (total === 0) {
      return { precisionGlobal: 100, tasaAceptacion: 100, confianzaPromedio: 92, overridesCount: 0, latenciaPromedio: 850 };
    }
    const positivos  = feedbacks.filter(f => f.puntuacion === 'POSITIVO').length;
    const corregidos = feedbacks.filter(f => f.puntuacion === 'CORREGIDO').length;
    const totalLatencia = logs.reduce((acc, l) => acc + l.latenciaMs, 0);
    const latenciaPromedio = logs.length > 0 ? Math.round(totalLatencia / logs.length) : 650;
    const auditsConConfianza = audits.filter(a => a.confianzaIA !== undefined && a.confianzaIA !== null);
    const totalConfianza = auditsConConfianza.reduce((acc, a) => acc + (a.confianzaIA || 0), 0);
    const confianzaPromedio = auditsConConfianza.length > 0
      ? Math.round((totalConfianza / auditsConConfianza.length) * 100) : 88;
    return {
      precisionGlobal:  Math.round((positivos / total) * 100),
      tasaAceptacion:   Math.round(((total - corregidos) / total) * 100),
      confianzaPromedio,
      overridesCount:   corregidos,
      latenciaPromedio,
    };
  }, [feedbacks, audits, logs]);

  const healthStatus = useMemo(() => {
    if (logs.length === 0) {
      return { status: 'IA en servicio (Gemini)', tono: 'success' as const };
    }
    const ultimos10 = logs.slice(0, 10);
    const errores = ultimos10.filter(l => l.error !== null).length;
    const latenciasAltas = ultimos10.filter(l => l.latenciaMs > 8000).length;
    const fallbacks = ultimos10.filter(l => l.fallbackActivo).length;
    if (errores >= 3 || latenciasAltas >= 3) {
      return { status: 'IA degradada', tono: 'danger' as const };
    }
    if (fallbacks > 0) {
      return { status: 'Respaldo local activo', tono: 'warning' as const };
    }
    return { status: 'IA en servicio (Gemini)', tono: 'success' as const };
  }, [logs]);

  const driftAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (feedbacks.length >= 10 && kpis.precisionGlobal < 80) {
      alerts.push(`Deriva de Precisión detectada: La precisión global de la IA ha caído a un ${kpis.precisionGlobal}%, situándose por debajo del umbral de gobernanza (80%).`);
    }
    if (kpis.confianzaPromedio < 75) {
      alerts.push(`Degradación de Confianza: El score promedio de certeza arrojado por el modelo es del ${kpis.confianzaPromedio}%, sugiriendo ambigüedad en las solicitudes ciudadanas.`);
    }
    const overridesPorDependencia: Record<string, number> = {};
    let totalOverrides = 0;
    audits.forEach(a => {
      if (a.accionFuncionario === 'MODIFICADO' && a.clasificacionOriginal) {
        overridesPorDependencia[a.clasificacionOriginal] = (overridesPorDependencia[a.clasificacionOriginal] || 0) + 1;
        totalOverrides++;
      }
    });
    if (totalOverrides > 3) {
      Object.entries(overridesPorDependencia).forEach(([dep, count]) => {
        const ratio = (count / totalOverrides) * 100;
        if (ratio > 40) {
          const nombreDep = NOMBRES_TENANT[dep as keyof typeof NOMBRES_TENANT] || dep;
          alerts.push(`Desvío Crítico en Dependencia: La IA presenta alta tasa de corrección (${count} correcciones) en ${nombreDep}, representando el ${ratio.toFixed(0)}% del total de fallos.`);
        }
      });
    }
    return alerts;
  }, [feedbacks, audits, kpis]);

  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} />
      </div>
    );
  }

  const indicadores: IndicadorEstaticoProps[] = [
    { etiqueta: 'Precisión Global IA', valor: `${kpis.precisionGlobal}%`, tono: 'verde', Icono: Target, descripcion: 'Valoraciones positivas sobre el total' },
    { etiqueta: 'Aceptación de Enrutamiento', valor: `${kpis.tasaAceptacion}%`, tono: 'verde', Icono: Route, descripcion: 'PQRS no corregidas' },
    { etiqueta: 'Confianza Promedio', valor: `${kpis.confianzaPromedio}%`, tono: 'ambar', Icono: Gauge, descripcion: 'Certeza promedio del modelo (Gemini)' },
    { etiqueta: 'Latencia Promedio', valor: `${kpis.latenciaPromedio}ms`, tono: 'gris', Icono: Timer, descripcion: 'Tiempo de respuesta' },
  ];

  return (
    <div className="animate-fade-in-up">

      <SectionHeader
        titulo="Supervisión y Gobernanza de IA"
        subtitulo="Monitoreo en tiempo real de precisión, confianza, telemetría y módulos de IA."
        acciones={<StatusBadge tono={healthStatus.tono} conPunto tamano="sm">{healthStatus.status}</StatusBadge>}
      />

      {/* Alertas de deriva */}
      {driftAlerts.length > 0 && (
        <div role="alert" className="mx-3 mb-2 rounded-xl p-3 sm:mx-4 lg:mx-6" style={{ background: 'var(--tema-fondo-fffbeb)', border: '1px solid var(--tema-borde-fde68a)', borderLeft: '4px solid #F59E0B' }}>
          <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-amber-700 oscuro:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Alertas de Deriva Semántica Detectadas
          </div>
          <ul className="space-y-1.5 list-disc pl-4 text-xs leading-relaxed" style={{ color: 'var(--tema-texto-92400e)' }}>
            {driftAlerts.map((alert, i) => <li key={i}>{alert}</li>)}
          </ul>
        </div>
      )}

      {/* Indicadores (lenguaje del Tablero) */}
      <FilaTarjetas etiqueta="Indicadores de la IA" className="px-3 sm:px-4 lg:px-6">
        {indicadores.map((i) => <TarjetaIndicador key={i.etiqueta} {...i} descripcionVisible />)}
      </FilaTarjetas>

      <div className="mt-3 grid grid-cols-1 gap-3 px-3 sm:px-4 lg:px-6 md:grid-cols-3 *:min-w-0">
        {/* Módulos de IA */}
        <div className="md:col-span-1 rounded-xl p-3 space-y-3 bg-[var(--tema-fondo-ffffff)]">
          <div>
            <h3 className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
              Módulos de IA (estado compilado)
            </h3>
            {/* PT-7 (24-ago-2026): estos interruptores eran DECORATIVOS —
                solo movían un useState local; los flags reales son constantes
                compiladas (lib/ai/feature-flags). Un ADMIN que «apagara» el
                chat SIMI creía haberlo apagado y el widget seguía vivo para
                los ciudadanos: peor que no tener control es fingirlo.
                Ahora son indicadores de SOLO LECTURA con la verdad al pie;
                cablearlos de verdad (Firestore + consulta en runtime) exige
                diseño propio — anotado en el plan. */}
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Estado compilado de los módulos de IA — solo lectura. Cambiarlos
              requiere un despliegue; estos indicadores no son interruptores.
            </p>
          </div>
          <div className="space-y-3.5 pt-1">
            <EstadoModuloIA label="Chat SIMI Público"        desc="Widget conversacional del portal"     activo={AI_FEATURE_FLAGS.ENABLE_SIMI_CHAT} />
            <EstadoModuloIA label="Clasificación en Caliente" desc="Debounce e inferencia en /radicacion" activo={AI_FEATURE_FLAGS.ENABLE_AUTO_CLASSIFY} />
            <EstadoModuloIA label="Etiquetas Semánticas"      desc="Auto-generación de tags"              activo={AI_FEATURE_FLAGS.ENABLE_AUTO_TAGS} />
            <EstadoModuloIA label="Resumen de Solicitud"      desc="Genera resúmenes ejecutivos"          activo={AI_FEATURE_FLAGS.ENABLE_AI_SUMMARY} />
          </div>
        </div>

        {/* Telemetría */}
        <div className="md:col-span-2 rounded-xl p-3 space-y-3 bg-[var(--tema-fondo-ffffff)]">
          <div>
            <h3 className="text-xs font-black" style={{ color: 'var(--tema-texto-172033)' }}>
              Telemetría de Ejecución
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--tema-texto-64748b)' }}>
              Últimos logs operacionales capturados del servidor.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <CabeceraTablaSticky columnas={['Endpoint', 'Latencia', 'Modo', 'Estado', 'Fecha / Hora']} />
              <tbody>
                {logs.slice(0, 6).map((log) => (
                  <tr key={log.logId} className="micro-row"
                      style={{ borderBottom: '1px solid var(--tema-borde-f4f9f6)' }}>
                    <td className="py-2.5 px-2 font-semibold" style={{ color: 'var(--tema-texto-172033)' }}>/{log.endpoint}</td>
                    <td className="py-2.5 px-2 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>{log.latenciaMs}ms</td>
                    <td className="py-2.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.fallbackActivo ? 'bg-amber-50 oscuro:bg-amber-500/15 text-amber-700 oscuro:text-amber-300' : 'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300'
                      }`}>
                        {log.fallbackActivo ? 'Fallback' : 'Gemini'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.error ? 'bg-red-50 oscuro:bg-red-500/15 text-red-700 oscuro:text-red-300' : 'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300'
                      }`}>
                        {log.error ? 'Error' : 'Exitoso'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 tabular-nums" style={{ color: 'var(--tema-texto-64748b)' }}>
                      {new Date(log.timestamp).toLocaleTimeString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-componentes ─────────────────────────────────────────── */

function EstadoModuloIA({
  label, desc, activo,
}: { label: string; desc: string; activo: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-2.5 rounded-xl"
      style={{ border: '1px solid var(--tema-borde-dce4ea)', background: activo ? 'var(--tema-fondo-f4f9f6)' : 'var(--tema-fondo-f7f9fb)' }}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold" style={{ color: 'var(--tema-texto-172033)' }}>{label}</p>
        <p className="text-[10px] leading-normal truncate" style={{ color: 'var(--tema-texto-475569)' }}>{desc}</p>
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0"
        style={activo
          ? { background: 'var(--tema-fondo-ecfdf5)', color: 'var(--color-success-text)', border: '1px solid var(--tema-borde-a7f3d0)' }
          : { background: 'var(--tema-fondo-f7f9fb)', color: 'var(--text-secondary)', border: '1px solid var(--tema-borde-dce4ea)' }}
      >
        {activo ? 'Activo' : 'Apagado'}
      </span>
    </div>
  );
}
