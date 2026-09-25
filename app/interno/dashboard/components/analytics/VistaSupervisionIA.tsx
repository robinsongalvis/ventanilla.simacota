'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { NOMBRES_TENANT } from '@/src/types/reglas-negocio';
import { AI_FEATURE_FLAGS } from '@/lib/ai-flags';

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
      return { status: '🟢 GEMINI ACTIVO', style: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' } };
    }
    const ultimos10 = logs.slice(0, 10);
    const errores = ultimos10.filter(l => l.error !== null).length;
    const latenciasAltas = ultimos10.filter(l => l.latenciaMs > 8000).length;
    const fallbacks = ultimos10.filter(l => l.fallbackActivo).length;
    if (errores >= 3 || latenciasAltas >= 3) {
      return { status: '🔴 IA DEGRADADA',       style: { background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' } };
    }
    if (fallbacks > 0) {
      return { status: '🟡 FALLBACK LOCAL ACTIVO', style: { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' } };
    }
    return { status: '🟢 GEMINI ACTIVO', style: { background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' } };
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
          alerts.push(`Desvío Crítico en Dependencia: La IA presenta alta tasa de corrección (${count} overrides) en ${nombreDep}, representando el ${ratio.toFixed(0)}% del total de fallos.`);
        }
      });
    }
    return alerts;
  }, [feedbacks, audits, kpis]);

  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in-up">

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight" style={{ fontFamily: 'var(--font-manrope)', color: '#1F2933' }}>
            Supervisión y Gobernanza de IA
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#667085' }}>
            Monitoreo en tiempo real, deriva de confianza, telemetría y feature flags.
          </p>
        </div>

        {/* Health badge */}
        <div className="px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2"
             style={healthStatus.style}>
          <span className="w-2.5 h-2.5 rounded-full bg-current shrink-0" />
          {healthStatus.status}
        </div>
      </div>

      {/* Alertas de deriva */}
      {driftAlerts.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div className="flex items-center gap-2 mb-2 font-bold text-xs uppercase tracking-wider text-amber-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            Alertas de Deriva Semántica Detectadas
          </div>
          <ul className="space-y-1.5 list-disc pl-4 text-xs leading-relaxed" style={{ color: '#92400E' }}>
            {driftAlerts.map((alert, i) => <li key={i}>{alert}</li>)}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Precisión Global IA"
          value={`${kpis.precisionGlobal}%`}
          desc="Ratio de votos 👍 vs ❌"
          valueStyle={{ color: '#14532D' }}
          iconStyle={{ background: '#EEF4EE', color: '#14532D' }}
        />
        <KpiCard
          label="Aceptación de Enrutamiento"
          value={`${kpis.tasaAceptacion}%`}
          desc="PQRS no corregidas"
          valueStyle={{ color: '#16A34A' }}
          iconStyle={{ background: '#F0FDF4', color: '#16A34A' }}
        />
        <KpiCard
          label="Confianza Promedio"
          value={`${kpis.confianzaPromedio}%`}
          desc="Score de certeza Gemini"
          valueStyle={{ color: '#D97706' }}
          iconStyle={{ background: '#FFFBEB', color: '#D97706' }}
        />
        <KpiCard
          label="Latencia Promedio"
          value={`${kpis.latenciaPromedio}ms`}
          desc="Tiempo de respuesta"
          valueStyle={{ color: '#667085' }}
          iconStyle={{ background: '#F8FAF7', color: '#94A3B8' }}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4 md:gap-6">
        {/* Feature Flags */}
        <div className="md:col-span-1 rounded-2xl p-4 md:p-5 space-y-4 bg-white"
             style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1F2933' }}>
              Feature Flags (Caliente)
            </h3>
            {/* PT-7 (24-ago-2026): estos interruptores eran DECORATIVOS —
                solo movían un useState local; los flags reales son constantes
                compiladas (lib/ai/feature-flags). Un ADMIN que «apagara» el
                chat SIMI creía haberlo apagado y el widget seguía vivo para
                los ciudadanos: peor que no tener control es fingirlo.
                Ahora son indicadores de SOLO LECTURA con la verdad al pie;
                cablearlos de verdad (Firestore + consulta en runtime) exige
                diseño propio — anotado en el plan. */}
            <p className="text-[10px] mt-0.5" style={{ color: '#667085' }}>
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
        <div className="md:col-span-2 rounded-2xl p-4 md:p-5 space-y-4 bg-white"
             style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#1F2933' }}>
              Telemetría de Ejecución
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
              Últimos logs operacionales capturados del servidor.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid #D9E2D9', background: '#EEF4EE' }}>
                  {['Endpoint','Latencia','Modo','Estado','Fecha / Hora'].map(h => (
                    <th key={h} className="pb-2 pt-2 px-2 font-bold uppercase tracking-wider"
                        style={{ color: '#14532D' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 6).map((log) => (
                  <tr key={log.logId} className="transition-colors"
                      style={{ borderBottom: '1px solid #EEF4EE' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAF7'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                    <td className="py-2.5 px-2 font-semibold" style={{ color: '#1F2933' }}>/{log.endpoint}</td>
                    <td className="py-2.5 px-2 tabular-nums" style={{ color: '#667085' }}>{log.latenciaMs}ms</td>
                    <td className="py-2.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.fallbackActivo ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {log.fallbackActivo ? 'Fallback' : 'Gemini'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {log.error ? 'Error' : 'Exitoso'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 tabular-nums" style={{ color: '#94A3B8' }}>
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

function KpiCard({
  label, value, desc, valueStyle, iconStyle,
}: {
  label: string; value: string; desc: string;
  valueStyle: React.CSSProperties; iconStyle: React.CSSProperties;
}) {
  return (
    <div className="rounded-2xl p-4 min-w-0 bg-white"
         style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-lg" style={iconStyle}>
        ✦
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-2xl font-black mt-1.5 tracking-tight break-words"
         style={{ fontFamily: 'var(--font-manrope)', ...valueStyle }}>
        {value}
      </p>
      <p className="text-[9px] mt-1 leading-relaxed" style={{ color: '#94A3B8' }}>{desc}</p>
    </div>
  );
}

function EstadoModuloIA({
  label, desc, activo,
}: { label: string; desc: string; activo: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-2.5 rounded-xl"
      style={{ border: '1px solid #D9E2D9', background: activo ? '#EEF4EE' : '#F8FAF7' }}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold" style={{ color: '#1F2933' }}>{label}</p>
        <p className="text-[9px] leading-normal truncate" style={{ color: '#667085' }}>{desc}</p>
      </div>
      <span
        className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0"
        style={activo
          ? { background: '#ECFDF5', color: 'var(--color-success-text)', border: '1px solid #A7F3D0' }
          : { background: '#F8FAF7', color: 'var(--text-secondary)', border: '1px solid #D9E2D9' }}
      >
        {activo ? 'Activo' : 'Apagado'}
      </span>
    </div>
  );
}
