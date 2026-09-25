import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { BandejaLicenciasClient } from '@/app/interno/licencias/components/BandejaLicenciasClient';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';
import { ETIQUETA_NIVEL_TERMINO } from '@/lib/motor-expedientes/semaforo-termino';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

/* ══════════════════════════════════════════════════════════════
   LA COLUMNA «VENCE» ES ALCANZABLE — y esta prueba existe por una regla
   nueva, fijada por el propietario el 31-ago-2026:

   > Cada vez que un dato se persiste «para que la pantalla lo muestre», el
   > mismo PR abre la pantalla o deja la prueba que falla si no la abre.
   > Persistir sin consumidor es la mitad de un trabajo que se cuenta como
   > entero.

   ES LA CUARTA VEZ DE ESTA FAMILIA. `fechaAlertaConservadora` se persistió el
   10-ago-2026 en el documento raíz PRECISAMENTE para que la bandeja pudiera
   pintarla sin lecturas nuevas. El servidor la calculó, la guardó y la envió.
   Y ninguna pantalla la leyó durante veinte días, porque:

     · la cabecera de la bandeja declaraba que NUNCA pintaría un «vence»
       —cierto cuando se escribió, falso desde el 10-ago—;
     · el panel del vigía omitía la fecha por expediente «porque la bandeja ya
       lo muestra en cada fila»;
     · y el comentario de la ruta lo daba por «RESUELTO».

   Tres documentos, tres creencias, cero pantallas. La funcionaria abría la
   bandeja y no podía ver a cuál se le acababa el tiempo sin entrar uno por uno.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · que la columna EXISTA en la tabla;
     · que las cuatro situaciones del semáforo se pinten DISTINTO entre sí;
     · que lo pintado venga de `clasificarFrenteAlTermino` y de las etiquetas
       del correo, no de un cómputo propio de la pantalla.
   Esto NO mira: el criterio del semáforo (`semaforo-termino-compartido.test.ts`),
   ni el cálculo del término (`motor-expedientes-termino.test.ts`), ni que el
   servidor persista el espejo (`expedientes-licencias-*.test.ts`). Si el
   criterio cambia, esta prueba debe seguir verde: aquí solo se vigila que
   ALGUIEN LO PINTE.
══════════════════════════════════════════════════════════════ */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/* Reloj fijo: el semáforo cuenta días hábiles contra «hoy», así que sin
   congelarlo esta prueba caducaría sola. Mediodía de Bogotá en UTC para que no
   dependa de a qué lado de la medianoche corra (local vs. CI en UTC). */
const AHORA = new Date('2026-09-01T17:00:00.000Z');

beforeEach(() => {
  /* `shouldAdvanceTime` NO es un detalle: la bandeja pide sus datos por `fetch`
     y estas pruebas esperan con `findBy*`/`waitFor`, que sondean con timers. Con
     el reloj congelado del todo, el sondeo nunca avanza y las siete pruebas
     mueren en «Test timed out in 5000ms» sin haber comprobado nada — un rojo que
     no habla del código. Con esto, el reloj arranca en `AHORA` y corre a tiempo
     real: los pocos milisegundos de deriva no mueven ningún día hábil. */
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(AHORA);
});

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

function expediente(overrides: Partial<ExpedienteLicenciaDoc> = {}): ExpedienteLicenciaDoc {
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
    creadoEn: '2026-08-03T15:00:00.000Z',
    actualizadoEn: '2026-08-03T15:00:00.000Z',
    numeroExpediente: { numero: '68745-0-26-0001', serieId: 'demo', año: 2026 },
    subtipos: ['CONSTRUCCION'],
    origen: 'REAL',
    estadoJuridico: 'EN_REVISION',
    esPrueba: false,
    ...overrides,
  } as ExpedienteLicenciaDoc;
}

function mockFetch(expedientes: ExpedienteLicenciaDoc[]) {
  return vi.fn((url: string) => {
    if (url === '/api/licencias/expedientes') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true, expedientes }) });
    }
    if (url === '/api/licencias/vigilancia-termino') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ultimaCorrida: null, nuncaHaCorrido: true }) });
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

/**
 * La fila de la TABLA que corresponde a un número de expediente.
 *
 * Se acota a la tabla a propósito: la tarjeta KPI «Con acta de observaciones»
 * también pinta un `NumeroLegal` —el que lleva más tiempo esperando—, así que
 * un `screen.findByText(numero)` a secas encuentra DOS elementos en cuanto el
 * caso de prueba usa `CON_ACTA_DE_OBSERVACIONES`, y falla por ambigüedad sin
 * llegar a mirar la columna.
 */
async function filaDe(numero: string): Promise<HTMLElement> {
  const tabla = await screen.findByRole('table', { name: /Bandeja de licencias/i });
  const celda = await within(tabla).findByText(numero);
  const fila = celda.closest('tr');
  if (!fila) throw new Error(`el número ${numero} no está dentro de una fila`);
  return fila as HTMLElement;
}

