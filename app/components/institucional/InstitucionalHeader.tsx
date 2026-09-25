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
  /** Sprint Rebranding: 'dark' (sobre obsidian, default) o 'light' (sobre fondo blanco institucional). */
  theme?: 'dark' | 'light';
}

export function InstitucionalHeader({
  variant,
  compact = false,
  eyebrow = INSTITUCION.contexto,
  title = INSTITUCION.nombre,
  subtitle = INSTITUCION.sistema,
  align = 'left',
  className = '',
  theme = 'dark',
}: Props) {
  // Backward-compat: compact prop maps to 'compact' variant
  const resolved: Variant = variant ?? (compact ? 'compact' : 'default');
  const centered = align === 'center';

  /* ── SIDEBAR variant: logo arriba, texto institucional debajo ── */
  if (resolved === 'sidebar') {
    return (
      <div className={`flex flex-col gap-2.5 w-full min-w-0 ${className}`}>
        <div className="relative w-full h-12 shrink-0 overflow-hidden">
          <Image
            src={INSTITUCION.logo}
            alt={INSTITUCION.nombre}
            fill
            priority
            sizes="220px"
            className="object-contain object-left"
          />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 w-full">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200/80">
            {eyebrow}
          </p>
          <p className="text-[12px] font-black tracking-tight text-white leading-tight"
             style={{ fontFamily: 'var(--font-manrope)' }}>
            {title}
          </p>
          <p className="text-[10px] text-emerald-50/65 leading-snug">
            {subtitle}
          </p>
        </div>
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

  /* En modo claro, si el PNG del logo trae texto blanco interno, el
     fondo verde institucional dentro del recuadro lo deja legible
     sin tener que retocar el archivo gráfico original. */
  const logoWrapStyle: React.CSSProperties = theme === 'light'
    ? {
        background: 'linear-gradient(135deg, #0F3D2E 0%, #14532D 100%)',
        borderRadius: '0.625rem',
        padding: '0.35rem 0.5rem',
        boxShadow: 'var(--shadow-institutional-sm)',
      }
    : {};

  return (
    <div
      className={`flex ${centered ? 'flex-col text-center items-center' : 'items-center'} gap-3 min-w-0 ${className}`}
    >
      <div className={`${imgClass} relative shrink-0`} style={logoWrapStyle}>
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
        <p
          className="text-[10px] font-bold uppercase tracking-[0.22em] truncate"
          style={{ color: theme === 'light' ? 'var(--brand-green-action)' : 'rgba(110, 231, 183, 0.85)' }}
        >
          {eyebrow}
        </p>
        <p
          className={`${resolved === 'compact' ? 'text-sm' : 'text-base sm:text-lg'} font-black tracking-tight leading-tight truncate`}
          style={{
            fontFamily: 'var(--font-manrope)',
            color: theme === 'light' ? 'var(--brand-forest)' : '#F8FAFC',
          }}
        >
          {title}
        </p>
        <p
          className="text-xs sm:text-sm leading-snug truncate"
          style={{ color: theme === 'light' ? 'var(--text-secondary-2)' : '#94A3B8' }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
