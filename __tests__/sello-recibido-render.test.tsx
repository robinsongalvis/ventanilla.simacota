import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SelloRecibido } from '@/app/interno/dashboard/components/SelloRecibido';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Sprint Recepción fluida — sello digital de recibido.

   El sello marca la copia física del ciudadano: pequeño, oficial,
   en la esquina que la funcionaria elija (default: superior derecha).
   Nunca una hoja completa.
══════════════════════════════════════════════════════════════ */

function props(overrides = {}) {
  return {
    radicadoId:    '1-OFICIO-2026-00000019',
    fechaRadicado: '2026-07-02T15:31:00.000Z',
    horaRadicado:  '10:31',
    ...overrides,
  };
}

describe('Recepción — SelloRecibido', () => {
  /* 1 · contenido oficial del sello */
  it('muestra alcaldía, radicado y el botón de imprimir', () => {
    render(<SelloRecibido {...props()} />);
    expect(screen.getByText(/Alcaldía Municipal de Simacota/i)).toBeTruthy();
    expect(screen.getByText('1-OFICIO-2026-00000019')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Imprimir sello de recibido/i })).toBeTruthy();
  });

  /* 1b · documento público: el sello NO imprime direccionamiento interno */
  it('no muestra ninguna línea de dependencia', () => {
    render(<SelloRecibido {...props()} />);
    expect(screen.queryByText(/Dependencia:/i)).toBeNull();
    expect(screen.queryByText(/Dirigido a:/i)).toBeNull();
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

  /* 5 · selector de esquina: default superior derecha, cambiable */
  it('arranca en superior derecha y permite elegir otra esquina', () => {
    render(<SelloRecibido {...props()} />);
    const supDer = screen.getByRole('button', { name: /Sup\. derecha/i });
    const infIzq = screen.getByRole('button', { name: /Inf\. izquierda/i });
    expect(supDer.getAttribute('aria-pressed')).toBe('true');
    expect(infIzq.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(infIzq);
    expect(infIzq.getAttribute('aria-pressed')).toBe('true');
    expect(supDer.getAttribute('aria-pressed')).toBe('false');
  });

  /* 6 · la esquina elegida manda en los estilos de impresión */
  it('imprime con la posición de la esquina elegida', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      const tag = document.getElementById('sello-recibido-print-styles');
      expect(tag?.textContent).toContain('bottom: 0');
      expect(tag?.textContent).toContain('right: 0');
    });
    render(<SelloRecibido {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /Inf\. derecha/i }));
    fireEvent.click(screen.getByRole('button', { name: /Imprimir sello de recibido/i }));
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });
});
