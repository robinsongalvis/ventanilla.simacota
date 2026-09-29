'use client';

/**
 * VistaAlertas.tsx — Panel de Alertas Predictivas
 *
 * Lista priorizada de radicados en riesgo, ordenada por severidad.
 *
 * ALCANCE (corrección funcional, 23-sep-2026). La vista y el contador del
 * menú cuentan sobre el MISMO universo: los radicados que el rol ve
 * (el stream ya acotado por rol y por el selector de dependencia), con el
 * mismo alcance que la bandeja (`alcanceMunicipal` = ADMIN, CONTROL_INTERNO
 * y RECEPCIONISTA). Antes la vista usaba `esAdmin` y una ventana de 30 días
 * por fecha de radicación, mientras el contador contaba todo el alcance
 * municipal: Recepción veía un número en el menú y otra lista al entrar, y
 * los vencidos más antiguos (radicados hace más de 30 días) desaparecían de
 * la vista aunque el contador los incluyera.
 */

import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { TenantId }           from '@/src/types/radicado';
import { calcularAlertasPredictivas, type AlertaPredictiva } from './useAnalytics';
import { NOMBRES_TENANT }          from '@/src/types/reglas-negocio';
import { nombreSolicitanteVisible } from '@/lib/seguridad/identidad-protegida';
import { useMemo }                  from 'react';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { AlertTriangle, Clock3, Eye, ShieldCheck, type LucideIcon } from 'lucide-react';


/* ══════════════════════════════════════════════════════════════
   PROPS
══════════════════════════════════════════════════════════════ */

interface Props {
  /** El stream que el rol ve (ya acotado por rol y por el selector de dependencia). */
  radicados:       VentanillaRadicado[];
  /** Mismo alcance que la bandeja: ADMIN, CONTROL_INTERNO y RECEPCIONISTA. */
  alcanceMunicipal: boolean;
  tenantIdUsuario: TenantId;
  /** Dependencia elegida en el selector del Tablero (solo alcance municipal). */
  dependenciaFiltrada?: TenantId;
  onVerRadicado:   (r: VentanillaRadicado) => void;
}

/** Alcance de las alertas: el mismo para la vista y para el contador del menú. */
export function alcanceAlertas(alcanceMunicipal: boolean, tenantIdUsuario: TenantId): TenantId | 'TODOS' {
  return alcanceMunicipal ? 'TODOS' : tenantIdUsuario;
}

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN VISUAL — Ola 3 (ADR-0046): insignias del sistema de
   diseño y tokens de tema. La barra de severidad conserva sus colores de
   identidad (ADR-0045 §2): se lee igual en claro y en oscuro.
══════════════════════════════════════════════════════════════ */

type TonoNivel = 'danger' | 'warning' | 'accent';

