import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SelloRecibido } from '@/app/interno/dashboard/components/SelloRecibido';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Recepción fluida — sello digital de recibido.

   El sello marca la copia física del ciudadano: pequeño, oficial,
   esquina superior izquierda. Nunca una hoja completa.
══════════════════════════════════════════════════════════════ */

function props(overrides = {}) {
  return {
    radicadoId:    '1-OFICIO-2026-00000019',
    fechaRadicado: '2026-07-02T15:31:00.000Z',
    horaRadicado:  '10:31',
    dependencia:   'Ventanilla Única',
    ...overrides,
  };
}

describe('Recepción — SelloRecibido', () => {
  /* 1 · contenido oficial del sello */
  it('muestra alcaldía, radicado, dependencia y el botón de imprimir', () => {
    render(<SelloRecibido {...props()} />);
    expect(screen.getByText(/Alcaldía Municipal de Simacota/i)).toBeTruthy();
    expect(screen.getByText('1-OFICIO-2026-00000019')).toBeTruthy();
    expect(screen.getByText(/Dependencia: Ventanilla Única/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Imprimir sello de recibido/i })).toBeTruthy();
  });

  /* 2 · el logo institucional es el mismo asset del sistema */
  it('usa el logo institucional y la URL corta de consulta', () => {
    render(<SelloRecibido {...props()} />);
    const logo = screen.getByAltText(/Escudo de la Alcaldía Municipal de Simacota/i) as HTMLImageElement;
    expect(logo.src).toContain('/brand/logo-alcaldia-simacota.png');
    expect(screen.getByText(/Consulte: ventanilla-simacota\.vercel\.app\/consulta/i)).toBeTruthy();
  });

  /* 3 · folios y anexos solo cuando aplica */
  it('muestra folios/anexos con medios cuando existen y los omite en cero', () => {
    render(<SelloRecibido {...props({ numeroFolios: 2, numeroAnexos: 1, mediosAnexos: 'CD' })} />);
    expect(screen.getByText(/Folios: 2 · Anexos: 1 \(CD\)/i)).toBeTruthy();

    cleanup();
    render(<SelloRecibido {...props()} />);
    expect(screen.queryByText(/Folios:/i)).toBeNull();
  });

  /* 4 · el botón dispara la impresión del navegador */
  it('clic en imprimir llama window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<SelloRecibido {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Imprimir sello de recibido/i }));
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });
});
