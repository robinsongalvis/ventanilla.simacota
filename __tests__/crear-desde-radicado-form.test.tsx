import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CrearDesdeRadicadoModal } from '@/app/interno/licencias/components/CrearDesdeRadicadoModal';
import type { RadicadoCandidato } from '@/app/api/licencias/radicados-candidatos/route';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Bloque A·A4 — modal "Crear desde radicado" (`CrearDesdeRadicadoModal`),
   handoff radicado⇄expediente. Consume `GET /api/licencias/radicados-
   candidatos` (selector) y `POST /api/licencias/expedientes/desde-
   radicado` (creación + vínculo).
══════════════════════════════════════════════════════════════ */

const CANDIDATOS: RadicadoCandidato[] = [
  {
    radicadoId: '1-110-202608-00000123',
    tipoSolicitud: 'Licencia de construcción',
    solicitanteNombre: 'Carlos Alberto Rojas',
    fechaRadicado: '2026-08-01T15:00:00.000Z',
  },
  {
    radicadoId: '1-110-202608-00000456',
    tipoSolicitud: 'Acto de reconocimiento',
    solicitanteNombre: 'María Fernanda Suárez',
    fechaRadicado: '2026-08-03T15:00:00.000Z',
  },
];

function mockFetchCandidatos(radicados: RadicadoCandidato[] = CANDIDATOS) {
  return vi.fn((url: string) => {
    if (url === '/api/licencias/radicados-candidatos') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, radicados }) });
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

describe('Crear desde radicado — selector de candidatos', () => {
  it('muestra los candidatos con radicado, solicitante y tipo de solicitud', async () => {
    vi.stubGlobal('fetch', mockFetchCandidatos());
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    expect(screen.getByText('Cargando radicados…')).toBeTruthy();

    await waitFor(() => expect(screen.getByText('1-110-202608-00000123')).toBeTruthy());
    const lista = screen.getByRole('radiogroup', { name: 'Radicados candidatos' });
    expect(within(lista).getByText('Carlos Alberto Rojas')).toBeTruthy();
    expect(within(lista).getByText(/Licencia de construcción/)).toBeTruthy();

    expect(within(lista).getByText('1-110-202608-00000456')).toBeTruthy();
    expect(within(lista).getByText('María Fernanda Suárez')).toBeTruthy();
  });

  it('estado vacío: sin radicados de Planeación pendientes de expediente', async () => {
    vi.stubGlobal('fetch', mockFetchCandidatos([]));
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('No hay radicados de Planeación pendientes de expediente.')).toBeTruthy());
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('muestra el error del servidor si falla la carga de candidatos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Tu rol no permite consultar radicados de Planeación.' }),
    }));
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/no permite consultar radicados/i));
  });
});

describe('Crear desde radicado — envío y errores del servidor', () => {
  async function seleccionarPrimerCandidatoYSubtipo() {
    await waitFor(() => expect(screen.getByText('1-110-202608-00000123')).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: /1-110-202608-00000123/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Licencia de construcción/i }));
    // La figura CONSTRUCCION exige modalidad (art. 2.2.6.1.1.7, ADR-0035):
    // sin marcarla el formulario ya no envía.
    fireEvent.click(screen.getByRole('checkbox', { name: /Obra nueva/i }));
  }

  it('exige seleccionar un radicado y un subtipo antes de enviar', async () => {
    const fetchMock = mockFetchCandidatos();
    vi.stubGlobal('fetch', fetchMock);
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('1-110-202608-00000123')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Crear expediente$/i }));

    expect(screen.getByText('Selecciona el radicado de origen.')).toBeTruthy();
    expect(screen.getByText('Selecciona al menos un subtipo (figura normativa).')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo el GET de candidatos, nunca el POST
  });

  it('envía el radicadoId y los subtipos seleccionados al servidor', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/licencias/radicados-candidatos') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, radicados: CANDIDATOS }) });
      }
      if (url === '/api/licencias/expedientes/desde-radicado' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            ok: true,
            expediente: { id: 'exp-1', numeroExpediente: { numero: 'DEMO-26-abc12345' } },
            vinculoExpediente: { expedienteId: 'exp-1', numeroExpediente: 'DEMO-26-abc12345', fecha: '2026-08-08T10:00:00.000Z' },
            constanciaEnviada: true,
          }),
        });
      }
      throw new Error(`fetch inesperado en el test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    await seleccionarPrimerCandidatoYSubtipo();
    fireEvent.click(screen.getByRole('button', { name: /^Crear expediente$/i }));

    await waitFor(() => expect(screen.getByText('DEMO-26-abc12345')).toBeTruthy());
    expect(screen.getByText(/Se envió al solicitante el acuse de recibo de su solicitud\./)).toBeTruthy();

    const llamadaPost = fetchMock.mock.calls.find(([url]) => url === '/api/licencias/expedientes/desde-radicado');
    expect(llamadaPost).toBeTruthy();
    const body = JSON.parse((llamadaPost![1] as RequestInit).body as string);
    expect(body.radicadoId).toBe('1-110-202608-00000123');
    expect(body.subtipos).toEqual(['CONSTRUCCION']);
  });

  it('constancia NO enviada: muestra la advertencia explícita (revisión QA 8-ago) en vez de omitirlo', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/licencias/radicados-candidatos') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, radicados: CANDIDATOS }) });
      }
      if (url === '/api/licencias/expedientes/desde-radicado' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            ok: true,
            expediente: { id: 'exp-2', numeroExpediente: { numero: 'DEMO-26-sinCorreo' } },
            vinculoExpediente: { expedienteId: 'exp-2', numeroExpediente: 'DEMO-26-sinCorreo', fecha: '2026-08-08T10:00:00.000Z' },
            constanciaEnviada: false,
          }),
        });
      }
      throw new Error(`fetch inesperado en el test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    await seleccionarPrimerCandidatoYSubtipo();
    fireEvent.click(screen.getByRole('button', { name: /^Crear expediente$/i }));

    await waitFor(() => expect(screen.getByText('DEMO-26-sinCorreo')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toMatch(/Acuse de recibo NO enviado al ciudadano/);
    expect(screen.queryByText(/Se envió al solicitante el acuse de recibo de su solicitud\./)).toBeNull();
  });

  it('muestra el 409 de "radicado ya vinculado" tal cual llega del servidor', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/licencias/radicados-candidatos') {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, radicados: CANDIDATOS }) });
      }
      if (url === '/api/licencias/expedientes/desde-radicado') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'El radicado ya está vinculado al expediente "exp-9" (DEMO-26-existente); no procede vincular otro.',
          }),
        });
      }
      throw new Error(`fetch inesperado en el test: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<CrearDesdeRadicadoModal onCerrar={vi.fn()} />);

    await seleccionarPrimerCandidatoYSubtipo();
    fireEvent.click(screen.getByRole('button', { name: /^Crear expediente$/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toMatch(/ya está vinculado al expediente "exp-9"/));
  });

  it('permite cancelar sin enviar', async () => {
    const fetchMock = mockFetchCandidatos();
    vi.stubGlobal('fetch', fetchMock);
    const onCerrar = vi.fn();
    render(<CrearDesdeRadicadoModal onCerrar={onCerrar} />);

    await waitFor(() => expect(screen.getByText('1-110-202608-00000123')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(onCerrar).toHaveBeenCalled();
  });
});
