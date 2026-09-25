import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegistrarSalidaModal } from '@/app/interno/dashboard/components/salidas/RegistrarSalidaModal';
import type { SalidaOficial } from '@/src/types/salida';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — modal de registro de despacho.

   Fase B: el registro va al endpoint /api/salidas/registrar
   (Admin SDK) para poder adjuntar el oficio PDF en el mismo paso.
══════════════════════════════════════════════════════════════ */

const USUARIO = { uid: 'uid-laura', nombre: 'Laura', tenantId: 'VENTANILLA_UNICA' as const };

const ENTRADA = {
  radicadoId:        '1-WEB-2026-00000045',
  solicitanteNombre: 'María Rincón',
  dependencia:       'SEC_HACIENDA' as const,
};

const SALIDA_GENERADA: SalidaOficial = {
  salidaId:      '2-SAL-2026-00000012',
  consecutivo:   12,
  fechaSalida:   '2026-07-06T15:00:00.000Z',
  tipoSalida:    'RESPUESTA',
  radicadoEntradaId: '1-WEB-2026-00000045',
  destinatario:  { nombre: 'María Rincón', entidad: null, email: null, direccion: null },
  asunto:        'Respuesta al radicado 1-WEB-2026-00000045',
  dependenciaOrigen: 'SEC_HACIENDA',
  firmante:      { uid: 'uid-laura', nombre: 'Laura' },
  medioEnvio:    'CORREO',
  registradoPor: { uid: 'uid-laura', nombre: 'Laura' },
  archivoPath:   null,
  archivoNombre: null,
};

function mockFetchOk() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, salidaId: SALIDA_GENERADA.salidaId, salida: SALIDA_GENERADA }),
  } as Response);
}

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

  /* 3 · registrar llama al endpoint con FormData y muestra el 2-SAL */
  it('al registrar muestra el número de salida generado', async () => {
    const fetchMock = mockFetchOk();
    render(<RegistrarSalidaModal usuario={USUARIO} entrada={ENTRADA} onCerrar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Registrar salida$/i }));

    // El número sale dos veces: encabezado y sello de la constancia.
    await waitFor(() =>
      expect(screen.getAllByText('2-SAL-2026-00000012').length).toBeGreaterThanOrEqual(1));

    expect(fetchMock).toHaveBeenCalledWith('/api/salidas/registrar', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get('tipoSalida')).toBe('RESPUESTA');
    expect(body.get('radicadoEntradaId')).toBe('1-WEB-2026-00000045');
    expect(body.get('dependenciaOrigen')).toBe('SEC_HACIENDA');
    expect(body.get('archivo')).toBeNull(); // sin PDF sigue siendo válido
  });

  /* 4 · el PDF adjunto viaja en el mismo FormData */
  it('incluye el oficio PDF cuando se adjunta', async () => {
    const fetchMock = mockFetchOk();
    render(<RegistrarSalidaModal usuario={USUARIO} entrada={ENTRADA} onCerrar={vi.fn()} />);

    const pdf = new File(['%PDF-1.4'], 'oficio_firmado.pdf', { type: 'application/pdf' });
    const inputArchivo = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(inputArchivo, { target: { files: [pdf] } });
    expect(screen.getByText('oficio_firmado.pdf')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Registrar salida$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect((body.get('archivo') as File).name).toBe('oficio_firmado.pdf');
  });

  /* 5 · el error del endpoint se muestra */
  it('muestra el mensaje cuando el endpoint falla', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'El destinatario es obligatorio.' }),
    } as Response);
    render(<RegistrarSalidaModal usuario={USUARIO} entrada={ENTRADA} onCerrar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Registrar salida$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/destinatario es obligatorio/i));
  });
});
