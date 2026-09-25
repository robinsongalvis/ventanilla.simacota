/**
 * Pieza angular (P2.1) — Fase 3: `lib/recepcion/radicar-interna-cliente.ts`.
 *
 * Dos frentes:
 *  1. `construirFormDataRadicacionInterna` arma el `FormData` campo por
 *     campo según el contrato compartido
 *     (`lib/recepcion/contrato-radicacion-interna.ts`) — mismo nombre que
 *     lee `app/api/radicacion/interna/route.ts`.
 *  2. `radicarInternaCliente` traduce la respuesta del endpoint
 *     (200/400/401/500 y error de red) a `ResultadoRadicacion` o a un
 *     `Error` con el mensaje en español que el dashboard ya sabe mostrar
 *     (`err instanceof Error ? err.message : …`).
 *
 * `fetch` global mockeado — no hay handler real de por medio (eso lo
 * cubre la Fase 2, `__tests__/fase2-golden-radicacion-interna-servidor.test.ts`
 * y hermanos).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  construirFormDataRadicacionInterna,
  radicarInternaCliente,
} from '@/lib/recepcion/radicar-interna-cliente';
import { CAMPOS_RADICACION_INTERNA } from '@/lib/recepcion/contrato-radicacion-interna';
import type { DatosRadicacionInstitucional } from '@/lib/actions/radicarVentanilla';

function archivoPdf(nombre: string): File {
  return new File(['%PDF-1.4 contenido de prueba'], nombre, { type: 'application/pdf' });
}

const DATOS_COMPLETOS: DatosRadicacionInstitucional = {
  tipoPersona: 'NATURAL',
  tipoDocumento: 'CC',
  numeroDocumento: '1091234567',
  nombreCompleto: 'Ana Gómez',
  email: 'ana@example.co',
  telefono: '3001234567',
  direccion: 'Calle 1 # 2-34',
  pais: 'Colombia',
  departamento: 'Santander',
  municipio: 'Simacota',
  medioRecepcion: 'PRESENCIAL',
  tipoSolicitudId: 'PETICION_INFORMACION',
  asunto: 'Solicitud de información',
  descripcion: 'Descripción de la solicitud',
  numeroFolios: 2,
  anexosDescripcion: 'Cédula y recibo',
  archivos: [archivoPdf('cedula.pdf'), archivoPdf('recibo.pdf')],
  fechaVencimiento: '2026-08-01T00:00:00.000Z',
  origenIngreso: 'VENTANILLA_FISICA',
  tipoEntrada: 'PQRSD',
  telefonoMovil: '3009876543',
  telefonoFijo: '6075551234',
  barrio: 'Centro',
  numeroAnexos: 2,
  observacionesAnexos: 'Copias legibles',
  canalRespuesta: 'CORREO',
  noAportaDocumento: false,
  noAportaCorreo: false,
  noAportaTelefono: false,
  noAportaDireccion: false,
  oficinaDestino: 'VENTANILLA_UNICA',
  tipoPresentacion: 'IDENTIFICADA',
  areaResponsable: 'area-1',
};

const DATOS_MINIMOS: DatosRadicacionInstitucional = {
  tipoPersona: 'NO_IDENTIFICADO',
  tipoDocumento: 'CC',
  numeroDocumento: '',
  nombreCompleto: 'Ciudadano anonimo',
  email: '',
  telefono: '',
  direccion: '',
  pais: 'Colombia',
  departamento: 'Santander',
  municipio: 'Simacota',
  medioRecepcion: 'PRESENCIAL',
  tipoSolicitudId: 'PETICION_INFORMACION',
  asunto: 'Solicitud anónima',
  descripcion: 'Descripción',
  numeroFolios: 0,
  anexosDescripcion: '',
  archivos: [],
  fechaVencimiento: '2026-08-01T00:00:00.000Z',
};

describe('construirFormDataRadicacionInterna — contrato campo por campo', () => {
  it('mapea cada campo del payload al nombre de campo del contrato', () => {
    const fd = construirFormDataRadicacionInterna(DATOS_COMPLETOS);
    const C = CAMPOS_RADICACION_INTERNA;

    expect(fd.get(C.tipoSolicitudId)).toBe('PETICION_INFORMACION');
    expect(fd.get(C.tipoPresentacion)).toBe('IDENTIFICADA');
    expect(fd.get(C.canalRespuesta)).toBe('CORREO');
    expect(fd.get(C.tipoPersona)).toBe('NATURAL');
    expect(fd.get(C.tipoDocumento)).toBe('CC');
    expect(fd.get(C.medioRecepcion)).toBe('PRESENCIAL');
    expect(fd.get(C.origenIngreso)).toBe('VENTANILLA_FISICA');
    expect(fd.get(C.tipoEntrada)).toBe('PQRSD');
    expect(fd.get(C.oficinaDestino)).toBe('VENTANILLA_UNICA');
    expect(fd.get(C.nombreCompleto)).toBe('Ana Gómez');
    expect(fd.get(C.numeroDocumento)).toBe('1091234567');
    expect(fd.get(C.email)).toBe('ana@example.co');
    expect(fd.get(C.telefono)).toBe('3001234567');
    expect(fd.get(C.telefonoMovil)).toBe('3009876543');
    expect(fd.get(C.telefonoFijo)).toBe('6075551234');
    expect(fd.get(C.direccion)).toBe('Calle 1 # 2-34');
    expect(fd.get(C.pais)).toBe('Colombia');
    expect(fd.get(C.departamento)).toBe('Santander');
    expect(fd.get(C.municipio)).toBe('Simacota');
    expect(fd.get(C.barrio)).toBe('Centro');
    expect(fd.get(C.asunto)).toBe('Solicitud de información');
    expect(fd.get(C.descripcion)).toBe('Descripción de la solicitud');
    expect(fd.get(C.numeroFolios)).toBe('2');
    expect(fd.get(C.numeroAnexos)).toBe('2');
    expect(fd.get(C.anexosDescripcion)).toBe('Cédula y recibo');
    expect(fd.get(C.observacionesAnexos)).toBe('Copias legibles');
    expect(fd.get(C.areaResponsable)).toBe('area-1');
    expect(fd.get(C.noAportaDocumento)).toBe('false');
    expect(fd.get(C.noAportaCorreo)).toBe('false');
    expect(fd.get(C.noAportaTelefono)).toBe('false');
    expect(fd.get(C.noAportaDireccion)).toBe('false');

    const archivos = fd.getAll(C.archivos);
    expect(archivos).toHaveLength(2);
    expect((archivos[0] as File).name).toBe('cedula.pdf');
    expect((archivos[1] as File).name).toBe('recibo.pdf');
  });

  it('no agrega al FormData los campos opcionales ausentes (no manda ni siquiera cadena vacía)', () => {
    const fd = construirFormDataRadicacionInterna(DATOS_MINIMOS);
    const C = CAMPOS_RADICACION_INTERNA;

    expect(fd.get(C.canalRespuesta)).toBeNull();
    expect(fd.get(C.origenIngreso)).toBeNull();
    expect(fd.get(C.tipoEntrada)).toBeNull();
    expect(fd.get(C.oficinaDestino)).toBeNull();
    expect(fd.get(C.telefonoMovil)).toBeNull();
    expect(fd.get(C.telefonoFijo)).toBeNull();
    expect(fd.get(C.barrio)).toBeNull();
    expect(fd.get(C.numeroAnexos)).toBeNull();
    expect(fd.get(C.observacionesAnexos)).toBeNull();
    expect(fd.get(C.areaResponsable)).toBeNull();
    expect(fd.get(C.noAportaDocumento)).toBeNull();
    expect(fd.get(C.tipoPresentacion)).toBeNull();
    expect(fd.getAll(C.archivos)).toHaveLength(0);

    // Campos requeridos vacíos SÍ viajan (cadena vacía, no ausentes) —
    // el endpoint decide qué hacer con ellos (p. ej. numeroDocumento vs.
    // noAportaDocumento).
    expect(fd.get(C.numeroDocumento)).toBe('');
    expect(fd.get(C.email)).toBe('');
  });
});

describe('radicarInternaCliente — traducción de la respuesta del endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('200 ok → devuelve { radicadoId, consecutivo } y llama POST /api/radicacion/interna con FormData', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, radicadoId: '1-110-202607-00000005', consecutivo: 5, archivosSubidos: 2 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onProgress = vi.fn();
    const resultado = await radicarInternaCliente(DATOS_COMPLETOS, onProgress);

    expect(resultado).toEqual({ radicadoId: '1-110-202607-00000005', consecutivo: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/radicacion/interna');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(onProgress).toHaveBeenCalled();
  });

  it('400 → junta los mensajes de `errores` en el Error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'La solicitud tiene datos pendientes por corregir.',
        errores: ['El asunto es obligatorio.', 'La descripción es obligatoria.'],
      }),
    }));

    await expect(radicarInternaCliente(DATOS_MINIMOS)).rejects.toThrow(
      'El asunto es obligatorio. La descripción es obligatoria.',
    );
  });

  it('401 → usa el mensaje de autenticación del endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'No autorizado.' }),
    }));

    await expect(radicarInternaCliente(DATOS_MINIMOS)).rejects.toThrow('No autorizado.');
  });

  it('500 → usa el mensaje genérico del endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'No fue posible radicar la solicitud. Intenta nuevamente o comunícate con soporte.' }),
    }));

    await expect(radicarInternaCliente(DATOS_MINIMOS)).rejects.toThrow(
      'No fue posible radicar la solicitud. Intenta nuevamente o comunícate con soporte.',
    );
  });

  it('error de red (fetch lanza) → mensaje de red en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(radicarInternaCliente(DATOS_MINIMOS)).rejects.toThrow(
      'Error de red al radicar la solicitud. Intenta nuevamente.',
    );
  });

  it('respuesta ok sin cuerpo JSON válido → mensaje genérico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
    }));

    await expect(radicarInternaCliente(DATOS_MINIMOS)).rejects.toThrow(
      'No fue posible radicar la solicitud. Intenta nuevamente o comunícate con soporte.',
    );
  });
});
