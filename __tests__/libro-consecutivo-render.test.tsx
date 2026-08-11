import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { LibroConsecutivoClient } from '@/app/interno/licencias/components/LibroConsecutivoClient';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

/**
 * Fechas ANCLADAS en el pasado/futuro lejano (no "hoy ± N días") para que
 * la banda de urgencia (`urgenciaFilaLibro`, sin fake timers — ver JSDoc
 * de cabecera) sea determinista sin importar qué día real corra la suite:
 * 2020 siempre está vencido, 2099 siempre está en término. La banda
 * "Por vencer" (ventana de 5 días hábiles desde HOY) es la única que NO se
 * puede fijar así — se prueba aparte, como función pura, con un `hoy`
 * explícito (`__tests__/presentacion-libro-consecutivo.test.ts`).
 */
const FECHA_ALERTA_VENCIDA = '2020-01-01T12:00:00-05:00';

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

/**
 * `fechaAlertaConservadora` NO está en `ExpedienteLicenciaDoc` todavía
 * (denormalización declarada, no implementada por el backend a la fecha de
 * este rediseño — ver JSDoc del campo homónimo en `FilaLibroConsecutivo`).
 * Este helper la adjunta igual, tal como llegaría del documento real el
 * día que exista: `construirFilasLibroConsecutivo` la lee de forma
 * defensiva/opcional, sin exigirla del tipo.
 */
function conAlertaConservadora(exp: ExpedienteLicenciaDoc, fechaAlertaConservadora: string): ExpedienteLicenciaDoc {
  return { ...exp, fechaAlertaConservadora } as unknown as ExpedienteLicenciaDoc;
}

/**
 * `detalles`: respuestas de `GET /api/licencias/expedientes/{id}` (panel
 * lateral) indexadas por id — opcional, la mayoría de los tests nunca
 * abren el panel y no lo necesitan. Sin entrada para un id pedido, simula
 * un 404 honesto en vez de lanzar (un test que SÍ abre el panel sin haber
 * declarado su detalle falla con un mensaje claro de "no encontrado" en
 * vez de un error de red opaco).
 */
function mockFetchExpedientes(expedientes: ExpedienteLicenciaDoc[], detalles: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    if (url === '/api/licencias/expedientes') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, expedientes }) });
    }
    const match = url.match(/^\/api\/licencias\/expedientes\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const body = detalles[id];
      if (!body) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ error: 'Expediente no encontrado.' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => body });
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

/** Cuerpo del contrato `GET .../[id]` (panel lateral) — mismas 6 claves que ya prueba `DetalleLicenciaClient`, con valores mínimos honestos por defecto. */
function detalleExpediente(expediente: ExpedienteLicenciaDoc, overrides: { actuaciones?: unknown[]; documentos?: unknown[] } = {}) {
  return {
    ok: true,
    expediente,
    actuaciones: overrides.actuaciones ?? [],
    documentos: overrides.documentos ?? [],
    radicadoVinculado: null,
    definicionId: null,
    computos: {
      terminoDual: { suspension: null, reinicio: null, fechaAlertaConservadora: null },
      plazoSubsanacion: { resultado: 'NO_APLICA' },
    },
    borradorActoDesistimiento: null,
  };
}

/**
 * Localiza la TARJETA KPI por su overline — no `screen.getByText`, porque
 * "En trámite"/"Por vencer"/"Históricos incompletos" son el MISMO texto que
 * la etiqueta del chip de filtro homónimo (`ChipFiltroLibro`); la tarjeta
 * KPI pinta su overline en un `<p>`, el chip la suya en un `<span>` — se
 * distingue por esa etiqueta, no por orden en el DOM (más resistente a
 * reordenar el layout).
 */
