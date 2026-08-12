import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Espera a que cargue y selecciona el año pedido (siempre disponible: viene de los fixtures, no del reloj real). */
async function seleccionarAño(año: number): Promise<void> {
  const select = await screen.findByLabelText('Año del libro consecutivo');
  await waitFor(() => expect(screen.queryByText('Cargando libro consecutivo…')).toBeNull());
  fireEvent.change(select, { target: { value: String(año) } });
}

/** Envoltorio histórico — las ~10 pruebas que ya lo usaban no cambian ni una letra. */
async function seleccionarAño2026(): Promise<void> {
  await seleccionarAño(2026);
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

  it('aviso permanente de alcance histórico siempre visible, en tiempo PASADO (la migración ya ocurrió el 11-ago-2026)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([]));
    render(<LibroConsecutivoClient />);

    // El aviso anunciaba una migración FUTURA («se incorporarán»). Se ejecutó el
    // 11-ago-2026 y el texto quedó mintiendo — hallazgo 3 de la verificación E2E
    // en stage. Esta prueba fija el tiempo verbal: si alguien reintroduce la
    // promesa a futuro, falla aquí.
    expect(screen.getByText(/migrados el 11-ago-2026/)).toBeTruthy();
    expect(screen.getByText(/Históricos incompletos.*los agrupa/)).toBeTruthy();
    expect(screen.queryByText(/se incorporarán con la migración/)).toBeNull();
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

  /* ── Buscador rápido (localizar por radicado, nombre, matrícula, código,
     estado y abrir desde ahí) ── */

  it('buscador rápido: campo accesible por su etiqueta, enlazado a la tabla', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();

    const campo = await screen.findByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    expect(campo.getAttribute('type')).toBe('search');
    expect(campo.getAttribute('aria-controls')).toBe('tabla-libro-consecutivo');
  });

  it('buscador rápido: filtra por nombre del solicitante, insensible a acentos/mayúsculas', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, solicitanteNombre: 'María Gálvez' }),
        expedienteBase({ id: 'exp-b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Pedro Ruiz' }),
      ]),
    );
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0002')).toBeTruthy());

    const campo = screen.getByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    fireEvent.change(campo, { target: { value: 'MARIA GALVEZ' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    expect(screen.getByText('68745-0-26-0001')).toBeTruthy();
    expect(screen.getByText('1 resultado para "MARIA GALVEZ"')).toBeTruthy();
  });

  it('buscador rápido: se combina con el filtro de chip activo (busca DENTRO del filtro, no lo reemplaza)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'exp-tramite', numeroExpediente: { numero: '68745-0-26-0010', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Ana Vencido' }),
        conAlertaConservadora(
          expedienteBase({ id: 'exp-vencido', numeroExpediente: { numero: '68745-0-26-0020', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Ana Vencido' }),
          FECHA_ALERTA_VENCIDA,
        ),
      ]),
    );
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0020')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /Vencidos/ }));
    await waitFor(() => expect(screen.queryByText('68745-0-26-0010')).toBeNull());

    // "Ana Vencido" aparece en ambos expedientes, pero solo uno está en el
    // filtro "Vencidos" activo — el buscador no debe traer de vuelta al
    // que el chip ya excluyó.
    const campo = screen.getByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    fireEvent.change(campo, { target: { value: 'Ana Vencido' } });

    await waitFor(() => expect(screen.getByText('68745-0-26-0020')).toBeTruthy());
    expect(screen.queryByText('68745-0-26-0010')).toBeNull();
  });

  it('buscador rápido: KPIs y conteos de los chips NO cambian con la búsqueda activa (siguen reflejando el año completo)', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ id: 'a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Alguien Distinto' }),
        expedienteBase({ id: 'b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'demo', año: 2026 }, solicitanteNombre: 'Alguien Más' }),
      ]),
    );
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();
    await waitFor(() => expect(within(tarjetaKpi('Total')).getByText('2')).toBeTruthy());

    const campo = screen.getByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    fireEvent.change(campo, { target: { value: 'Distinto' } });

    await waitFor(() => expect(screen.queryByText('68745-0-26-0002')).toBeNull());
    expect(within(tarjetaKpi('Total')).getByText('2')).toBeTruthy();
  });

  it('buscador rápido: sin coincidencias muestra el término buscado y un botón para limpiar (nunca una tabla vacía muda)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());

    const campo = screen.getByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    fireEvent.change(campo, { target: { value: 'no-existe-este-termino' } });

    await waitFor(() => expect(screen.getByText('Sin resultados para "no-existe-este-termino"')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
    expect((campo as HTMLInputElement).value).toBe('');
  });

  it('buscador rápido: encuentra por matrícula inmobiliaria (dato del predio, no una columna de la tabla)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase({ predio: { matriculaInmobiliaria: '321-51890' } })]));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());

    const campo = screen.getByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    fireEvent.change(campo, { target: { value: '321-51890' } });

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
  });

  it('buscador rápido: expediente sin cédula (histórico feo) sigue siendo localizable por nombre/expediente', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetchExpedientes([
        expedienteBase({ solicitanteDocumento: '', solicitanteNombre: 'Comercializadora y Distribuidora El Roble S.A.S.' }),
      ]),
    );
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();
    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());

    const campo = screen.getByLabelText(
      'Buscar en el libro consecutivo por expediente, radicado, solicitante, documento, matrícula inmobiliaria, tipo o estado',
    );
    fireEvent.change(campo, { target: { value: 'roble' } });

    await waitFor(() => expect(screen.getByText('68745-0-26-0001')).toBeTruthy());
  });
});

