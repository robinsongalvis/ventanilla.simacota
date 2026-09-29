'use client';

import type { NivelRiesgoJuridico } from '@/src/types/simi-juridico';

interface LegalRiskBadgeProps {
  nivel:    NivelRiesgoJuridico;
  size?:    'sm' | 'md';
  pulse?:   boolean;
}

const CONFIG = {
  bajo:  {
    label:   'Riesgo Bajo',
    dot:     'bg-green-500',
    badge:   'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300 border-green-200 oscuro:border-green-500/30',
  },
  medio: {
    label:   'Riesgo Medio',
    dot:     'bg-yellow-500',
    badge:   'bg-yellow-50 oscuro:bg-yellow-500/15 text-yellow-700 oscuro:text-yellow-300 border-yellow-200 oscuro:border-yellow-500/30',
  },
  alto:  {
    label:   'Riesgo Alto',
    dot:     'bg-red-500 animate-pulse',
    badge:   'bg-red-50 oscuro:bg-red-500/15 text-red-700 oscuro:text-red-300 border-red-200 oscuro:border-red-500/30',
  },
} as const;

export function LegalRiskBadge({ nivel, size = 'sm', pulse = false }: LegalRiskBadgeProps) {
  const cfg  = CONFIG[nivel];
  const px   = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const dotSz = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide border ${px} ${cfg.badge}`}>
      <span className={`rounded-full shrink-0 ${dotSz} ${cfg.dot} ${pulse && nivel === 'alto' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

export function RevisionJuridicaBanner() {
  return (
    <div className="rounded-xl p-3 flex items-start gap-2.5"
         style={{ background: 'var(--tema-fondo-fef2f2)', border: '1px solid var(--tema-borde-fecaca)' }}>
      <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-600 oscuro:text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div>
        <p className="text-xs font-bold text-red-700 oscuro:text-red-300 leading-tight">Revisión jurídica obligatoria</p>
        <p className="text-[10px] text-red-600 oscuro:text-red-300 mt-0.5 leading-relaxed">
          Este caso requiere revisión del asesor jurídico o jefe de dependencia antes de emitir respuesta oficial.
        </p>
      </div>
    </div>
  );
}

export function NormaEstadoBadge({ estado }: { estado: string }) {
  const cfg = {
    vigente:                 'bg-green-50 oscuro:bg-green-500/15 text-green-700 oscuro:text-green-300 border-green-200 oscuro:border-green-500/30',
    parcialmente_vigente:    'bg-yellow-50 oscuro:bg-yellow-500/15 text-yellow-700 oscuro:text-yellow-300 border-yellow-200 oscuro:border-yellow-500/30',
    interna_validada:        'bg-[var(--tema-fondo-f4f9f6)] text-[var(--tema-texto-007049)] border-[var(--tema-borde-dce4ea)]',
    pendiente_verificacion:  'bg-gray-100 oscuro:bg-white/5 text-gray-600 oscuro:text-slate-400 border-gray-200 oscuro:border-white/10',
    interna_no_validada:     'bg-gray-100 oscuro:bg-white/5 text-gray-500 oscuro:text-slate-400 border-gray-200 oscuro:border-white/10',
    derogada:                'bg-red-50 oscuro:bg-red-500/15 text-red-600 oscuro:text-red-300 border-red-200 oscuro:border-red-500/30',
  } as Record<string, string>;

  const label = {
    vigente:                '✓ Vigente',
    parcialmente_vigente:   '~ Parcial',
    interna_validada:       '✓ Interna validada',
    pendiente_verificacion: '? Verificar',
    interna_no_validada:    '! No validada',
    derogada:               '✗ Derogada',
  } as Record<string, string>;

  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${cfg[estado] ?? 'bg-gray-100 oscuro:bg-white/5 text-gray-500 oscuro:text-slate-400 border-gray-200 oscuro:border-white/10'}`}>
      {label[estado] ?? estado}
    </span>
  );
}
