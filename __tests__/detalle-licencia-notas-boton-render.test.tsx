import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { DetalleLicenciaClient } from '@/app/interno/licencias/[expedienteId]/DetalleLicenciaClient';
import { useAuth, type UsuarioAutenticado, type UseAuthReturn } from '@/lib/hooks/useAuth';
import type { ActuacionLicenciaDoc, ExpedienteLicenciaDoc } from '@/lib/server/expedientes-licencias';

vi.mock('@/lib/hooks/useAuth', () => ({ useAuth: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ══════════════════════════════════════════════════════════════
   Revisión QA (8-ago) — "Registrar acta de observaciones" y "Registrar
   respuesta de subsanación" (`DetalleLicenciaClient.tsx`) se deshabilitan
   según `puedeTransicionar` (`lib/motor-expedientes/estados-licencia.ts`)
   sin explicar por qué. Mismo patrón `notaDeshabilitado` que ya usaba
   "Emitir acto final" en la misma pantalla — el motivo se deriva del
   ESTADO JURÍDICO real del expediente (`ESTILOS_ESTADO_JURIDICO[...]
   .label`), nunca de un estado inventado.
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
    origen: 'REAL',
    estadoJuridico: 'EN_REVISION',
    esPrueba: false,
    ...overrides,
  };
}

function actuacionRadicacion(): ActuacionLicenciaDoc {
  return {
    id: 'a1',
    expedienteId: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    tipo: 'radicacion-debida-forma',
    etapa: 'radicacion',
    actorUid: 'sistema',
    actorNombre: 'Sistema',
    actorRol: 'SISTEMA',
    fecha: '2026-06-01T15:00:00.000Z',
    origen: 'REAL',
  };
}

function actuacionActa(): ActuacionLicenciaDoc {
  return {
    id: 'a2',
    expedienteId: 'exp-1',
    tenantId: 'SEC_PLANEACION',
    tipo: 'acta-observaciones',
    etapa: 'revision',
    actorUid: 'u1',
    actorNombre: 'Funcionaria de Planeación',
    actorRol: 'FUNCIONARIO',
    fecha: '2026-06-20T15:00:00.000Z',
    origen: 'REAL',
  };
}

function mockFetchDetalle(expediente: ExpedienteLicenciaDoc, actuaciones: ActuacionLicenciaDoc[]) {
  return vi.fn((url: string) => {
    if (url === `/api/licencias/expedientes/${expediente.id}`) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          expediente,
          actuaciones,
          documentos: [],
          definicionId: null,
          radicadoVinculado: null,
        }),
      });
    }
    throw new Error(`fetch inesperado en el test: ${url}`);
  });
}

describe('DetalleLicenciaClient — nota del botón deshabilitado (acta / respuesta de subsanación)', () => {
  it('EN_REVISION sin acta previa: ambos botones habilitados, sin nota', async () => {
    mockAuth();
    const expediente = expedienteBase({ estadoJuridico: 'EN_REVISION' });
    vi.stubGlobal('fetch', mockFetchDetalle(expediente, [actuacionRadicacion()]));
    render(<DetalleLicenciaClient expedienteId="exp-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Registrar acta de observaciones/ })).toBeTruthy());
    const botonActa = screen.getByRole('button', { name: /Registrar acta de observaciones/ });
    expect((botonActa as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/El acta solo procede/)).toBeNull();
    expect(screen.queryByText(/procede por una sola vez/)).toBeNull();
    // Sin acta previa todavía no existe el botón de respuesta.
    expect(screen.queryByRole('button', { name: /Registrar respuesta de subsanación/ })).toBeNull();
  });

  it('CON_ACTA_DE_OBSERVACIONES (ya hubo acta): botón de acta deshabilitado con la cita normativa; respuesta habilitada sin nota', async () => {
    mockAuth();
    const expediente = expedienteBase({ estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES' });
    vi.stubGlobal('fetch', mockFetchDetalle(expediente, [actuacionRadicacion(), actuacionActa()]));
    render(<DetalleLicenciaClient expedienteId="exp-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Registrar acta de observaciones/ })).toBeTruthy());

    const botonActa = screen.getByRole('button', { name: /Registrar acta de observaciones/ });
    expect((botonActa as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/El acta procede por una sola vez \(D\.1077\/2015 art\. 2\.2\.6\.1\.2\.2\.4\)/),
    ).toBeTruthy();

    const botonRespuesta = screen.getByRole('button', { name: /Registrar respuesta de subsanación/ });
    expect((botonRespuesta as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/La respuesta de subsanación solo procede/)).toBeNull();
  });

  it('EN_VIABILIDAD sin acta previa: acta deshabilitada citando el estado actual real ("En viabilidad")', async () => {
    mockAuth();
    const expediente = expedienteBase({ estadoJuridico: 'EN_VIABILIDAD' });
    vi.stubGlobal('fetch', mockFetchDetalle(expediente, [actuacionRadicacion()]));
    render(<DetalleLicenciaClient expedienteId="exp-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Registrar acta de observaciones/ })).toBeTruthy());
    const botonActa = screen.getByRole('button', { name: /Registrar acta de observaciones/ });
    expect((botonActa as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText('El acta solo procede con el expediente en revisión — estado actual: "En viabilidad".'),
    ).toBeTruthy();
  });

  it('EN_VIABILIDAD con acta previa: respuesta de subsanación deshabilitada citando el estado actual real', async () => {
    mockAuth();
    const expediente = expedienteBase({ estadoJuridico: 'EN_VIABILIDAD' });
    vi.stubGlobal('fetch', mockFetchDetalle(expediente, [actuacionRadicacion(), actuacionActa()]));
    render(<DetalleLicenciaClient expedienteId="exp-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Registrar respuesta de subsanación/ })).toBeTruthy());
    const botonRespuesta = screen.getByRole('button', { name: /Registrar respuesta de subsanación/ });
    expect((botonRespuesta as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(
        'La respuesta de subsanación solo procede con el expediente "con acta de observaciones" — estado actual: "En viabilidad".',
      ),
    ).toBeTruthy();
  });
});
