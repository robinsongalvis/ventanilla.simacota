import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegistrarSalidaModal } from '@/app/interno/dashboard/components/salidas/RegistrarSalidaModal';
import { registrarSalida } from '@/lib/actions/registrarSalida';

vi.mock('@/lib/actions/registrarSalida', () => ({
  registrarSalida: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — modal de registro de despacho.
══════════════════════════════════════════════════════════════ */

const USUARIO = { uid: 'uid-laura', nombre: 'Laura', tenantId: 'VENTANILLA_UNICA' as const };

const ENTRADA = {
  radicadoId:        '1-WEB-2026-00000045',
  solicitanteNombre: 'María Rincón',
  dependencia:       'SEC_HACIENDA' as const,
};

describe('Radicación de salida — RegistrarSalidaModal', () => {
  /* 1 · modo respuesta: amarre visible y campos prellenados */
  it('desde el detalle prellena destinatario, asunto y dependencia', () => {
    render(<RegistrarSalidaModal usuario={USUARIO} entrada={ENTRADA} onCerrar={vi.fn()} />);
    expect(screen.getByText(/Registrar salida de respuesta/i)).toBeTruthy();
    expect(screen.getByText('1-WEB-2026-00000045')).toBeTruthy();
    expect((screen.getByLabelText('Destinatario') as HTMLInputElement).value).toBe('María Rincón');
    expect((screen.getByLabelText('Asunto') as HTMLInputElement).value)
      .toBe('Respuesta al radicado 1-WEB-2026-00000045');
    expect((screen.getByLabelText('Dependencia que despacha') as HTMLSelectElement).value)
      .toBe('SEC_HACIENDA');
    expect((screen.getByLabelText('Firmante del oficio') as HTMLInputElement).value).toBe('Laura');
  });

  /* 2 · modo independiente: sin amarre, campos vacíos */
  it('sin entrada es oficio independiente con campos vacíos', () => {
    render(<RegistrarSalidaModal usuario={USUARIO} onCerrar={vi.fn()} />);
    expect(screen.getByText(/Registrar oficio de salida/i)).toBeTruthy();
    expect(screen.queryByText(/Amarrada al radicado/i)).toBeNull();
    expect((screen.getByLabelText('Destinatario') as HTMLInputElement).value).toBe('');
  });

  /* 3 · registrar llama al action y muestra el número 2-SAL */
  it('al registrar muestra el número de salida generado', async () => {
    vi.mocked(registrarSalida).mockResolvedValue({
      salidaId: '2-SAL-2026-00000012',
      consecutivo: 12,
    });
    render(<RegistrarSalidaModal usuario={USUARIO} entrada={ENTRADA} onCerrar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Registrar salida$/i }));

    await waitFor(() => expect(screen.getByText('2-SAL-2026-00000012')).toBeTruthy());
    expect(vi.mocked(registrarSalida)).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoSalida:        'RESPUESTA',
        radicadoEntradaId: '1-WEB-2026-00000045',
        dependenciaOrigen: 'SEC_HACIENDA',
      }),
      { uid: 'uid-laura', nombre: 'Laura' },
    );
  });

  /* 4 · el error del action se muestra */
  it('muestra el mensaje cuando el action falla', async () => {
    vi.mocked(registrarSalida).mockRejectedValue(new Error('El destinatario es obligatorio.'));
    render(<RegistrarSalidaModal usuario={USUARIO} entrada={ENTRADA} onCerrar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Registrar salida$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/destinatario es obligatorio/i));
  });
});
