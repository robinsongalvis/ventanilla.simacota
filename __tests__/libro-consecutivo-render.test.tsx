import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LibroConsecutivoClient } from '@/app/interno/licencias/components/LibroConsecutivoClient';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Bloque C — Libro consecutivo. Cubre lo que pide el encargo: la tabla
   renderiza las filas mapeadas (incl. "—" para acto final ausente y el
   chip PRUEBA), el selector de año filtra, y los estados honestos de
   carga/error/vacío. El generador de CSV en sí ya está probado como
   función pura en `__tests__/presentacion-libro-consecutivo.test.ts`.

   Deliberadamente SIN `vi.useFakeTimers()`: el año por defecto del
   componente es `new Date().getFullYear()` (reloj real) y las utilidades
   de `@testing-library/react` (`waitFor`) dependen de temporizadores
   reales para su polling — con temporizadores falsos, `waitFor` se
   congela y el test agota el timeout sin que el reloj falso avance. En
   vez de fijar el reloj, cada test SELECCIONA el año explícitamente en el
   combo (`fireEvent.change`), que siempre incluye los años reales de los
   fixtures (`añosDisponiblesLibro` los deriva del dato, no del reloj) —
   así el resultado es determinista sin importar el año real de la
   máquina que corre la suite.
══════════════════════════════════════════════════════════════ */

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
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

/** Espera a que cargue y selecciona el año 2026 (siempre disponible: viene de los fixtures, no del reloj real). */
async function seleccionarAño2026(): Promise<void> {
  const select = await screen.findByLabelText('Año del libro consecutivo');
  await waitFor(() => expect(screen.queryByText('Cargando libro consecutivo…')).toBeNull());
  fireEvent.change(select, { target: { value: '2026' } });
}

describe('LibroConsecutivoClient', () => {
  it('estado de carga: muestra "Cargando libro consecutivo…"', () => {
    mockAuth();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // nunca resuelve
    render(<LibroConsecutivoClient />);
    expect(screen.getByText('Cargando libro consecutivo…')).toBeTruthy();
  });

  it('renderiza las filas del año seleccionado mapeadas (mono, fecha, solicitante, subtipos, estado)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    expect(screen.getByText('10/03/2026')).toBeTruthy();
    expect(screen.getByText('Carlos Alberto Rojas')).toBeTruthy();
    expect(screen.getByText('91234567')).toBeTruthy();
    expect(screen.getByText('Licencia de construcción')).toBeTruthy();
    expect(screen.getByText('En revisión')).toBeTruthy();
  });

  it('acto final ausente: N.° licencia y fecha de firmeza muestran "—" (nunca inventado)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase({ actoFinal: undefined })]));
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    const guiones = screen.getAllByText('—');
    expect(guiones.length).toBeGreaterThanOrEqual(2); // N.° licencia + fecha firmeza
  });

  it('acto final presente: muestra número de licencia y fecha de firmeza reales', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ actoFinal: { numero: '002-2026', fecha: '2026-04-01T15:00:00.000Z', fechaFirmeza: '2026-04-20T15:00:00.000Z' } }),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('002-2026')).toBeTruthy());
    expect(screen.getByText('20/04/2026')).toBeTruthy();
  });

  it('expediente de prueba: muestra el chip "Prueba"', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase({ esPrueba: true })]));
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    expect(screen.getByText('Prueba')).toBeTruthy();
  });

  it('selector de año filtra: cambiar de año oculta expedientes de otros años y muestra el estado vacío honesto', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-2026', creadoEn: '2026-03-10T15:00:00.000Z', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 } }),
        expedienteBase({ id: 'exp-2025', creadoEn: '2025-06-01T15:00:00.000Z', numeroExpediente: { numero: '68745-0-25-0050', serieId: 'demo', año: 2025 } }),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    expect(screen.queryByText('68745-0-25-0050')).toBeNull();

    fireEvent.change(screen.getByLabelText('Año del libro consecutivo'), { target: { value: '2025' } });

    await waitFor(() => expect(screen.getByText('68745-0-25-0050')).toBeTruthy());
    expect(screen.queryByText('68745-0-26-0001')).toBeNull();
  });

  it('año sin expedientes: muestra "Sin expedientes en {año}" para el año seleccionado', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([]));
    render(<LibroConsecutivoClient />);

    // Sin datos, `añosDisponiblesLibro` solo ofrece el año real de la
    // máquina — se lee del propio combo en vez de asumir cuál es, para
    // que el test no dependa del reloj del entorno que lo corre.
    const select = (await screen.findByLabelText('Año del libro consecutivo')) as HTMLSelectElement;
    await waitFor(() => expect(screen.queryByText('Cargando libro consecutivo…')).toBeNull());
    const añoPorDefecto = select.value;

    expect(screen.getByText(`Sin expedientes en ${añoPorDefecto}`)).toBeTruthy();
  });

  it('error del servidor: muestra el mensaje de error con role="alert"', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 403, json: async () => ({ error: 'Tu rol no permite consultar expedientes de licencias.' }) })),
    );
    render(<LibroConsecutivoClient />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Tu rol no permite consultar expedientes de licencias.')).toBeTruthy();
  });

  it('aviso permanente de alcance histórico siempre visible', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([]));
    render(<LibroConsecutivoClient />);

    expect(screen.getByText(/los expedientes históricos del Excel \(2022–2026\) se incorporarán con la migración/)).toBeTruthy();
  });
});