/* ══════════════════════════════════════════════════════════════
   Colisión de radicado e impresión del libro (12-ago-2026).
══════════════════════════════════════════════════════════════ */

/** Las dos filas del caso real: mismo número legal, distinto solicitante. */
function parEnColision(): ExpedienteLicenciaDoc[] {
  const numero = { numero: '68745-0-25-0037', serieId: 'historico', año: 2025, colision: true };
  return [
    expedienteBase({
      id: 'col-a',
      solicitanteNombre: 'Ana Lucía Avilés Pérez',
      creadoEn: '2025-09-17T15:00:00.000Z',
      numeroExpediente: { ...numero },
    }),
    expedienteBase({
      id: 'col-b',
      solicitanteNombre: 'Pedro Nel Rojas Peña',
      creadoEn: '2025-09-30T15:00:00.000Z',
      numeroExpediente: { ...numero },
    }),
  ];
}

describe('Libro consecutivo — colisión de radicado visible', () => {
  it('marca ambas filas y dice CON QUIÉN colisiona cada una (es lo que se necesita para resolver)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes(parEnColision()));
    render(<LibroConsecutivoClient />);
    await seleccionarAño(2025);

    const marcas = await screen.findAllByRole('note', { name: /Colisión de número de expediente/ });
    expect(marcas).toHaveLength(2);
    const nombresAccesibles = marcas.map((m) => m.getAttribute('aria-label') ?? '');
    // Cada una nombra a la OTRA, nunca a sí misma.
    expect(nombresAccesibles.some((t) => t.includes('Pedro Nel Rojas Peña') && !t.includes('Ana Lucía'))).toBe(true);
    expect(nombresAccesibles.some((t) => t.includes('Ana Lucía Avilés Pérez') && !t.includes('Pedro Nel'))).toBe(true);
    // La regla de negocio viaja con la marca, no en un banner que se aprende a ignorar.
    expect(nombresAccesibles.every((t) => t.includes('No se renumera'))).toBe(true);
  });

  it('el chip "Colisiones" aparece con su conteo y aísla las filas marcadas', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes(parEnColision()));
    render(<LibroConsecutivoClient />);
    await seleccionarAño(2025);

    const chip = await screen.findByRole('button', { name: /Colisiones/ });
    expect(chip.textContent).toContain('2');
    fireEvent.click(chip);
    await waitFor(() => expect(screen.getAllByRole('note', { name: /Colisión/ })).toHaveLength(2));
  });

  it('sin colisiones el chip NO se renderiza (un control permanente en 0 es ruido)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();

    await waitFor(() => expect(screen.queryByText('Cargando libro consecutivo…')).toBeNull());
    expect(screen.queryByRole('button', { name: /Colisiones/ })).toBeNull();
    expect(screen.queryByRole('note', { name: /Colisión/ })).toBeNull();
  });

  it('el filtro se resetea si el conteo de colisiones cae a 0 al cambiar de año (no deja la tabla filtrada por un control invisible)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([...parEnColision(), expedienteBase()]));
    render(<LibroConsecutivoClient />);
    await seleccionarAño(2025);

    fireEvent.click(await screen.findByRole('button', { name: /Colisiones/ }));
    await waitFor(() => expect(screen.getAllByRole('note', { name: /Colisión/ })).toHaveLength(2));

    await seleccionarAño(2026);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Colisiones/ })).toBeNull());
    // La fila de 2026 sigue visible: el filtro volvió a "Todos", no quedó vacía.
    expect(screen.getByText('Carlos Alberto Rojas')).toBeTruthy();
  });
});

