'use client';

import type { ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════
   Un bloque de categoría de «Documentos del trámite» — encabezado compacto
   (número, título, descripción y avance X/Y) + filas al expandir, con
   transición suave de altura. Presentación pura: el avance viene YA CALCULADO
   del evaluador; este componente no cuenta ni reevalúa nada.
══════════════════════════════════════════════════════════════ */

export interface DocumentCategoryProps {
  numero: string;
  titulo: string;
  descripcion: string;
  /** Avance GLOBAL de la categoría (no del subconjunto filtrado): aportados / exigibles. */
  aportados: number;
  total: number;
  expandido: boolean;
  onToggle: () => void;
  /** Las filas (ya filtradas por el orquestador). */
  children: ReactNode;
  /** id para asociar encabezado ↔ contenido (aria). */
  idContenido: string;
}

export function DocumentCategory({
  numero, titulo, descripcion, aportados, total, expandido, onToggle, children, idContenido,
}: DocumentCategoryProps) {
  const completa = total > 0 && aportados >= total;
  const pendientes = Math.max(0, total - aportados);

  return (
    <section className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expandido}
        aria-controls={idContenido}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-black"
          style={{ background: 'var(--bg-surface-2)', color: '#14532D' }}
        >
          {numero}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{titulo}</span>
          <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>{descripcion}</span>
        </span>

        <span className="shrink-0 text-right">
          <span className="flex items-center justify-end gap-1.5">
            <span className="tabular-nums text-sm font-bold" style={{ color: completa ? '#116932' : 'var(--text-primary)' }}>
              {aportados}/{total}
            </span>
            {completa
              ? <IconoCheckCircular />
              : <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: '#D97706' }} />}
          </span>
          <span className="block text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {completa ? 'Completos' : `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`}
          </span>
        </span>

        <span aria-hidden className="shrink-0 transition-transform duration-200 motion-reduce:transition-none" style={{ transform: expandido ? 'rotate(180deg)' : 'none', color: 'var(--text-secondary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>

      {/* Altura animada con el truco grid-rows 0fr→1fr — sin números mágicos. */}
      <div
        id={idContenido}
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: expandido ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function IconoCheckCircular() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: '#16A34A' }}>
      <circle cx="12" cy="12" r="9" fill="#16A34A" />
      <path d="M8.3 12.2l2.4 2.4 5-5.2" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
