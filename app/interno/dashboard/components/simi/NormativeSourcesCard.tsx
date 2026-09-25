'use client';

import type { NormativaSugerida } from '@/src/types/simi-juridico';
import { NormaEstadoBadge } from './LegalRiskBadge';

interface NormativeSourcesCardProps {
  fuentes: NormativaSugerida[];
}

export function NormativeSourcesCard({ fuentes }: NormativeSourcesCardProps) {
  if (!fuentes?.length) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: '#F8FAF7', border: '1px solid #D9E2D9' }}>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          No se identificaron fundamentos normativos para este caso.
          Consultar con asesor jurídico.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-4 space-y-3" style={{ border: '1px solid #D9E2D9' }}>
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 shrink-0" style={{ color: '#14532D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>
          Fundamentos normativos sugeridos
        </p>
      </div>

      {fuentes.map((f, i) => (
        <div key={i} className="rounded-lg p-3 space-y-1.5"
             style={{ background: '#F8FAF7', border: '1px solid #EEF4EE' }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold" style={{ color: '#1F2933' }}>{f.titulo}</p>
            <NormaEstadoBadge estado={f.estado} />
          </div>

          {f.fuente && (
            <p className="text-[10px]" style={{ color: '#94A3B8' }}>
              Fuente: {f.fuente}
            </p>
          )}

          <p className="text-[11px] leading-snug" style={{ color: '#667085' }}>
            <span className="font-semibold">Aplicabilidad: </span>{f.aplicabilidad}
          </p>

          {f.notaValidacion && (
            <p className="text-[10px] italic leading-snug"
               style={{ color: f.estado === 'pendiente_verificacion' ? '#D97706' : '#94A3B8' }}>
              ⚠ {f.notaValidacion}
            </p>
          )}
        </div>
      ))}

      <p className="text-[10px] italic" style={{ color: '#94A3B8' }}>
        Verificar vigencia y aplicabilidad antes de citar en respuesta oficial.
      </p>
    </div>
  );
}
