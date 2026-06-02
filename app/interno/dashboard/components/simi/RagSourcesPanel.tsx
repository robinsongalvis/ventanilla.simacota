'use client';

import type { RagSource } from '@/src/types/simi-rag';
import { NormativeValidationBadge, CitabilityIndicator } from './NormativeValidationBadge';

interface RagSourcesPanelProps {
  fuentesValidadas:  RagSource[];
  fuentesPendientes: RagSource[];
}

export function RagSourcesPanel({ fuentesValidadas, fuentesPendientes }: RagSourcesPanelProps) {
  const total = fuentesValidadas.length + fuentesPendientes.length;
  if (total === 0) return null;

  return (
    <div className="rounded-xl bg-white p-3 space-y-3" style={{ border: '1px solid #D9E2D9' }}>
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#14532D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
          Fuentes RAG consultadas ({total})
        </p>
      </div>

      {fuentesValidadas.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-green-700">Citables como fundamento</p>
          {fuentesValidadas.map((f, i) => (
            <div key={i} className="flex items-start justify-between gap-2 py-1.5"
                 style={{ borderBottom: i < fuentesValidadas.length - 1 ? '1px solid #EEF4EE' : undefined }}>
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate" style={{ color: '#1F2933' }}>{f.titulo}</p>
                <p className="text-[9px]" style={{ color: '#94A3B8' }}>{f.tipo_norma}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <NormativeValidationBadge estado={f.estado} />
                <CitabilityIndicator citableComo={f.citableComo} />
              </div>
            </div>
          ))}
        </div>
      )}

      {fuentesPendientes.length > 0 && (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 text-yellow-700">Pendientes de validación (no citadas)</p>
          {fuentesPendientes.map((f, i) => (
            <div key={i} className="flex items-start justify-between gap-2 py-1.5 opacity-70"
                 style={{ borderBottom: i < fuentesPendientes.length - 1 ? '1px solid #EEF4EE' : undefined }}>
              <p className="text-[11px] truncate" style={{ color: '#667085' }}>{f.titulo}</p>
              <NormativeValidationBadge estado={f.estado} />
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] italic" style={{ color: '#94A3B8' }}>
        Solo las fuentes con estado vigente, parcialmente vigente o interna_validada fueron usadas como fundamento.
      </p>
    </div>
  );
}
