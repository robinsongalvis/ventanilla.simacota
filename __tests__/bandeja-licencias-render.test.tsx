import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BandejaLicenciasClient } from '@/app/interno/licencias/components/BandejaLicenciasClient';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Buscador rápido de la Bandeja de Licencias — mismo pedido/función pura
   que el Libro Consecutivo (`__tests__/libro-consecutivo-render.test.tsx`,
   `coincideBusquedaLibro`). Este archivo cubre lo que es propio de la
   Bandeja: no construye `FilaLibroConsecutivo` (pasa por
   `camposBusquedaDesdeExpediente`), no tiene chips de filtro ni selector
   de año — la búsqueda es la ÚNICA forma de acotar la lista aquí.
══════════════════════════════════════════════════════════════ */

const ETIQUETA_BUSCADOR =
  'Buscar en la bandeja de licencias por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado';

function mockAuth(): void {
  const usuario: UsuarioAutenticado = {
    uid: 'u1',
    email: 'planeacion@simacota.gov.co',
    nombre: 'Funcionaria de Planeación',
    rol: 'FUNCIONARIO',
    tenantId: 'SEC_PLANEACION',
  };
  vi.mocked(useAuth).mockReturnValue({
    usuario,
    cargando: false,
    error: null,
    cerrarSesion: vi.fn(),
  } satisfies UseAuthReturn);
}

function expedienteBase(overrides: Partial<ExpedienteLicenciaDoc> = {}): ExpedienteLicenciaDoc {
  return {
    id: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    tramiteId: 'LICENCIA_CONSTRUCCION_PARCIAL',
    estado: 'RADICADO',
    solicitanteNombre: 'Carlos Alberto Rojas',
    solicitanteDocumento: '91234567',
    contexto: {},
    aportes: [],
    radicadoId: null,
    creadoEn: '2026-03-10T15:00:00.000Z',
    actualizadoEn: '2026-03-10T15:00:00.000Z',
    numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 },
    subtipos: ['CONSTRUCCION'],
    origen: 'REAL',
    estadoJuridico: 'EN_REVISION',
    esPrueba: false,
    ...overrides,
  };
}

function mockFetchExpedientes(expedientes: ExpedienteLicenciaDoc[]) {
  return vi.fn((url: string) => {
    if (url === '/api/licencias/expedientes') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, expedientes }) });
    }
    /* El roll-up del vigía (`PanelVigilanciaTermino`) consulta su propio
       endpoint. Se responde «nunca ha corrido» porque estas pruebas son del
       BUSCADOR: lo que importa es que el panel no rompa la bandeja. */
    if (url === '/api/licencias/vigilancia-termino') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ultimaCorrida: null, nuncaHaCorrido: true }) });
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

describe('BandejaLicenciasClient — buscador rápido', () => {
  it('campo accesible por su etiqueta, tipo "search", enlazado a la tabla por aria-controls', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    render(<BandejaLicenciasClient />);

    const campo = await screen.findByLabelText(ETIQUETA_BUSCADOR);
    expect(campo.getAttribute('type')).toBe('search');
    expect(campo.getAttribute('aria-controls')).toBe('tabla-bandeja-licencias');
  });

  it('filtra por nombre del solicitante, insensible a acentos/mayúsculas', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, solicitanteNombre: 'María Gálvez' }),
        expedienteBase({ id: 'exp-b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Pedro Ruiz' }),
      ]),
    );
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0002')).toBeTruthy());

    const campo = screen.getByLabelText(ETIQUETA_BUSCADOR);
    fireEvent.change(campo, { target: { value: 'MARIA GALVEZ' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    expect(screen.getByText('68745-0-26-0001')).toBeTruthy();
    expect(screen.getByText('1 resultado para "MARIA GALVEZ"')).toBeTruthy();
  });

  it('filtra por matrícula inmobiliaria del predio (no una columna visible de la tabla)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, predio: { matriculaInmobiliaria: '321-51890' } }),
        expedienteBase({ id: 'exp-b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 } }),
      ]),
    );
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0002')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: '321-51890' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    expect(screen.getByText('68745-0-26-0001')).toBeTruthy();
  });

  it('filtra por número de radicado vinculado', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, radicadoId: '1-110-202603-00042' }),
        expedienteBase({ id: 'exp-b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, radicadoId: null }),
      ]),
    );
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0002')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: '00042' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    expect(screen.getByText('68745-0-26-0001')).toBeTruthy();
  });

  it('filtra por estado jurídico (etiqueta legible)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES' }),
        expedienteBase({ id: 'exp-b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, estadoJuridico: 'EN_REVISION' }),
      ]),
    );
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0002')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: 'acta de observaciones' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    // exp-a (CON_ACTA_DE_OBSERVACIONES) también aparece en el KPI "esperando
    // respuesta hace más tiempo" — se acota la aserción a la TABLA (no
    // afectada por ese KPI, que corre sobre `expedientes` completo) para no
    // chocar con esa segunda ocurrencia del mismo número.
    const tabla = document.getElementById('tabla-bandeja-licencias')!;
    expect(within(tabla).getByText('68745-0-26-0001')).toBeTruthy();
  });

  it('KPIs no cambian con la búsqueda activa (siguen sobre el total de expedientes)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, estadoJuridico: 'EN_REVISION', solicitanteNombre: 'Alguien Distinto' }),
        expedienteBase({ id: 'exp-b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, estadoJuridico: 'EN_REVISION', solicitanteNombre: 'Alguien Más' }),
      ]),
    );
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0002')).toBeTruthy());
    expect(screen.getByText('2', { selector: 'p' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: 'Distinto' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    expect(screen.getByText('2', { selector: 'p' })).toBeTruthy(); // "En trámite" sigue en 2
  });

  it('sin coincidencias: muestra el término buscado y un botón para limpiar (nunca una tabla vacía muda)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: 'no-existe-este-termino' } });

    await waitFor(() => expect(screen.getByText('Sin resultados para "no-existe-este-termino"')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
  });

  it('expediente sin cédula ni radicado vinculado (histórico feo) sigue siendo localizable por nombre', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({
          solicitanteDocumento: '',
          radicadoId: null,
          solicitanteNombre: 'Comercializadora y Distribuidora El Roble S.A.S.',
          origen: 'RECONSTRUIDO',
        }),
      ]),
    );
    render(<BandejaLicenciasClient />);
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: 'roble' } });

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
  });

  it('con la bandeja vacía (0 expedientes), el buscador no muestra el estado "sin resultados de búsqueda"', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([]));
    render(<BandejaLicenciasClient />);

    await waitFor(() => expect(screen.getByText('Sin expedientes aún — radica el primero')).toBeTruthy());
    fireEvent.change(screen.getByLabelText(ETIQUETA_BUSCADOR), { target: { value: 'cualquier cosa' } });

    expect(screen.getByText('Sin expedientes aún — radica el primero')).toBeTruthy();
    expect(screen.queryByText(/Sin resultados para/)).toBeNull();
  });
});
