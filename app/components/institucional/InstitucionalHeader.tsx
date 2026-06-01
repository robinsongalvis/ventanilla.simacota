'use client';

import Image from 'next/image';
import { INSTITUCION } from '@/lib/institucion';

interface Props {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  compact?: boolean;
  className?: string;
}

export function InstitucionalHeader({
  eyebrow = INSTITUCION.contexto,
  title = INSTITUCION.nombre,
  subtitle = INSTITUCION.sistema,
  align = 'left',
  compact = false,
  className = '',
}: Props) {
  const centered = align === 'center';

  return (
    <div className={`flex ${centered ? 'flex-col text-center items-center' : 'items-center'} gap-3 ${className}`}>
      <div className={`${compact ? 'h-12 w-44' : 'h-16 w-56 sm:w-72'} relative shrink-0`}>
        <Image
          src={INSTITUCION.logo}
          alt={INSTITUCION.nombre}
          fill
          priority
          sizes={compact ? '176px' : '(max-width: 640px) 224px, 288px'}
          className="object-contain object-left"
        />
      </div>
      <div className={centered ? '' : 'min-w-0'}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">
          {eyebrow}
        </p>
        <p className={`${compact ? 'text-sm' : 'text-base sm:text-lg'} font-black tracking-tight text-slate-50 leading-tight`} style={{ fontFamily: 'var(--font-manrope)' }}>
          {title}
        </p>
        <p className="text-xs sm:text-sm text-slate-400 leading-snug">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
