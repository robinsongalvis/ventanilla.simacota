'use client';

import { useState } from 'react';
import type { ApprovalFlow, ApprovalStatus } from '@/src/types/simi-approval';
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLOR } from '@/src/types/simi-approval';
import { LegalRiskBadge } from './LegalRiskBadge';

interface ApprovalFlowCardProps {
  approval:           ApprovalFlow;
  usuarioRol:         string;
  onAprobar?:         (observacion?: string) => Promise<void>;
  onDevolver?:        (motivo: string) => Promise<void>;
  onEscalarJuridica?: () => Promise<void>;
}

function StatusBadge({ estado }: { estado: ApprovalStatus }) {
  const cls = APPROVAL_STATUS_COLOR[estado] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {APPROVAL_STATUS_LABELS[estado] ?? estado}
    </span>
  );
}

export function ApprovalFlowCard({
  approval,
  usuarioRol,
  onAprobar,
  onDevolver,
  onEscalarJuridica,
}: ApprovalFlowCardProps) {
  const [motiDev, setMotiDev] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevolver, setShowDevolver] = useState(false);

  const puedeAprobar =
    (usuarioRol === 'JEFE_DEPENDENCIA' && approval.estado === 'pendiente_revision_jefe') ||
    (usuarioRol === 'ADMIN' && ['pendiente_revision_jefe', 'pendiente_revision_juridica'].includes(approval.estado));

  const puedeEscalar =
    approval.estado === 'pendiente_revision_jefe' &&
    ['JEFE_DEPENDENCIA', 'FUNCIONARIO', 'ADMIN'].includes(usuarioRol);

  async function handleAprobar() {
    if (!onAprobar) return;
    setLoading(true);
    try { await onAprobar(); } finally { setLoading(false); }
  }

  async function handleDevolver() {
    if (!onDevolver || !motiDev.trim()) return;
    setLoading(true);
    try { await onDevolver(motiDev); setShowDevolver(false); setMotiDev(''); }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-xl bg-white space-y-3 p-4" style={{ border: '1px solid #D9E2D9', boxShadow: '0 1px 3px rgba(20,83,45,0.06)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Flujo de aprobación</p>
          <StatusBadge estado={approval.estado} />
        </div>
        <LegalRiskBadge nivel={approval.nivelRiesgo} size="sm" />
      </div>

      {/* Motivos */}
      {approval.motivoRevision?.length > 0 && (
        <div className="rounded-lg p-2.5" style={{ background: '#F8FAF7', border: '1px solid #EEF4EE' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Motivos</p>
          {approval.motivoRevision.map((m, i) => (
            <p key={i} className="text-[11px]" style={{ color: '#667085' }}>• {m}</p>
          ))}
        </div>
      )}

      {/* Historial */}
      {approval.historial?.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>Historial</p>
          <div className="space-y-1.5">
            {approval.historial.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px]">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#14532D] mt-1" />
                <div>
                  <span className="font-semibold" style={{ color: '#1F2933' }}>{APPROVAL_STATUS_LABELS[h.estado as ApprovalStatus] ?? h.estado}</span>
                  <span style={{ color: '#94A3B8' }}> · {h.rol} · {new Date(h.fecha).toLocaleDateString('es-CO')}</span>
                  {h.observacion && <p className="italic" style={{ color: '#94A3B8' }}>{h.observacion}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acciones según rol */}
      {(puedeAprobar || puedeEscalar) && (
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid #EEF4EE' }}>
          {puedeAprobar && (
            <button
              onClick={handleAprobar}
              disabled={loading}
              className="w-full py-2 rounded-lg text-white text-xs font-bold disabled:opacity-50"
              style={{ background: '#14532D' }}>
              {loading ? 'Guardando...' : 'Aprobar respuesta'}
            </button>
          )}
          {puedeEscalar && onEscalarJuridica && (
            <button
              onClick={onEscalarJuridica}
              disabled={loading}
              className="w-full py-2 rounded-lg text-xs font-bold"
              style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }}>
              Escalar a asesor jurídico
            </button>
          )}
          {puedeAprobar && (
            <button
              onClick={() => setShowDevolver(!showDevolver)}
              className="w-full py-1.5 rounded-lg text-xs"
              style={{ border: '1px solid #D9E2D9', color: '#667085' }}>
              Devolver para ajustes
            </button>
          )}
          {showDevolver && (
            <div className="space-y-2">
              <textarea
                value={motiDev}
                onChange={(e) => setMotiDev(e.target.value)}
                rows={2}
                placeholder="Motivo de devolución..."
                className="input-internal resize-none w-full"
              />
              <button
                onClick={handleDevolver}
                disabled={!motiDev.trim() || loading}
                className="w-full py-1.5 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: '#B45309', color: '#ffffff' }}>
                Confirmar devolución
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-[9px] italic" style={{ color: '#94A3B8' }}>
        Ningún borrador puede enviarse sin aprobación humana registrada.
      </p>
    </div>
  );
}
