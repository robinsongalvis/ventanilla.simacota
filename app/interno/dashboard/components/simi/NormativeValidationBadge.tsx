'use client';

import type { NormativeDocumentStatus } from '@/src/types/simi-normograma';

const CONFIG: Record<NormativeDocumentStatus, { label: string; cls: string }> = {
  vigente:                 { label: '✓ Vigente',          cls: 'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300 border-green-200 oscuro:border-green-500/30' },
  parcialmente_vigente:    { label: '~ Parcialmente vigente', cls: 'bg-yellow-50 oscuro:bg-yellow-500/15 text-yellow-700 oscuro:text-yellow-300 border-yellow-200 oscuro:border-yellow-500/30' },
  interna_validada:        { label: '✓ Validada',         cls: 'bg-[var(--tema-fondo-f4f9f6)] text-[var(--tema-texto-007049)] border-[var(--tema-borde-dce4ea)]' },
  pendiente_verificacion:  { label: '? Pendiente',        cls: 'bg-gray-100 oscuro:bg-white/5 text-gray-600 oscuro:text-slate-400 border-gray-200 oscuro:border-white/10' },
  interna_no_validada:     { label: '! No validada',      cls: 'bg-orange-50 oscuro:bg-orange-500/15 text-orange-700 oscuro:text-orange-300 border-orange-200 oscuro:border-orange-500/30' },
  derogada:                { label: '✗ Derogada',         cls: 'bg-red-50 oscuro:bg-red-500/15 text-red-700 oscuro:text-red-300 border-red-200 oscuro:border-red-500/30' },
};

interface NormativeValidationBadgeProps {
  estado: NormativeDocumentStatus;
  size?:  'xs' | 'sm';
}

export function NormativeValidationBadge({ estado, size = 'xs' }: NormativeValidationBadgeProps) {
  const cfg = CONFIG[estado] ?? { label: estado, cls: 'bg-gray-100 oscuro:bg-white/5 text-gray-600 oscuro:text-slate-400 border-gray-200 oscuro:border-white/10' };
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
    fundamento_directo:           { label: 'Citable',          cls: 'text-green-700 oscuro:text-green-300' },
    referencia_sujeta_validacion: { label: 'Requiere validar', cls: 'text-yellow-700 oscuro:text-yellow-300' },
    no_citable:                   { label: 'No citable',       cls: 'text-red-600 oscuro:text-red-300' },
  };
  const cfg = map[citableComo];
  return <span className={`text-[9px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}
