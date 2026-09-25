'use client';

import type { NormativeDocumentStatus } from '@/src/types/simi-normograma';

const CONFIG: Record<NormativeDocumentStatus, { label: string; cls: string }> = {
  vigente:                 { label: '✓ Vigente',          cls: 'bg-green-50 text-green-700 border-green-200' },
  parcialmente_vigente:    { label: '~ Parcialmente vigente', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  interna_validada:        { label: '✓ Validada',         cls: 'bg-[#EEF4EE] text-[#14532D] border-[#D9E2D9]' },
  pendiente_verificacion:  { label: '? Pendiente',        cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  interna_no_validada:     { label: '! No validada',      cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  derogada:                { label: '✗ Derogada',         cls: 'bg-red-50 text-red-700 border-red-200' },
};

interface NormativeValidationBadgeProps {
  estado: NormativeDocumentStatus;
  size?:  'xs' | 'sm';
}

export function NormativeValidationBadge({ estado, size = 'xs' }: NormativeValidationBadgeProps) {
  const cfg = CONFIG[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  const px  = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center rounded font-bold border ${px} ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function CitabilityIndicator({ citableComo }: {
  citableComo: 'fundamento_directo' | 'referencia_sujeta_validacion' | 'no_citable';
}) {
  const map = {
    fundamento_directo:           { label: 'Citable',          cls: 'text-green-700' },
    referencia_sujeta_validacion: { label: 'Requiere validar', cls: 'text-yellow-700' },
    no_citable:                   { label: 'No citable',       cls: 'text-red-600' },
  };
  const cfg = map[citableComo];
  return <span className={`text-[9px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}
