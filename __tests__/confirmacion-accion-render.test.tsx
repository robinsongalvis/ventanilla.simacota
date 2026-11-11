import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConfirmacionAccion } from '@/app/interno/dashboard/components/ConfirmacionAccion';

/**
 * La confirmación grande que reemplaza el «Operación guardada correctamente»
 * de una línea: la funcionaria resolvía y no veía si había pasado algo.
 * Estas pruebas sostienen que la confirmación dice QUÉ pasó, que se anuncia
 * como estado accesible, que se cierra sola y que se puede cerrar antes.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('ConfirmacionAccion', () => {
  it('anuncia la actuación como estado accesible, con título y detalle', () => {
    render(
      <ConfirmacionAccion
        titulo="Respuesta enviada"
        detalle="El radicado 1-110-202611-00000030 quedó resuelto."
        onDismiss={() => {}}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Respuesta enviada');
    expect(status.textContent).toContain('1-110-202611-00000030');
  });

  it('con tono normal dibuja el chulo animado', () => {
    const { container } = render(<ConfirmacionAccion titulo="Guardado" onDismiss={() => {}} />);
    expect(container.querySelector('.svg-circle-draw')).not.toBeNull();
    expect(container.querySelector('.svg-check-draw')).not.toBeNull();
  });

  it('el tono «aviso» cambia el chulo por el icono de correo y conserva el mensaje', () => {
    const { container } = render(
      <ConfirmacionAccion
        tono="aviso"
        titulo="Resuelto, pero el correo no salió"
        detalle="Avísale al ciudadano por otro canal."
        onDismiss={() => {}}
      />,
    );
    expect(container.querySelector('.svg-check-draw')).toBeNull();
    expect(container.querySelector('svg.lucide-mail-warning')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Resuelto, pero el correo no salió');
  });

  it('se cierra sola a los 6 segundos, no antes', () => {
    const onDismiss = vi.fn();
    render(<ConfirmacionAccion titulo="Guardado" onDismiss={onDismiss} />);
    act(() => { vi.advanceTimersByTime(5_999); });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('se cierra antes con la X', () => {
    const onDismiss = vi.fn();
    render(<ConfirmacionAccion titulo="Guardado" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /cerrar la confirmación/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