const CONFIG_NIVEL: Record<AlertaPredictiva['nivel'], {
  label: string;
  tono: TonoNivel;
  Icono: LucideIcon;
  punto: string;
  card: React.CSSProperties;
  barColor: string;
  /** Texto del plazo sobre la tarjeta tintada (AA en claro y oscuro). */
  textoPlazo: string;
}> = {
  CRITICO: {
    label:      'Crítico',
    tono:       'danger',
    Icono:      AlertTriangle,
    punto:      'var(--tema-texto-d81e1e)',
    card:       { background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)' },
    barColor:   '#D81E1E',
    textoPlazo: 'var(--tema-texto-b91c1c)',
  },
  URGENTE: {
    label:      'Urgente',
    tono:       'warning',
    Icono:      Clock3,
    punto:      'var(--tema-texto-d97706)',
    card:       { background: 'var(--tema-fondo-fff7ed)', border: '1px solid var(--tema-borde-fed7aa)' },
    barColor:   '#EA580C',
    textoPlazo: 'var(--tema-texto-9a3412)',
  },
  ATENCION: {
    label:      'Atención',
    tono:       'accent',
    Icono:      Eye,
    punto:      'var(--tema-texto-e5a31a)',
    card:       { background: 'var(--tema-fondo-fffbeb)', border: '1px solid var(--tema-borde-fde68a)' },
    barColor:   '#D97706',
    textoPlazo: 'var(--tema-texto-854d0e)',
  },
};

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

  const diasHabiles = (n: number) => `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;
  const diasLabel = alerta.diasRestantes < 0
    ? `Vencido hace ${diasHabiles(Math.abs(alerta.diasRestantes))}`
    : alerta.diasRestantes === 0
      ? 'Vence hoy'
      : `Vence en ${diasHabiles(alerta.diasRestantes)}`;

  return (
    <div className="rounded-xl px-3.5 py-3 flex flex-col gap-2.5 bg-[var(--tema-fondo-ffffff)]"
         style={cfg.card}>
      {/* Fila 1: nivel + radicadoId + severidad */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusBadge tono={cfg.tono} conPunto>
            <cfg.Icono size={12} strokeWidth={2.5} aria-hidden="true" />
            {cfg.label}
          </StatusBadge>
          <span className="font-mono text-xs font-bold" style={{ color: 'var(--tema-texto-007049)' }}>{r.radicadoId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--tema-texto-475569)' }}>Severidad {alerta.severityScore}</span>
          {r.prioridad === 'ROJO' && (
            <StatusBadge tono="danger" tamano="sm">MIPG</StatusBadge>
          )}
        </div>
      </div>

      {/* Barra de severidad */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tema-fondo-f4f9f6)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700"
             style={{ width: `${pct}%`, background: cfg.barColor }} />
      </div>

      {/* Fila 2: solicitante + dependencia */}
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--tema-texto-172033)' }}>{nombreSolicitanteVisible(r, r.solicitante.nombreCompleto)}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--tema-texto-475569)' }}>
            {NOMBRES_TENANT[r.clasificacion.oficinaDestino]} · {r.termino.tipoSolicitudNombre}
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <p className="text-xs font-bold tabular-nums" style={{ color: cfg.textoPlazo }}>
            {diasLabel}
          </p>
          {alerta.diasSinMovimiento > 3 && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--tema-texto-475569)' }}>
              {alerta.diasSinMovimiento}d sin movimiento
            </p>
          )}
        </div>
      </div>

      {/* Acción */}
      <div className="flex justify-end">
        <BotonAccion Icono={Eye} onClick={() => onVerRadicado(r)}>Ver radicado</BotonAccion>
      </div>
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
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: cfg.punto }} />
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tema-texto-475569)' }}>{cfg.label}</h3>
        <StatusBadge tono={cfg.tono}>{alertas.length}</StatusBadge>
      </div>
      <div className="grid gap-2.5 lg:grid-cols-2">
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

export function VistaAlertas({ radicados, alcanceMunicipal, tenantIdUsuario, dependenciaFiltrada, onVerRadicado }: Props) {
  const alertas = useMemo(
    () => calcularAlertasPredictivas(radicados, alcanceAlertas(alcanceMunicipal, tenantIdUsuario)),
    [radicados, alcanceMunicipal, tenantIdUsuario],
  );
  const dependenciaVisible = alcanceMunicipal ? dependenciaFiltrada : tenantIdUsuario;

  const { criticos, urgentes, atencion, maxScore, total } = useMemo(() => ({
    criticos:  alertas.filter((a) => a.nivel === 'CRITICO'),
    urgentes:  alertas.filter((a) => a.nivel === 'URGENTE'),
    atencion:  alertas.filter((a) => a.nivel === 'ATENCION'),
    maxScore:  alertas[0]?.severityScore ?? 1,
    total:     alertas.length,
  }), [alertas]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      {/* Subencabezado del Tablero (ADR-0045): el título de pantalla ya
          está en el encabezado común; aquí van alcance y contadores. */}
      <SectionHeader
        titulo="Panel de alertas predictivas"
        subtitulo={`${dependenciaVisible ? `Solo ${NOMBRES_TENANT[dependenciaVisible]}` : 'Vista global'} · Ordenado por severidad`}
        acciones={total > 0 ? (
          <>
            {criticos.length > 0 && (
              <StatusBadge tono="danger" tamano="lg" conPunto>
                {criticos.length} crítico{criticos.length !== 1 ? 's' : ''}
              </StatusBadge>
            )}
            {urgentes.length > 0 && (
              <StatusBadge tono="warning" tamano="lg">
                {urgentes.length} urgente{urgentes.length !== 1 ? 's' : ''}
              </StatusBadge>
            )}
          </>
        ) : undefined}
      />

      {/* Sin alertas */}
      {total === 0 && (
        <EmptyState
          icono={<ShieldCheck className="w-6 h-6" style={{ color: 'var(--tema-texto-007049)' }} strokeWidth={1.8} aria-hidden="true" />}
          titulo="Sin alertas activas"
          descripcion="Todos los radicados están dentro del término legal"
        />
      )}

      {/* Lista de alertas */}
      {total > 0 && (
        <div className="px-4 pt-2 pb-4 space-y-5 md:px-6">
          <GrupoAlertas nivel="CRITICO"  alertas={criticos} onVerRadicado={onVerRadicado} maxScore={maxScore} />
          <GrupoAlertas nivel="URGENTE"  alertas={urgentes} onVerRadicado={onVerRadicado} maxScore={maxScore} />
          <GrupoAlertas nivel="ATENCION" alertas={atencion} onVerRadicado={onVerRadicado} maxScore={maxScore} />
          {/* §4.4 de la matriz Ola 3: la fórmula en lenguaje llano y legible
              (antes, jerga técnica en un gris sin contraste). */}
          <p className="text-[10px] pb-2" style={{ color: 'var(--tema-texto-64748b)' }}>
            Severidad = días vencidos × 5 + días sin movimiento × 3 + 2 si la prioridad MIPG es roja.
          </p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HELPER EXPORTADO — Contador del menú lateral
══════════════════════════════════════════════════════════════ */

/**
 * Críticas + urgentes: exactamente los dos contadores del encabezado de la
 * vista, con la misma función (`calcularAlertasPredictivas`) y el mismo
 * alcance (`alcanceAlertas`). Recibe el mismo stream que la vista.
 */
export function contarAlertasActivas(
  radicados:        VentanillaRadicado[],
  alcanceMunicipal: boolean,
  tenantIdUsuario:  TenantId,
): number {
  return calcularAlertasPredictivas(radicados, alcanceAlertas(alcanceMunicipal, tenantIdUsuario))
    .filter((a) => a.nivel !== 'ATENCION')
    .length;
}
