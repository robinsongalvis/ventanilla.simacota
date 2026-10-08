import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AjusteConsecutivoRadicacion } from '@/app/interno/dashboard/components/admin/AjusteConsecutivoRadicacion';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Apertura de serie desde el libro físico', () => {
  it('no precarga ni sugiere un número y exige que el ADMIN lo escriba', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        anio: 2026,
        ultimo: 29,
        proximoRadicado: '1-110-202610-00000030',
        openingAlreadyExists: false,
        primerNumeroMinimo: 30,
      }),
    }));

    render(<AjusteConsecutivoRadicacion />);

    const entrada = await screen.findByLabelText(/Primer consecutivo real/) as HTMLInputElement;
    expect(entrada.value).toBe('');
    expect(entrada.min).toBe('30');
    expect(entrada.placeholder).toBe('Número confirmado en el libro físico');
    expect(screen.queryByText(/consecutivo real sugerido/i)).toBeNull();
    expect(screen.getByText('Mínimo técnicamente permitido')).toBeTruthy();
    expect(screen.getByText(/No es una sugerencia/)).toBeTruthy();
    const botonAbrir = screen.getByRole('button', { name: 'Abrir serie una sola vez' }) as HTMLButtonElement;
    expect(botonAbrir.disabled).toBe(true);

    fireEvent.change(entrada, { target: { value: '1901' } });

    expect(screen.getByText('1-110-202610-00001901')).toBeTruthy();
    expect(botonAbrir.disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => {
      expect(botonAbrir.disabled).toBe(false);
    });
  });
});
