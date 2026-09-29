'use client';

/**
 * JefeAprobacionesPanel — Cola de aprobaciones para Jefe de Dependencia y Admin.
 * Vista operativa diaria: ver, aprobar, devolver o escalar casos pendientes.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ApprovalFlow, ApprovalStatus } from '@/src/types/simi-approval';
import { APPROVAL_STATUS_LABELS } from '@/src/types/simi-approval';
import { LegalRiskBadge } from './LegalRiskBadge';
import { SectionHeader } from '@/app/components/design-system/SectionHeader';
import { StatusBadge } from '@/app/components/design-system/StatusBadge';
import { EmptyState } from '@/app/components/design-system/EmptyState';
import { BotonAccion } from '@/app/components/design-system/BotonAccion';
import { type IndicadorEstaticoProps } from '@/app/components/design-system/Indicador';
import { FilaTarjetas, TarjetaIndicador } from '@/app/components/design-system/TarjetaIndicador';
import { AlertTriangle, Check, CheckCircle2, Download, Gavel, RefreshCw, Send, ShieldAlert, Undo2, UserCheck } from 'lucide-react';

/* Ola 3 (ADR-0046): lenguaje del Tablero. Las reglas de quién aprueba,
   escala o devuelve en cada estado NO cambian (son del flujo). */

/**
 * Estado del flujo con el `StatusBadge` del sistema. Mismo matiz por estado
 * que antes (APPROVAL_STATUS_COLOR), ahora también en tema oscuro.
 */
const TONO_ESTADO: Record<ApprovalStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'> = {
  borrador_generado:           'neutral',
  pendiente_revision_jefe:     'accent',
  pendiente_revision_juridica: 'danger',
  devuelto_para_ajustes:       'warning',
  aprobado_por_jefe:           'info',
  aprobado_por_juridica:       'success',
  listo_para_envio:            'success',
  enviado:                     'success',
};

function EstadoAprobacion({ estado }: { estado: ApprovalStatus }) {
  return <StatusBadge tono={TONO_ESTADO[estado] ?? 'neutral'} tamano="sm">{APPROVAL_STATUS_LABELS[estado] ?? estado}</StatusBadge>;
}

function Stats({ stats }: { stats: Record<string, number> }) {
  const items: IndicadorEstaticoProps[] = [
    { etiqueta: 'Pendientes jefe',     valor: stats.pendientesJefe ?? '—',     tono: 'ambar', Icono: UserCheck },
    { etiqueta: 'Pendientes jurídica', valor: stats.pendientesJuridica ?? '—', tono: 'rojo',  Icono: Gavel },
    { etiqueta: 'Devueltos',           valor: stats.devueltos ?? '—',          tono: 'ambar', Icono: Undo2 },
    { etiqueta: 'Aprobados',           valor: stats.aprobados ?? '—',          tono: 'verde', Icono: CheckCircle2 },
    { etiqueta: 'Riesgo alto',         valor: stats.riesgoAlto ?? '—',         tono: 'rojo',  Icono: AlertTriangle },
  ];
  return (
    <FilaTarjetas etiqueta="Resumen de aprobaciones">
      {items.map((i) => <TarjetaIndicador key={i.etiqueta} {...i} />)}
    </FilaTarjetas>
  );
}

const CLASE_ENLACE_CSV = 'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold hover:bg-[var(--tema-fondo-f4f9f6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30';
const ESTILO_ENLACE_CSV = { background: 'var(--tema-fondo-ffffff)', color: 'var(--tema-texto-007049)', borderColor: 'var(--tema-borde-007049)' } as const;

type Accion = 'aprobar' | 'devolver' | 'escalar_juridica' | 'marcar_listo_para_envio';

/* ══════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════════ */

interface JefeAprobacionesPanelProps {
  usuarioRol: string;
}

