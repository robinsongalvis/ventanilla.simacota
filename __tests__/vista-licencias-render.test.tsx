import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VistaLicencias } from '@/app/interno/dashboard/components/licencias/VistaLicencias';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

/* ══════════════════════════════════════════════════════════════
   Bloque B ("la ventanita") — `VistaLicencias` monta la Bandeja y el
   Detalle del módulo standalone (`app/interno/licencias/**`) EMBEBIDOS
   dentro del panel interno, con navegación por ESTADO LOCAL
   (`expedienteSeleccionado`) en vez de rutas. No hay precedente en el
   repo de testear la visibilidad de un ítem de `SidebarNav` por rol (vive
   privado dentro de `app/interno/dashboard/page.tsx`, sin export) — este
   archivo cubre, como indica el encargo, el propio `VistaLicencias` y las
   props nuevas de `BandejaLicenciasClient`/`DetalleLicenciaClient`
   (`onAbrirExpediente`, `onVolver`) que lo hacen posible.
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
    creadoEn: '2026-08-01T10:00:00.000Z',
    actualizadoEn: '2026-08-01T10:00:00.000Z',
    numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 },
    subtipos: ['CONSTRUCCION'],
    // RECONSTRUIDO mantiene el fixture simple: sin proyección de término
    // ni checklist (definicionId ausente), suficiente para un test de
    // navegación bandeja↔detalle.
    origen: 'RECONSTRUIDO',
    estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA',
    esPrueba: false,
    ...overrides,
  };
}

function mockFetchModulo(expedientes: ExpedienteLicenciaDoc[]) {
  return vi.fn((url: string) => {
    if (url === '/api/licencias/expedientes') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, expedientes }) });
    }
    const match = url.match(/^\/api\/licencias\/expedientes\/([^/]+)$/);
    if (match) {
      const exp = expedientes.find((e) => e.id === match[1]);
      if (!exp) return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          expediente: exp,
          actuaciones: [],
          documentos: [],
          definicionId: null,
          radicadoVinculado: null,
        }),
      });
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

describe('VistaLicencias — Bloque B, Licencias embebida en el panel interno', () => {
  it('sub-pestaña "Bandeja" activa por defecto: renderiza la bandeja embebida', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchModulo([expedienteBase()]));
    render(<VistaLicencias />);

    const tabBandeja = screen.getByRole('tab', { name: 'Bandeja' });
    const tabLibro = screen.getByRole('tab', { name: 'Libro consecutivo' });
    expect(tabBandeja.getAttribute('aria-selected')).toBe('true');
    expect(tabLibro.getAttribute('aria-selected')).toBe('false');

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Bandeja de Licencias' })).toBeTruthy();
  });

  it('sub-pestaña "Libro consecutivo" (Bloque C): monta el Libro Consecutivo real y oculta la bandeja', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchModulo([expedienteBase()]));
    render(<VistaLicencias />);

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());

    fireEvent.click(screen.getByRole('tab', { name: 'Libro consecutivo' }));

    expect(screen.getByRole('heading', { name: 'Libro consecutivo' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Bandeja de Licencias' })).toBeNull();
    // El Libro embebido no repite el enlace "Bandeja de Licencias" de la
    // ruta standalone — aquí es una sub-pestaña, no una página aparte.
    expect(screen.queryByText('Bandeja de Licencias')).toBeNull();

    // Año por defecto = reloj real de la máquina que corre el test, no el
    // 2026 del fixture — se selecciona explícitamente (siempre disponible,
    // `añosDisponiblesLibro` lo deriva del dato) para verificar que el
    // Libro es el componente REAL (con datos), no un cascarón vacío.
    fireEvent.change(screen.getByLabelText('Año del libro consecutivo'), { target: { value: '2026' } });
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
  });

  it('botón "Exportar libro consecutivo ↓" de la Bandeja cambia a la sub-pestaña Libro consecutivo (sin navegar de ruta)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchModulo([expedienteBase()]));
    render(<VistaLicencias />);

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Exportar libro consecutivo ↓' }));

    expect(screen.getByRole('tab', { name: 'Libro consecutivo' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Libro consecutivo' })).toBeTruthy();
  });

  it('callback onAbrirExpediente: clic en una fila de la bandeja abre el detalle embebido (sin navegar de ruta)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchModulo([expedienteBase()]));
    render(<VistaLicencias />);

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /68745-0-26-0001/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Bandeja de Licencias/ })).toBeTruthy());
    expect(screen.getByText('Carlos Alberto Rojas')).toBeTruthy();
    // Las sub-pestañas no aplican mientras se ve un expediente puntual.
    expect(screen.queryByRole('tab', { name: 'Bandeja' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Bandeja de Licencias' })).toBeNull();
  });

  it('onVolver: el botón "← Bandeja de Licencias" del detalle regresa a la bandeja embebida', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchModulo([expedienteBase()]));
    render(<VistaLicencias />);

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /68745-0-26-0001/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Bandeja de Licencias/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Bandeja de Licencias/ }));

    expect(screen.getByRole('tab', { name: 'Bandeja' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Bandeja de Licencias' })).toBeTruthy();
  });
});
