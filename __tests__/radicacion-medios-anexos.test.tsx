import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { RadicacionFuncionarioForm } from '@/app/interno/recepcion/components/RadicacionFuncionarioForm';

// El primer render del formulario completo en jsdom puede superar los
// 5 s por defecto cuando la máquina está bajo carga.
vi.setConfig({ testTimeout: 15_000 });

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Recepción fluida — chips de medios entregados en el
   formulario de Radicación Rápida.
══════════════════════════════════════════════════════════════ */

describe('Recepción — chips de medios entregados', () => {
  /* 1 · los cuatro chips acordados están disponibles */
  it('muestra los chips CD, USB, Sobre sellado y Otro', () => {
    render(<RadicacionFuncionarioForm radicadoPreview="1-OFICIO-2026-00000099" />);
    for (const medio of ['CD', 'USB', 'Sobre sellado', 'Otro']) {
      expect(screen.getByRole('button', { name: medio })).toBeTruthy();
    }
  });

  /* 2 · el chip alterna su estado de selección */
  it('clic en un chip lo marca y un segundo clic lo desmarca', () => {
    render(<RadicacionFuncionarioForm radicadoPreview="1-OFICIO-2026-00000099" />);
    const chip = screen.getByRole('button', { name: 'CD' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
  });
});
