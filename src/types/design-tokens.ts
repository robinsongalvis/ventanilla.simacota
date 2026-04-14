/**
 * src/types/design-tokens.ts
 * ───────────────────────────
 * Obsidian Kinetic Design System — single source of truth for tokens.
 *
 * Grid unit: 8 px
 * Background: #0A0A0B  (slate-950)
 * Primary:    #6366F1  (indigo-500)
 * Alert:      #F43F5E  (rose-500)
 * Headlines:  Manrope 700/800
 * Body:       DM Sans 400
 * Labels:     DM Sans 700, uppercase, tracking-widest, text-xs
 */

/* ── Colour palette ──────────────────────────────────────────────────────── */

export const DESIGN_TOKENS = {
  color: {
    background: '#0A0A0B',
    primary:    '#6366F1',
    alert:      '#F43F5E',
    surface:    'rgba(15, 15, 20, 0.6)',
    border:     'rgba(255, 255, 255, 0.1)',
  },
  font: {
    headline: 'var(--font-manrope)',
    body:     'var(--font-dm-sans)',
  },
  grid: 8,
} as const;

/* ── Tailwind class bundles ──────────────────────────────────────────────── */

/** Glassmorphism card — use as className on a div. */
export const GLASS_CARD =
  'bg-slate-900/40 backdrop-blur-[25px] border border-white/10 rounded-2xl';

/** Hero / section headlines — Manrope Black. */
export const HEADLINE_CLASSES =
  'font-black tracking-tighter' as const;

/** Small ALL-CAPS labels — DM Sans Bold. */
export const LABEL_CLASSES =
  'font-bold uppercase tracking-widest text-xs' as const;

/* ── Priority colour map (used in badges & timeline) ────────────────────── */

export const PRIORIDAD_COLOR = {
  ROJO:     { bg: 'bg-rose-500/20',   text: 'text-rose-400',   border: 'border-rose-500/40'   },
  NARANJA:  { bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border-amber-500/40'  },
  AMARILLO: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
} as const;

/* ── Estado colour map ───────────────────────────────────────────────────── */

export const ESTADO_COLOR = {
  PENDIENTE:   { bg: 'bg-slate-700/40',   text: 'text-slate-400'  },
  EN_REVISION: { bg: 'bg-blue-500/20',    text: 'text-blue-400'   },
  EN_PROCESO:  { bg: 'bg-indigo-500/20',  text: 'text-indigo-400' },
  RESUELTO:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400'},
  DEVUELTO:    { bg: 'bg-amber-500/20',   text: 'text-amber-400'  },
  RECHAZADO:   { bg: 'bg-rose-500/20',    text: 'text-rose-400'   },
} as const;
