'use client';

/**
 * VistaAlertas.tsx — Panel de Alertas Predictivas
 *
 * Lista priorizada de radicados en riesgo, ordenada por severityScore.
 * ADMIN ve todas las alertas; funcionarios solo ven las de su tenantId.
 */

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId }           from '@/src/types/radicado';
import { useAnalytics, type AlertaPredictiva, type PeriodoAnalytics } from './useAnalytics';
import { NOMBRES_TENANT }          from '@/src/types/reglas-negocio';
import { diasRestantesHabiles }    from '@/lib/tiempos-radicado';
import { useMemo, useState }        from 'react';


/* ══════════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════════ */

interface Props {
  radicados:       VentanillaRadicado[];
  esAdmin:         boolean;
  tenantIdUsuario: TenantId;
  onVerRadicado:   (r: VentanillaRadicado) => void;
}

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN VISUAL (light theme)
══════════════════════════════════════════════════════════════ */

const CONFIG_NIVEL = {
  CRITICO: {
    label:    'Crítico',
    dot:      'bg-red-500',
    badge:    'bg-red-50 text-red-700 border-red-200',
    card:     { background: '#FEF2F2', border: '1px solid #FECACA' },
    barColor: '#DC2626',
    icono: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  URGENTE: {
    label:    'Urgente',
    dot:      'bg-orange-500',
    badge:    'bg-orange-50 text-orange-700 border-orange-200',
    card:     { background: '#FFF7ED', border: '1px solid #FED7AA' },
    barColor: '#EA580C',
    icono: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  ATENCION: {
    label:    'Atención',
    dot:      'bg-yellow-500',
    badge:    'bg-yellow-50 text-yellow-700 border-yellow-200',
    card:     { background: '#FFFBEB', border: '1px solid #FDE68A' },
    barColor: '#D97706',
    icono: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      </svg>
    ),
  },
} as const;

function TarjetaAlerta({
  alerta,
  onVerRadicado,
  maxScore,
}: {
  alerta:        AlertaPredictiva;
  onVerRadicado: (r: VentanillaRadicado) => void;
  maxScore:      number;
}) {
  const cfg  = CONFIG_NIVEL[alerta.nivel];
  const pct  = maxScore > 0 ? Math.round((alerta.severityScore / maxScore) * 100) : 0;
  const r    = alerta.radicado;

  const diasLabel = alerta.diasRestantes < 0
    ? `Vencido hace ${Math.abs(alerta.diasRestantes)} día${Math.abs(alerta.diasRestantes) !== 1 ? 's' : ''} hábiles`
    : alerta.diasRestantes === 0
      ? 'Vence hoy'
      : `Vence en ${alerta.diasRestantes} día${alerta.diasRestantes !== 1 ? 's' : ''} hábiles`;

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 bg-white"
         style={cfg.card}>
      {/* Fila 1: nivel + radicadoId + score */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0 animate-pulse`} />
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badge}`}>
            {cfg.icono}
            {cfg.label}
          </span>
          <span className="font-mono text-xs font-bold" style={{ color: '#14532D' }}>{r.radicadoId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] tabular-nums" style={{ color: '#94A3B8' }}>score {alerta.severityScore}</span>
          {r.prioridad === 'ROJO' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-black uppercase tracking-wider">
              MIPG
            </span>
          )}
        </div>
      </div>

      {/* Barra de severidad */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#EEF4EE' }}>
        <div className="h-1.5 rounded-full transition-all duration-700"
             style={{ width: `${pct}%`, background: cfg.barColor }} />
      </div>

      {/* Fila 2: solicitante + dependencia */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#1F2933' }}>{r.solicitante.nombreCompleto}</p>
          <p className="text-[10px] mt-0.5" style={{ color: '#667085' }}>
            {NOMBRES_TENANT[r.clasificacion.oficinaDestino]} · {r.termino.tipoSolicitudNombre}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xs font-bold tabular-nums ${
            alerta.diasRestantes < 0 ? 'text-red-600' : alerta.diasRestantes <= 2 ? 'text-orange-600' : 'text-yellow-600'
          }`}>
            {diasLabel}
          </p>
          {alerta.diasSinMovimiento > 3 && (
            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
              {alerta.diasSinMovimiento}d sin movimiento
            </p>
          )}
        </div>
      </div>

      {/* Acción */}
      <button onClick={() => onVerRadicado(r)}
        className="self-end flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95"
        style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#D9E2D9'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4EE'; }}>
        Ver radicado
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </button>
    </div>
  );
}

function GrupoAlertas({
  nivel,
  alertas,
  onVerRadicado,
  maxScore,
}: {
  nivel:         AlertaPredictiva['nivel'];
  alertas:       AlertaPredictiva[];
  onVerRadicado: (r: VentanillaRadicado) => void;
  maxScore:      number;
}) {
  if (alertas.length === 0) return null;
  const cfg = CONFIG_NIVEL[nivel];
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#667085' }}>{cfg.label}</h3>
        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${cfg.badge}`}>
          {alertas.length}
        </span>
      </div>
      <div className="space-y-3">
        {alertas.map((a) => (
          <TarjetaAlerta key={a.radicado.radicadoId} alerta={a} onVerRadicado={onVerRadicado} maxScore={maxScore} />
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

export function VistaAlertas({ radicados, esAdmin, tenantIdUsuario, onVerRadicado }: Props) {
  const [periodo] = useState<PeriodoAnalytics>(30);
  const { alertas } = useAnalytics(
    radicados,
    periodo,
    esAdmin ? 'TODOS' : tenantIdUsuario,
  );

  const { criticos, urgentes, atencion, maxScore, total } = useMemo(() => ({
    criticos:  alertas.filter((a) => a.nivel === 'CRITICO'),
    urgentes:  alertas.filter((a) => a.nivel === 'URGENTE'),
    atencion:  alertas.filter((a) => a.nivel === 'ATENCION'),
    maxScore:  alertas[0]?.severityScore ?? 1,
    total:     alertas.length,
  }), [alertas]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAF7' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between shrink-0 bg-white"
           style={{ borderBottom: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
        <div>
          <h2 className="text-sm font-bold" style={{ color: '#1F2933' }}>Panel de Alertas Predictivas</h2>
          <p className="text-[11px] mt-0.5" style={{ color: '#667085' }}>
            {esAdmin ? 'Vista global' : `Solo ${NOMBRES_TENANT[tenantIdUsuario]}`}
            {' · '}Ordenado por severityScore
          </p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2">
            {criticos.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {criticos.length} crítico{criticos.length !== 1 ? 's' : ''}
              </span>
            )}
            {urgentes.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-bold">
                {urgentes.length} urgente{urgentes.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Sin alertas */}
      {total === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
               style={{ background: '#EEF4EE', border: '1px solid #D9E2D9' }}>
            <svg className="w-7 h-7" style={{ color: '#14532D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-semibold" style={{ color: '#1F2933' }}>Sin alertas activas</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Todos los radicados están dentro del término legal</p>
          </div>
        </div>
      )}

      {/* Lista de alertas */}
      {total > 0 && (
        <div className="p-6 space-y-8 max-w-3xl mx-auto">
          <GrupoAlertas nivel="CRITICO"  alertas={criticos} onVerRadicado={onVerRadicado} maxScore={maxScore} />
          <GrupoAlertas nivel="URGENTE"  alertas={urgentes} onVerRadicado={onVerRadicado} maxScore={maxScore} />
          <GrupoAlertas nivel="ATENCION" alertas={atencion} onVerRadicado={onVerRadicado} maxScore={maxScore} />
          <p className="text-[10px] text-center pb-2" style={{ color: '#D9E2D9' }}>
            severityScore = vencido×5 + sinMovimiento×3 + prioridadRojo×2 · Fase 3 predictiva ready
          </p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HELPER EXPORTADO — Badge count para el sidebar
══════════════════════════════════════════════════════════════ */

const ESTADOS_ACTIVOS_BADGE = new Set([
  'PENDIENTE','EN_REVISION','EN_PROCESO','ASIGNADO','DEVUELTO','PRORROGA',
]);

export function contarAlertasActivas(
  radicados:       VentanillaRadicado[],
  esAdmin:         boolean,
  tenantIdUsuario: TenantId,
): number {
  const activos = radicados.filter((r) => ESTADOS_ACTIVOS_BADGE.has(r.estadoActual));
  const filtrados = esAdmin
    ? activos
    : activos.filter((r) => r.clasificacion.oficinaDestino === tenantIdUsuario);

  return filtrados.filter((r) =>
    diasRestantesHabiles(r.termino.fechaVencimiento) <= 2
  ).length;
}