describe('Libro consecutivo — impresión A4 horizontal', () => {
  /** Hoja de otra pantalla que persiste con `body * { visibility: hidden }` — ver `HOJAS_IMPRESION_AJENAS`. */
  function inyectarHojaAjena(id: string): HTMLStyleElement {
    const tag = document.createElement('style');
    tag.id = id;
    tag.textContent = '@media print { body * { visibility: hidden !important; } }';
    document.head.appendChild(tag);
    return tag;
  }

  it('inyecta @page landscape y marca el body SOLO durante la impresión, y lo retira después', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    const observado: { landscape: boolean; clase: boolean }[] = [];
    vi.stubGlobal('print', vi.fn(() => {
      observado.push({
        landscape: (document.getElementById('libro-consecutivo-print-styles')?.textContent ?? '').includes('landscape'),
        clase: document.body.classList.contains('imprimiendo-libro-consecutivo'),
      });
    }));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));

    expect(observado).toEqual([{ landscape: true, clase: true }]);
    // Dejar la hoja viva pondría horizontal la SIGUIENTE constancia.
    expect(document.getElementById('libro-consecutivo-print-styles')).toBeNull();
    expect(document.body.classList.contains('imprimiendo-libro-consecutivo')).toBe(false);
  });

  it('REGRESIÓN: apaga las hojas de impresión ajenas que dejarían el libro EN BLANCO, y las restaura', async () => {
    // Camino real: radicar → imprimir constancia (su hoja queda viva para
    // siempre, con `body * { visibility: hidden }`) → pestaña Licencias →
    // Libro → Imprimir. Sin esto salen N hojas vacías.
    const ajena = inyectarHojaAjena('comprobante-print-styles');
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([expedienteBase()]));
    let apagadaDurante: boolean | null = null;
    vi.stubGlobal('print', vi.fn(() => {
      apagadaDurante = (document.getElementById('comprobante-print-styles') as HTMLStyleElement).disabled;
    }));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();

    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));

    expect(apagadaDurante).toBe(true);
    // …y restaurada, para no romper la impresión de la constancia después.
    expect(ajena.disabled).toBe(false);
    ajena.remove();
  });

  it('cada fila expone `data-urgencia` — gancho que el CSS de impresión necesita para oscurecer "Vence" (en papel el ámbar rinde 2,15:1)', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetchExpedientes([conAlertaConservadora(expedienteBase(), FECHA_ALERTA_VENCIDA)]));
    render(<LibroConsecutivoClient />);
    await seleccionarAño2026();

    const fila = await waitFor(() => document.querySelector('#tabla-libro-consecutivo tbody tr')!);
    expect(fila.getAttribute('data-urgencia')).toBe('VENCIDO');
  });
});

describe('Contrato del CSS de impresión del libro', () => {
  const CSS = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

  it('globals.css NO declara una @page global — voltearía las OTRAS 9 superficies que imprimen', () => {
    // La constancia de radicación (190 mm), los sellos, la planilla de
    // reparto y el acto de desistimiento son verticales por diseño. `@page`
    // no admite selectores, así que una regla anónima aquí es global.
    // La forma con NOMBRE (`@page libro { … }`) sí sería acotada y se
    // permite a propósito, por si algún día se añade como refuerzo.
    expect(CSS).not.toMatch(/@page\s*(:[a-z]+\s*)?\{/);
  });

  it('desrecorta la cadena del libro: sin esto la tabla se recorta a la caja de página', () => {
    for (const clase of ['.libro-consecutivo', '.libro-consecutivo__tarjeta', '.libro-consecutivo__scroll']) {
      expect(CSS).toContain(clase);
    }
    expect(CSS).toMatch(/#tabla-libro-consecutivo thead \{\s*display: table-header-group;/);
  });

  it('la franja de urgencia se imprime como BORDE, no como sombra (Chrome no imprime fondos por defecto)', () => {
    expect(CSS).toMatch(/#tabla-libro-consecutivo tbody td:first-child \{[^}]*box-shadow: none/);
    expect(CSS).toMatch(/#tabla-libro-consecutivo tbody td:first-child \{[^}]*border-left-width/);
  });

  it('el texto de "Vence" se oscurece por banda al imprimir (el ámbar rinde 2,15:1)', () => {
    for (const urgencia of ['VENCIDO', 'POR_VENCER', 'EN_TERMINO', 'NEUTRO']) {
      expect(CSS).toContain(`tr[data-urgencia='${urgencia}'] .libro-consecutivo__vence p`);
    }
  });
});
