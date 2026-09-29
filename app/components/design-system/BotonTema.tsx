'use client';

import { Moon, Sun } from 'lucide-react';
import type { TemaInterno } from '@/lib/hooks/useTemaInterno';

/**
 * Alterna el tema claro/oscuro del panel interno (ADR-0043/0045). Muestra
 * el icono del tema al que se cambia: luna en claro, sol en oscuro.
 */
export function BotonTema({ tema, onAlternar }: { tema: TemaInterno; onAlternar: () => void }) {
  const oscuro = tema === 'oscuro';
  const accion = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button
      type="button"
      onClick={onAlternar}
      className="tablero-interactivo shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-px hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30"
      style={{ background: 'var(--tema-fondo-f4f9f6)', borderColor: 'var(--tema-borde-dce4ea)', color: 'var(--tema-texto-007049)' }}
      aria-label={accion}
      title={accion}
    >
      {oscuro
        ? <Sun size={17} strokeWidth={1.9} aria-hidden="true" />
        : <Moon size={17} strokeWidth={1.9} aria-hidden="true" />}
    </button>
  );
}
