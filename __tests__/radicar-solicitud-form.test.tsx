import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RadicarSolicitudModal } from '@/app/interno/licencias/components/RadicarSolicitudModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Bloque "Integración UI y demo" — formulario "Radicar solicitud"
   (`RadicarSolicitudModal`), consume `POST /api/licencias/expedientes`.
══════════════════════════════════════════════════════════════ */

function llenarDatosBasicos() {
  fireEvent.change(screen.getByLabelText('Nombre del solicitante'), { target: { value: 'Carlos Alberto Rojas' } });
  fireEvent.change(screen.getByLabelText('Documento del solicitante'), { target: { value: '13456789' } });
}

describe('Radicar solicitud — validación de subtipos', () => {
  it('exige al menos un subtipo antes de enviar (no llama al servidor)', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('button', { name: /^Radicar solicitud$/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/al menos un subtipo/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('muestra el catálogo normativo con nombre y código', () => {
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /Licencia de construcción.*CONSTRUCCION/i })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Acto de reconocimiento.*RECONOCIMIENTO/i })).toBeTruthy();
  });
});

describe('Radicar solicitud — envío y errores del servidor', () => {
  it('envía los subtipos seleccionados al servidor', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ ok: true, expediente: { id: 'exp-1', numeroExpediente: { numero: 'DEMO-26-abc12345' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('checkbox', { name: /Licencia de construcción/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Radicar solicitud$/i }));

    await waitFor(() => expect(screen.getByText('DEMO-26-abc12345')).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledWith('/api/licencias/expedientes', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.subtipos).toEqual(['CONSTRUCCION']);
    expect(body.solicitanteNombre).toBe('Carlos Alberto Rojas');
  });

  it('muestra el error del servidor tal cual llega (422 catálogo)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'El subtipo "LA" no está en el catálogo normativo de figuras (DF-4, ADR-0029).' }),
    }));
    render(<RadicarSolicitudModal onCerrar={vi.fn()} />);

    llenarDatosBasicos();
    fireEvent.click(screen.getByRole('checkbox', { name: /Licencia de construcción/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Radicar solicitud$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/no está en el catálogo normativo/i));
  });

  it('permite cancelar sin enviar', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onCerrar = vi.fn();
    render(<RadicarSolicitudModal onCerrar={onCerrar} />);
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(onCerrar).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
