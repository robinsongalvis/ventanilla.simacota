import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegistroExpresModal } from '@/app/interno/dashboard/components/RegistroExpresModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Sprint Registro exprés — modal del funcionario.
══════════════════════════════════════════════════════════════ */

const SECRETARIO = {
  uid: 'uid-secretario', nombre: 'Secretario de Hacienda',
  rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' as const,
};

const LAURA = {
  uid: 'uid-laura', nombre: 'Laura',
  rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA' as const,
};

function llenarFormulario() {
  fireEvent.change(screen.getByLabelText('Quién escribió'), { target: { value: 'Banco Agrario' } });
  fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Certificación convenio 052' } });
  fireEvent.change(screen.getByLabelText('Qué pedía'), { target: { value: 'Certificación de cuentas' } });
  fireEvent.change(screen.getByLabelText('Qué se respondió'), { target: { value: 'Se envió la certificación' } });
}

describe('Registro exprés — RegistroExpresModal', () => {
  /* 1 · el funcionario queda anclado a su dependencia */
  it('el funcionario no elige dependencia y ve la suya fija', () => {
    render(<RegistroExpresModal usuario={SECRETARIO} onCerrar={vi.fn()} />);
    expect(screen.queryByLabelText(/Dependencia que recibió/i)).toBeNull();
    expect(screen.getByText(/Se registrará en tu dependencia: Secretaría de Hacienda/i)).toBeTruthy();
  });

  /* 2 · recepción/admin sí eligen dependencia */
  it('recepción ve el selector de dependencia', () => {
    render(<RegistroExpresModal usuario={LAURA} onCerrar={vi.fn()} />);
    expect(screen.getByLabelText(/Dependencia que recibió/i)).toBeTruthy();
  });

  /* 3 · registrar muestra los dos números del paquete */
  it('al registrar muestra la entrada y la salida amarrada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, radicadoId: '1-EMAIL-2026-00000089', salidaId: '2-SAL-2026-00000031' }),
    }));
    render(<RegistroExpresModal usuario={SECRETARIO} onCerrar={vi.fn()} />);
    llenarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() => expect(screen.getByText('1-EMAIL-2026-00000089')).toBeTruthy());
    expect(screen.getByText('2-SAL-2026-00000031')).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      '/api/dependencias/registro-expres',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  /* 4 · el error del endpoint se muestra tal cual */
  it('muestra el error de validación del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'La respuesta no puede ser anterior a la llegada del correo.' }),
    }));
    render(<RegistroExpresModal usuario={SECRETARIO} onCerrar={vi.fn()} />);
    llenarFormulario();
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/anterior a la llegada/i));
  });
});