export function JefeAprobacionesPanel({ usuarioRol }: JefeAprobacionesPanelProps) {
  const [aprobaciones, setAprobaciones] = useState<(ApprovalFlow & { id: string })[]>([]);
  const [stats,        setStats]        = useState<Record<string, number>>({});
  const [cargando,     setCargando]     = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [exito,        setExito]        = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroRiesgo, setFiltroRiesgo] = useState<string>('');
  const [accionando,   setAccionando]   = useState<string | null>(null);
  const [motiDev,      setMotiDev]      = useState<Record<string, string>>({});
  const [showDev,      setShowDev]      = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    setCargando(true); setError(null);
    try {
      const params = new URLSearchParams({ limite: '50' });
      if (filtroEstado) params.set('estado', filtroEstado);
      if (filtroRiesgo) params.set('riesgo', filtroRiesgo);

      const res  = await fetch(`/api/simi/juridico/aprobaciones?${params}`);
      const data = await res.json() as { aprobaciones?: (ApprovalFlow & { id: string })[]; stats?: Record<string, number>; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar');
      setAprobaciones(data.aprobaciones ?? []);
      setStats(data.stats ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, filtroRiesgo]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function ejecutarAccion(approvalId: string, accion: Accion, observacion?: string) {
    setAccionando(approvalId); setError(null); setExito(null);
    try {
      const res = await fetch(`/api/simi/juridico/aprobacion/${approvalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, observacion }),
      });
      const data = await res.json() as { ok?: boolean; mensaje?: string; error?: string; bloqueado?: string[] };
      if (!res.ok) {
        const msg = data.bloqueado?.length
          ? `No se puede completar: ${data.bloqueado[0]}`
          : (data.error ?? 'Error al ejecutar acción');
        throw new Error(msg);
      }
      setExito(data.mensaje ?? 'Acción completada.');
      setShowDev((p) => ({ ...p, [approvalId]: false }));
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar acción');
    } finally {
      setAccionando(null);
    }
  }

  const FILTROS_ESTADO: { value: string; label: string }[] = [
    { value: '',                          label: 'Todos los estados' },
    { value: 'pendiente_revision_jefe',   label: 'Pendientes — Jefe' },
    { value: 'pendiente_revision_juridica', label: 'Pendientes — Jurídica' },
    { value: 'devuelto_para_ajustes',     label: 'Devueltos' },
    { value: 'aprobado_por_jefe',         label: 'Aprobados — Jefe' },
    { value: 'aprobado_por_juridica',     label: 'Aprobados — Jurídica' },
    { value: 'listo_para_envio',          label: 'Listos para envío' },
  ];

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--tema-fondo-f7f9fb)' }}>
      <SectionHeader
        titulo="Cola de Aprobaciones"
        subtitulo="SIMI Jurídico · Revise, apruebe o devuelva borradores antes de su envío al ciudadano."
        nota={usuarioRol === 'CONTROL_INTERNO'
          ? 'Consulta de solo lectura: aprobar, devolver o escalar corresponde al jefe de dependencia o al administrador.'
          : undefined}
      />

      <div className="px-3 pb-6 space-y-3 sm:px-4 lg:px-6">
        {/* Indicadores */}
        {!cargando && <Stats stats={stats} />}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            aria-label="Filtrar por estado"
            className="select-internal text-xs">
            {FILTROS_ESTADO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={filtroRiesgo} onChange={(e) => setFiltroRiesgo(e.target.value)}
            aria-label="Filtrar por riesgo"
            className="select-internal text-xs">
            <option value="">Todos los riesgos</option>
            <option value="bajo">Riesgo bajo</option>
            <option value="medio">Riesgo medio</option>
            <option value="alto">Riesgo alto</option>
          </select>
          <BotonAccion Icono={RefreshCw} onClick={cargar}>Actualizar</BotonAccion>

          {/* Exportar CSV */}
          <a href="/api/simi/reportes?tipo=aprobaciones" className={CLASE_ENLACE_CSV} style={ESTILO_ENLACE_CSV}>
            <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Exportar CSV
          </a>
        </div>

        {/* Mensajes */}
        {error && <div role="alert" className="rounded-lg p-3 text-xs" style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-991b1b)' }}>{error}</div>}
        {exito && <div role="status" className="rounded-lg p-3 text-xs" style={{ background: 'var(--tema-fondo-f0fdf4)', border: '1px solid var(--tema-borde-bbf7d0)', color: 'var(--tema-texto-006b45)' }}>{exito}</div>}

        {/* Loading */}
        {cargando ? (
          <div role="status" className="flex items-center gap-3 py-8 justify-center" style={{ color: 'var(--tema-texto-64748b)' }}>
            <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }} aria-hidden="true" />
            Cargando aprobaciones...
          </div>
        ) : aprobaciones.length === 0 ? (
          <div className="rounded-xl bg-[var(--tema-fondo-ffffff)]">
            <EmptyState
              icono={<CheckCircle2 className="h-6 w-6" strokeWidth={1.9} style={{ color: 'var(--tema-texto-007049)' }} aria-hidden="true" />}
              titulo="Sin casos pendientes"
              descripcion={filtroEstado || filtroRiesgo ? 'No hay casos con los filtros aplicados.' : 'Todos los borradores han sido procesados.'}
            />
          </div>
        ) : (
          /* Tabla de aprobaciones */
          <div className="space-y-3">
            {aprobaciones.map((a) => {
              const puedeAprobar =
                (usuarioRol === 'JEFE_DEPENDENCIA' && a.estado === 'pendiente_revision_jefe') ||
                (usuarioRol === 'ADMIN' && ['pendiente_revision_jefe', 'pendiente_revision_juridica'].includes(a.estado));
              const puedeEscalar = a.estado === 'pendiente_revision_jefe' && ['JEFE_DEPENDENCIA', 'ADMIN'].includes(usuarioRol);
              const puedeListoEnvio = (usuarioRol === 'ADMIN') && ['aprobado_por_jefe', 'aprobado_por_juridica'].includes(a.estado);
              const estaCargando = accionando === a.id;

              return (
                <div key={a.id} className="rounded-xl bg-[var(--tema-fondo-ffffff)] p-3 space-y-3">
                  {/* Cabecera de la card */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-mono text-xs font-bold" style={{ color: 'var(--tema-texto-007049)' }}>{a.radicadoId}</p>
                        <EstadoAprobacion estado={a.estado} />
                        <LegalRiskBadge nivel={a.nivelRiesgo} size="sm" />
                      </div>
                      {a.motivoRevision?.length > 0 && (
                        <p className="text-[10px] leading-snug" style={{ color: 'var(--tema-texto-64748b)' }}>
                          {a.motivoRevision[0]}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] shrink-0" style={{ color: 'var(--tema-texto-64748b)' }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                    </p>
                  </div>

                  {/* Historial compacto */}
                  {a.historial?.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                      {a.historial.slice(-3).map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5 shrink-0">
                          {i > 0 && <span style={{ color: 'var(--tema-texto-64748b)' }} aria-hidden="true">→</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--tema-fondo-f4f9f6)', color: 'var(--tema-texto-007049)' }}>
                            {h.rol} · {h.estado.replace(/_/g, ' ').slice(0, 20)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Acciones */}
                  {(puedeAprobar || puedeEscalar || puedeListoEnvio) && (
                    <div className="pt-3 space-y-2" style={{ borderTop: '1px solid var(--tema-borde-f4f9f6)' }}>
                      <div className="flex flex-wrap gap-2">
                        {puedeAprobar && (
                          <BotonAccion variante="primaria" Icono={Check} onClick={() => ejecutarAccion(a.id, 'aprobar')} disabled={estaCargando} aria-busy={estaCargando}>
                            {estaCargando ? '...' : 'Aprobar'}
                          </BotonAccion>
                        )}

                        {puedeListoEnvio && (
                          <BotonAccion variante="primaria" Icono={Send} onClick={() => ejecutarAccion(a.id, 'marcar_listo_para_envio')} disabled={estaCargando} aria-busy={estaCargando}>
                            {estaCargando ? '...' : 'Listo para envío'}
                          </BotonAccion>
                        )}

                        {puedeEscalar && (
                          <button
                            type="button"
                            onClick={() => ejecutarAccion(a.id, 'escalar_juridica')}
                            disabled={estaCargando}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/30"
                            style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)', color: 'var(--tema-texto-b91c1c)' }}>
                            <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                            Escalar
                          </button>
                        )}

                        {puedeAprobar && (
                          <BotonAccion Icono={Undo2} onClick={() => setShowDev((p) => ({ ...p, [a.id]: !p[a.id] }))} aria-expanded={!!showDev[a.id]}>
                            Devolver
                          </BotonAccion>
                        )}
                      </div>

                      {/* Forma de devolución */}
                      {showDev[a.id] && (
                        <div className="space-y-2">
                          <textarea
                            value={motiDev[a.id] ?? ''}
                            onChange={(e) => setMotiDev((p) => ({ ...p, [a.id]: e.target.value }))}
                            rows={2}
                            placeholder="Motivo de la devolución (se notificará al funcionario)..."
                            aria-label={`Motivo de la devolución de ${a.radicadoId}`}
                            className="input-internal resize-none w-full text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => ejecutarAccion(a.id, 'devolver', motiDev[a.id])}
                            disabled={!motiDev[a.id]?.trim() || estaCargando}
                            className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/40"
                            style={{ background: '#B45309', color: '#fff' }}>
                            Confirmar devolución
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reportes rápidos */}
        <div className="pt-3" style={{ borderTop: '1px solid var(--tema-borde-dce4ea)' }}>
          <p className="text-xs font-black mb-2" style={{ color: 'var(--tema-texto-172033)' }}>Exportar reportes</p>
          <div className="flex flex-wrap gap-2">
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
      </div>
    </div>
  );
}
