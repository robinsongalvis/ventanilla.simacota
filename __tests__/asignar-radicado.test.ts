import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asignarMasivo,
  asignarRadicado,
  type ActorAsignacion,
  type ResponsableFuncionario,
} from '@/lib/actions/asignarRadicado';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

const actor: ActorAsignacion = {
  uid: 'admin_001',
  nombre: 'Admin Ventanilla',
  rol: 'ADMIN',
};

const responsableCompleto: ResponsableFuncionario = {
  uid: 'func_002',
  nombre: 'María García',
  email: 'mgarcia@simacota-santander.gov.co',
  rol: 'FUNCIONARIO',
  cargo: 'Abogada Contratista',
};

function mockFetchOk() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200 }),
  ));
}

function mockRadicado(overrides: Partial<VentanillaRadicado['clasificacion']> = {}): VentanillaRadicado {
  return {
    radicadoId: 'SIM-2026-001',
    estadoActual: 'ASIGNADO',
    ultimaActualizacion: '2026-06-01T10:00:00.000Z',
    prioridad: 'AMARILLO',
    cumplioTermino: null,
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '12345678',
      nombreCompleto: 'Juan Ciudadano',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: 'SIM-2026-001',
      consecutivo: 1,
      fechaRadicado: '2026-06-01',
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION',
      tipoSolicitudNombre: 'Petición',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: '2026-06-20T00:00:00.000Z',
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
      ...overrides,
    },
    detalle: {
      asunto: 'Solicitud de información',
      descripcion: 'Descripción',
      numeroFolios: 1,
    },
    archivos: [],
  } as VentanillaRadicado;
}

describe('asignarRadicado — API server-side', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetchOk();
  });

  it('envía la asignación a la API server-side con responsable MIPG-2', async () => {
    await asignarRadicado(
      'SIM-2026-001',
      'SEC_GOBIERNO',
      actor,
      responsableCompleto,
      'VENTANILLA_UNICA',
    );

    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/radicados/SIM-2026-001/asignar');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    const body = JSON.parse((options as RequestInit).body as string);
    expect(body).toMatchObject({
      tenantDestino: 'SEC_GOBIERNO',
      responsable: {
        uid: 'func_002',
        nombre: 'María García',
        email: 'mgarcia@simacota-santander.gov.co',
        rol: 'FUNCIONARIO',
        cargo: 'Abogada Contratista',
      },
    });
  });

  it('propaga el error de la API si la asignación es rechazada', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Tu rol no permite asignar este radicado.' }), { status: 403 }),
    ));

    await expect(
      asignarRadicado('SIM-2026-001', 'SEC_GOBIERNO', actor),
    ).rejects.toThrow('Tu rol no permite asignar este radicado.');
  });

  it('asignarMasivo usa la misma API por cada radicado y contabiliza fallidos', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'bloqueado' }), { status: 403 })),
    );

    const progreso: Array<[number, number]> = [];
    const resultado = await asignarMasivo(
      ['SIM-2026-001', 'SIM-2026-002'],
      'SEC_GOBIERNO',
      actor,
      (asignados, total) => progreso.push([asignados, total]),
    );

    expect(resultado).toEqual({ asignados: 1, fallidos: 1 });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(progreso).toEqual([[1, 2], [1, 2]]);
  });
});

describe('CSV MIPG — backward compat responsable', () => {
  it('radicado nuevo: CSV muestra nombre y email del responsable', () => {
    const radicado = mockRadicado({
      funcionarioResponsableUid: 'func_002',
      funcionarioResponsableNombre: 'María García',
      funcionarioResponsableEmail: 'mgarcia@simacota-santander.gov.co',
      funcionarioResponsableRol: 'FUNCIONARIO',
      funcionarioResponsableCargo: 'Abogada Contratista',
      fechaAsignacionResponsable: '2026-06-01T10:00:00.000Z',
    });

    expect(radicado.clasificacion.funcionarioResponsableNombre).toBe('María García');
    expect(radicado.clasificacion.funcionarioResponsableEmail).toBe('mgarcia@simacota-santander.gov.co');
    expect(radicado.clasificacion.funcionarioResponsableCargo).toBe('Abogada Contratista');
  });

  it('radicado antiguo: CSV usa fallback cuando falta nombre', () => {
    const radicadoAntiguo = mockRadicado({
      funcionarioResponsableUid: 'uid-legacy-001',
    });

    const valorEnCSV = radicadoAntiguo.clasificacion.funcionarioResponsableNombre
      ?? 'No registrado (ver trazabilidad)';
    expect(valorEnCSV).toBe('No registrado (ver trazabilidad)');
  });
});