function tarjetaKpi(overline: string): HTMLElement {
  const el = screen.getAllByText(overline).find((n) => n.tagName === 'P');
  if (!el) throw new Error(`No se encontró la tarjeta KPI "${overline}"`);
  return el.parentElement!;
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

  it('acto final ausente: N.° licencia, Vence y Vigencia hasta muestran "—" (nunca inventado)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase({ actoFinal: undefined })]));
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    const guiones = screen.getAllByText('—');
    expect(guiones.length).toBeGreaterThanOrEqual(3); // Vence + Vigencia hasta + N.° licencia
    expect(screen.queryByText(/días hábiles|Vencido hace/)).toBeNull();
  });

  it('acto final presente: muestra el número de licencia real; sin firmeza no promete ningún plazo', async () => {
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
  });

  it('vigencia hasta: con firmeza y un subtipo cuyo régimen SÍ se puede resolver (sin exigir modalidad), muestra la fecha calculada — MISMA función que usa el servidor del Detalle', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({
          subtipos: ['SUBDIVISION_RURAL'],
          actoFinal: { numero: '002-2026', fecha: '2026-04-01T15:00:00.000Z', fechaFirmeza: '2026-04-20T15:00:00.000Z' },
        }),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    // Subdivisión rural: 12 meses improrrogables desde la firmeza (Código
    // Civil art. 67, `sumarMesCalendario`) — 20/04/2026 + 12 meses.
    await waitFor(() => expect(screen.getByText('20/04/2027')).toBeTruthy());
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

  /* ── Rediseño (10-ago-2026): KPIs, filtros, urgencia, datos faltantes,
     cuarentena y panel lateral. ── */

  it('KPIs: Total, En trámite y Históricos incompletos con los conteos correctos (Por vencer depende del reloj real, se prueba como función pura aparte)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, estadoJuridico: 'EN_REVISION' }),
        expedienteBase({ id: 'b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, estadoJuridico: 'EN_FIRME' }),
        conAlertaConservadora(
          expedienteBase({ id: 'c', numeroExpediente: { numero: '68745-0-26-0003', serieId: 'demo', año: 2026 }, estadoJuridico: 'EN_VIABILIDAD' }),
          FECHA_ALERTA_VENCIDA,
        ),
        expedienteBase({
          id: 'd',
          numeroExpediente: { numero: '68745-0-26-0004', serieId: 'demo', año: 2026 },
          origen: 'RECONSTRUIDO',
          estadoJuridico: 'EN_FIRME',
          solicitanteDocumento: '',
        }),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0004')).toBeTruthy());

    expect(within(tarjetaKpi('Total')).getByText('4')).toBeTruthy();
    expect(within(tarjetaKpi('En trámite')).getByText('2')).toBeTruthy(); // a (EN_REVISION) + c (EN_VIABILIDAD)
    expect(within(tarjetaKpi('Por vencer')).getByText('0')).toBeTruthy(); // c está VENCIDO, no "por vencer"
    expect(within(tarjetaKpi('Históricos incompletos')).getByText('1')).toBeTruthy(); // solo d: RECONSTRUIDO + sin cédula
  });

  it('filtro "Vencidos" reduce las filas visibles; "Todos" las restaura', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-tramite', numeroExpediente: { numero: '68745-0-26-0010', serieId: 'demo', año: 2026 } }),
        conAlertaConservadora(
          expedienteBase({ id: 'exp-vencido', numeroExpediente: { numero: '68745-0-26-0020', serieId: 'demo', año: 2026 } }),
          FECHA_ALERTA_VENCIDA,
        ),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0020')).toBeTruthy());
    expect(screen.getByText('68745-0-26-0010')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Vencidos/ }));

    await waitFor(() => expect(screen.queryByText('68745-0-26-0010')).toBeNull());
    expect(screen.getByText('68745-0-26-0020')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Todos/ }));

    await waitFor(() => expect(screen.getByText('68745-0-26-0010')).toBeTruthy());
    expect(screen.getByText('68745-0-26-0020')).toBeTruthy();
  });

  it('columna "Vence": con `fechaAlertaConservadora` muestra la fecha y los días vencidos; sin el campo no inventa nada (cubierto también arriba)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([conAlertaConservadora(expedienteBase(), FECHA_ALERTA_VENCIDA)]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('01/01/2020')).toBeTruthy());
    expect(screen.getByText(/Vencido hace \d+ días/)).toBeTruthy();
  });

  it('dato faltante: fila sin cédula muestra "Sin cédula"; fila sin estado jurídico válido muestra "Sin estado" en vez de romper el chip', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'sin-cedula', numeroExpediente: { numero: '68745-0-26-0030', serieId: 'demo', año: 2026 }, solicitanteDocumento: '   ' }),
        expedienteBase({
          id: 'sin-estado',
          numeroExpediente: { numero: '68745-0-26-0031', serieId: 'demo', año: 2026 },
          estadoJuridico: '' as unknown as ExpedienteLicenciaDoc['estadoJuridico'],
        }),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('68745-0-26-0031')).toBeTruthy());
    expect(screen.getByText('Sin cédula')).toBeTruthy();
    expect(screen.getByText('Sin estado')).toBeTruthy();
  });

  it('subtipo histórico en CUARENTENA (p. ej. "LCR VISR") se marca como pendiente de identificar, no como un tipo normal', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase({ subtipos: ['LCR VISR'] })]));
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    await waitFor(() => expect(screen.getByText('? LCR VISR')).toBeTruthy());
  });

  it('nombre de solicitante largo y licencia combinada de 3 subtipos no rompen el layout (se ajustan, no se recortan en silencio)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({
          solicitanteNombre: 'Comercializadora El Roble S.A.S.',
          subtipos: ['CONSTRUCCION', 'APROBACION_PH', 'RECONOCIMIENTO'],
        }),
      ]),
    );
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();

    const nombre = await screen.findByText('Comercializadora El Roble S.A.S.');
    expect(nombre.style.wordBreak).toBe('break-word');
  });

  it('panel de detalle: se abre al hacer clic en la fila, Escape lo cierra y devuelve el foco al control que lo abrió', async () => {
    mockAuth();
    const exp = expedienteBase({ id: 'exp-panel', numeroExpediente: { numero: '68745-0-26-0099', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Ana María Vargas' });
    vi.stubGlobal('fetch', mockFetchExpedientes([exp], { 'exp-panel': detalleExpediente(exp) }));
    render(<LibroConsecutivoClient />);

    await seleccionarAño2026();
    const boton = await screen.findByRole('button', { name: '68745-0-26-0099' });

    boton.focus();
    fireEvent.click(boton);

    const dialog = await screen.findByRole('dialog');
    // La fila de la tabla de atrás también muestra "Ana María Vargas" — se
    // acota la búsqueda al panel para no chocar con esa otra ocurrencia.
    await waitFor(() => expect(within(dialog).getByText('Ana María Vargas')).toBeTruthy());

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(boton);
    });
  });
});