describe('la columna «Vence» de la bandeja existe y la pinta alguien', () => {
  it('la tabla declara la columna — si desaparece, esto se cae', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetch([expediente()]));

    render(<BandejaLicenciasClient />);

    const columna = await screen.findByRole('columnheader', { name: 'Vence' });
    expect(columna, 'la bandeja dejó de declarar la columna «Vence»').toBeTruthy();
  });

  it('CORRIENDO: pinta la fecha del vencimiento Y los días hábiles que quedan', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetch([expediente({ fechaAlertaConservadora: '2026-09-30T17:00:00.000Z' })]),
    );

    render(<BandejaLicenciasClient />);
    const fila = await filaDe('68745-0-26-0001');

    // La fecha, en el formato del país — no un ISO crudo.
    expect(within(fila).getByText(/30\/09\/2026/)).toBeTruthy();
    // Y el saldo en días HÁBILES, que es lo que decide el día de trabajo.
    expect(within(fila).getByText(/d\. hábiles$/)).toBeTruthy();
  });

  it('CRÍTICO: cuando quedan pocos días lo dice con la MISMA etiqueta que el correo', async () => {
    mockAuth();
    // A tres días hábiles de «hoy» (mar 1-sep) → escalón CRÍTICO.
    vi.stubGlobal(
      'fetch',
      mockFetch([expediente({ fechaAlertaConservadora: '2026-09-04T17:00:00.000Z' })]),
    );

    render(<BandejaLicenciasClient />);
    const fila = await filaDe('68745-0-26-0001');

    const marca = within(fila).getByTitle(ETIQUETA_NIVEL_TERMINO.CRITICO);
    expect(marca, 'el escalón crítico no se distingue en la bandeja').toBeTruthy();
    // Y no puede pintarse igual que un AVISO: el color viene del mapa compartido.
    expect(marca.getAttribute('style')).toContain('color');
  });

  it('SUSPENDIDO: no dice «le quedan N días» — dice que el reloj está detenido', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetch([
        expediente({
          estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES',
          fechaAlertaConservadora: '2026-09-30T17:00:00.000Z',
        }),
      ]),
    );

    render(<BandejaLicenciasClient />);
    const fila = await filaDe('68745-0-26-0001');

    expect(within(fila).getByText('Suspendido')).toBeTruthy();
    expect(within(fila).queryByText(/d\. hábiles$/), 'un término suspendido no descuenta días').toBeNull();
    expect(within(fila).queryByText(/30\/09\/2026/), 'un término suspendido no tiene fecha de vencimiento vigente').toBeNull();
  });

  it('RESUELTO: la Administración ya decidió, así que no hay plazo que correr', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetch([
        expediente({ estadoJuridico: 'CONCEDIDA', fechaAlertaConservadora: '2026-09-30T17:00:00.000Z' }),
      ]),
    );

    render(<BandejaLicenciasClient />);
    const fila = await filaDe('68745-0-26-0001');

    expect(within(fila).getByText('Resuelto')).toBeTruthy();
    expect(within(fila).queryByText(/d\. hábiles$/), 'un expediente resuelto no está en mora').toBeNull();
  });

  it('SIN ANCLAR: sin espejo no se inventa una fecha — se dice que no ha empezado', async () => {
    mockAuth();
    vi.stubGlobal('fetch', mockFetch([expediente({ fechaAlertaConservadora: null })]));

    render(<BandejaLicenciasClient />);
    const fila = await filaDe('68745-0-26-0001');

    expect(within(fila).getByText(/Sin anclar/)).toBeTruthy();
    expect(within(fila).getByText(/esperando/), 'no dice cuánto lleva esperando').toBeTruthy();
  });

  it('las cuatro situaciones se distinguen entre sí en la misma tabla', async () => {
    mockAuth();
    vi.stubGlobal(
      'fetch',
      mockFetch([
        expediente({ id: 'a', numeroExpediente: { numero: '68745-0-26-0001', serieId: 'd', año: 2026 }, fechaAlertaConservadora: '2026-09-30T17:00:00.000Z' }),
        expediente({ id: 'b', numeroExpediente: { numero: '68745-0-26-0002', serieId: 'd', año: 2026 }, estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES', fechaAlertaConservadora: '2026-09-30T17:00:00.000Z' }),
        expediente({ id: 'c', numeroExpediente: { numero: '68745-0-26-0003', serieId: 'd', año: 2026 }, estadoJuridico: 'CONCEDIDA', fechaAlertaConservadora: '2026-09-30T17:00:00.000Z' }),
        expediente({ id: 'd', numeroExpediente: { numero: '68745-0-26-0004', serieId: 'd', año: 2026 }, fechaAlertaConservadora: null }),
      ]),
    );

    render(<BandejaLicenciasClient />);
    await filaDe('68745-0-26-0004');

    /* El fallo que se vigila: pintar los cuatro igual. Cuatro textos, cuatro
       situaciones — si dos coincidieran, la tabla estaría mintiendo sobre una
       de ellas. */
    const textos = ['68745-0-26-0001', '68745-0-26-0002', '68745-0-26-0003', '68745-0-26-0004'];
    const pintados = await Promise.all(
      textos.map(async (n) => {
        const fila = await filaDe(n);
        return fila.querySelectorAll('td')[4]?.textContent?.trim() ?? '';
      }),
    );

    expect(new Set(pintados).size, `las cuatro situaciones se pintan igual: ${JSON.stringify(pintados)}`).toBe(4);
  });
});
