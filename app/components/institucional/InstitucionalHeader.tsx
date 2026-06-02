'use client';

import Image from 'next/image';
import { INSTITUCION } from '@/lib/institucion';

/**
 * Variantes de uso:
 *  default  — logo grande + texto (páginas públicas de escritorio)
 *  compact  — logo mediano + texto (cabecera de páginas públicas, móvil)
 *  sidebar  — logo a ancho completo, sin texto adicional (sidebar 210px)
 *  print    — texto completo sin imagen (impresión)
 */
type Variant = 'default' | 'compact' | 'sidebar' | 'print';

interface Props {
  variant?: Variant;
  /** @deprecated — use variant='compact' */
  compact?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function InstitucionalHeader({
  variant,
  compact = false,
  eyebrow = INSTITUCION.contexto,
  title = INSTITUCION.nombre,
  subtitle = INSTITUCION.sistema,
  align = 'left',
  className = '',
}: Props) {
  // Backward-compat: compact prop maps to 'compact' variant
  const resolved: Variant = variant ?? (compact ? 'compact' : 'default');
  const centered = align === 'center';

  /* ── SIDEBAR variant: logo fills the full width, no side text ── */
  if (resolved === 'sidebar') {
    return (
      <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
        <div className="relative w-full h-9">
          <Image
            src={INSTITUCION.logo}
            alt={INSTITUCION.nombre}
            fill
            priority
            sizes="170px"
            className="object-contain object-left"
          />
        </div>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600 truncate">
          {subtitle}
        </p>
      </div>
    );
  }

  /* ── PRINT variant: text-only, no image ── */
  if (resolved === 'print') {
    return (
      <div className={`${centered ? 'text-center' : ''} ${className}`}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
          {eyebrow}
        </p>
        <p className="text-base font-black text-slate-900 leading-tight">{title}</p>
        <p className="text-sm text-slate-600">{subtitle}</p>
      </div>
    );
  }

  /* ── DEFAULT / COMPACT variants: logo + text side by side ── */
  const imgClass = resolved === 'compact'
    ? 'h-10 w-36 sm:h-12 sm:w-44'
    : 'h-14 w-48 sm:h-16 sm:w-60 lg:w-72';

  return (
    <div
      className={`flex ${centered ? 'flex-col text-center items-center' : 'items-center'} gap-3 min-w-0 ${className}`}
    >
      <div className={`${imgClass} relative shrink-0`}>
        <Image
          src={INSTITUCION.logo}
          alt={INSTITUCION.nombre}
          fill
          priority
          sizes={resolved === 'compact' ? '176px' : '(max-width: 640px) 192px, 288px'}
          className="object-contain object-left"
        />
      </div>
      <div className={`min-w-0 ${centered ? '' : ''}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-300/80 truncate">
          {eyebrow}
        </p>
        <p
          className={`${resolved === 'compact' ? 'text-sm' : 'text-base sm:text-lg'} font-black tracking-tight text-slate-50 leading-tight truncate`}
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          {title}
        </p>
        <p className="text-xs sm:text-sm text-slate-400 leading-snug truncate">{subtitle}</p>
      </div>
    </div>
  );
}
