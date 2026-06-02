'use client';

import type { ChecklistMipg } from '@/src/types/simi-juridico';

interface MipgChecklistCardProps {
  checklist: ChecklistMipg;
}

function CheckItem({ label, value }: { label: string; value: boolean | 'pendiente' }) {
  const icon =
    value === true    ? '✓' :
    value === false   ? '✗' :
    '?';
  const cls =
    value === true    ? 'text-green-700' :
    value === false   ? 'text-red-600' :
    'text-yellow-700';
  const bg =
    value === true    ? 'bg-green-50' :
    value === false   ? 'bg-red-50' :
    'bg-yellow-50';

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${bg}`}>
      <span className={`text-xs font-black ${cls} shrink-0 w-3`}>{icon}</span>
      <span className="text-[11px]" style={{ color: '#1F2933' }}>{label}</span>
    </div>
  );
}

export function MipgChecklistCard({ checklist }: MipgChecklistCardProps) {
  const items: { label: string; key: keyof ChecklistMipg }[] = [
    { label: 'Claridad en la respuesta',       key: 'claridad' },
    { label: 'Responde de fondo',               key: 'respuestaFondo' },
    { label: 'Dentro de término',               key: 'oportunidad' },
    { label: 'Trazabilidad garantizada',        key: 'trazabilidad' },
    { label: 'Competencia verificada',          key: 'competencia' },
    { label: 'Protección de datos',             key: 'proteccionDatos' },
    { label: 'Gestión documental',              key: 'gestionDocumental' },
    { label: 'Revisión jurídica requerida',     key: 'requiereRevisionJuridica' },
  ];

  return (
    <div className="rounded-xl bg-white p-4" style={{ border: '1px solid #D9E2D9' }}>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 shrink-0" style={{ color: '#14532D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#14532D' }}>Checklist MIPG</p>
      </div>

      <div className="grid grid-cols-1 gap-1.5">
        {items.map(({ label, key }) => (
          <CheckItem
            key={key}
            label={label}
            value={checklist[key] as boolean | 'pendiente'}
          />
        ))}
      </div>

      {checklist.observaciones?.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid #EEF4EE' }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#94A3B8' }}>
            Observaciones MIPG
          </p>
          <ul className="space-y-1">
            {checklist.observaciones.map((obs, i) => (
              <li key={i} className="text-[11px] leading-snug" style={{ color: '#667085' }}>
                • {obs}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
