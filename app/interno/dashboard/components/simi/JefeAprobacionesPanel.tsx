'use client';

/**
 * JefeAprobacionesPanel — Cola de aprobaciones para Jefe de Dependencia y Admin.
 * Vista operativa diaria: ver, aprobar, devolver o escalar casos pendientes.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ApprovalFlow, ApprovalStatus } from '@/src/types/simi-approval';
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLOR } from '@/src/types/simi-approval';
import { LegalRiskBadge } from './LegalRiskBadge';

/* ── Sub-componentes ── */

function StatusBadge({ estado }: { estado: ApprovalStatus }) {
  const cls = APPROVAL_STATUS_COLOR[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {APPROVAL_STATUS_LABELS[estado] ?? estado}
    </span>
  );
}

function Stats({ stats }: { stats: Record<string, number> }) {
  const items = [
    { label: 'Pendientes jefe',     valor: stats.pendientesJefe,     color: '#D97706' },
    { label: 'Pendientes jurídica', valor: stats.pendientesJuridica,  color: '#DC2626' },
    { label: 'Devueltos',           valor: stats.devueltos,           color: '#EA580C' },
    { label: 'Aprobados',           valor: stats.aprobados,           color: '#14532D' },
    { label: 'Riesgo alto',         valor: stats.riesgoAlto,          color: '#DC2626' },
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {items.map(({ label, valor, color }) => (
        <div key={label} className="rounded-lg p-2.5 bg-white text-center"
             style={{ border: '1px solid #D9E2D9' }}>
          <p className="text-xl font-black tabular-nums" style={{ color }}>{valor}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: '#94A3B8' }}>{label}</p>
        </div>
      ))}
    </div>
  );
}

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
    <div className="flex-1 overflow-y-auto" style={{ background: '#F8FAF7' }}>
      {/* Header */}
      <div className="px-5 py-4 bg-white" style={{ borderBottom: '1px solid #D9E2D9' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>SIMI Jurídico</p>
        <h2 className="text-lg font-black" style={{ color: '#1F2933', fontFamily: 'var(--font-manrope)' }}>
          Cola de Aprobaciones
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#667085' }}>
          Revise, apruebe o devuelva borradores antes de su envío al ciudadano.
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Stats */}
        {!cargando && <Stats stats={stats} />}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
            className="select-internal text-xs">
            {FILTROS_ESTADO.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <select value={filtroRiesgo} onChange={(e) => setFiltroRiesgo(e.target.value)}
            className="select-internal text-xs">
            <option value="">Todos los riesgos</option>
            <option value="bajo">Riesgo bajo</option>
            <option value="medio">Riesgo medio</option>
            <option value="alto">Riesgo alto</option>
          </select>
          <button onClick={cargar}
            className="px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}>
            🔄 Actualizar
          </button>

          {/* Exportar CSV */}
          <a href="/api/simi/reportes?tipo=aprobaciones"
             className="px-3 py-1.5 rounded-lg text-xs font-bold"
             style={{ background: '#F8FAF7', border: '1px solid #D9E2D9', color: '#667085' }}>
            ↓ Exportar CSV
          </a>
        </div>

        {/* Mensajes */}
        {error && <div className="rounded-lg p-3 text-xs" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>{error}</div>}
        {exito && <div className="rounded-lg p-3 text-xs" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#166534' }}>{exito}</div>}

        {/* Loading */}
        {cargando ? (
          <div className="flex items-center gap-3 py-8 justify-center" style={{ color: '#94A3B8' }}>
            <span className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }} />
            Cargando aprobaciones...
          </div>
        ) : aprobaciones.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-white" style={{ border: '1px solid #D9E2D9' }}>
            <p className="text-3xl mb-2">✅</p>
            <p className="font-bold" style={{ color: '#1F2933' }}>Sin casos pendientes</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              {filtroEstado || filtroRiesgo ? 'No hay casos con los filtros aplicados.' : 'Todos los borradores han sido procesados.'}
            </p>
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
                <div key={a.id} className="rounded-xl bg-white p-4 space-y-3"
                     style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.04)' }}>
                  {/* Cabecera de la card */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-mono text-xs font-bold" style={{ color: '#14532D' }}>{a.radicadoId}</p>
                        <StatusBadge estado={a.estado} />
                        <LegalRiskBadge nivel={a.nivelRiesgo} size="sm" />
                      </div>
                      {a.motivoRevision?.length > 0 && (
                        <p className="text-[10px] leading-snug" style={{ color: '#667085' }}>
                          {a.motivoRevision[0]}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] shrink-0" style={{ color: '#94A3B8' }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}
                    </p>
                  </div>

                  {/* Historial compacto */}
                  {a.historial?.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                      {a.historial.slice(-3).map((h, i) => (
                        <div key={i} className="flex items-center gap-1.5 shrink-0">
                          {i > 0 && <span style={{ color: '#D9E2D9' }}>→</span>}
                          <span className="text-[9px] px-1.5 py-0.5 rounded"
                                style={{ background: '#EEF4EE', color: '#14532D' }}>
                            {h.rol} · {h.estado.replace(/_/g, ' ').slice(0, 20)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Acciones */}
                  {(puedeAprobar || puedeEscalar || puedeListoEnvio) && (
                    <div className="pt-3 space-y-2" style={{ borderTop: '1px solid #EEF4EE' }}>
                      <div className="flex flex-wrap gap-2">
                        {puedeAprobar && (
                          <button
                            onClick={() => ejecutarAccion(a.id, 'aprobar')}
                            disabled={estaCargando}
                            className="px-4 py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50"
                            style={{ background: '#14532D' }}>
                            {estaCargando ? '...' : '✓ Aprobar'}
                          </button>
                        )}

                        {puedeListoEnvio && (
                          <button
                            onClick={() => ejecutarAccion(a.id, 'marcar_listo_para_envio')}
                            disabled={estaCargando}
                            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                            style={{ background: '#D4A017', color: '#14532D' }}>
                            {estaCargando ? '...' : '📤 Listo para envío'}
                          </button>
                        )}

                        {puedeEscalar && (
                          <button
                            onClick={() => ejecutarAccion(a.id, 'escalar_juridica')}
                            disabled={estaCargando}
                            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                            style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                            🚨 Escalar
                          </button>
                        )}

                        {puedeAprobar && (
                          <button
                            onClick={() => setShowDev((p) => ({ ...p, [a.id]: !p[a.id] }))}
                            className="px-4 py-2 rounded-lg text-xs"
                            style={{ border: '1px solid #D9E2D9', color: '#667085' }}>
                            ↩ Devolver
                          </button>
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
                            className="input-internal resize-none w-full text-xs"
                          />
                          <button
                            onClick={() => ejecutarAccion(a.id, 'devolver', motiDev[a.id])}
                            disabled={!motiDev[a.id]?.trim() || estaCargando}
                            className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
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
        <div className="pt-4" style={{ borderTop: '1px solid #D9E2D9' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94A3B8' }}>Exportar reportes</p>
          <div className="flex flex-wrap gap-2">
            {[
              { tipo: 'aprobaciones', label: 'Aprobaciones' },
              { tipo: 'vencimientos', label: 'Vencimientos' },
              { tipo: 'metricas',     label: 'Métricas' },
            ].map(({ tipo, label }) => (
              <a key={tipo} href={`/api/simi/reportes?tipo=${tipo}`}
                 className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                 style={{ background: '#EEF4EE', border: '1px solid #D9E2D9', color: '#14532D' }}>
                ↓ {label} CSV
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
