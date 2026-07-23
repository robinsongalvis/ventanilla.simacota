/**
 * Pieza angular (P2.1) — Fase 3: bifurcación del kill-switch
 * (`lib/recepcion/radicar-segun-flag.ts`), único punto donde
 * `app/interno/dashboard/page.tsx` decide entre el camino legado
 * (`radicarInstitucionalmente`) y el camino nuevo
 * (`radicarInternaCliente`, endpoint servidor).
 *
 * `USA_RADICACION_INTERNA_SERVER` es una constante literal (no una env
 * var) — para probar AMBAS ramas se mockea el módulo del flag con
 * `vi.doMock` + `vi.resetModules()` y se reimporta dinámicamente en cada
 * caso (patrón estándar de Vitest para constantes de módulo). El caso
 * "flag en false ⇒ legado" que realmente corre en producción hoy está
 * cubierto, sin mockear el flag, por
 * `__tests__/radicacion-interna-kill-switch.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActorRadicacion, DatosRadicacionInstitucional } from '@/lib/actions/radicarVentanilla';

const DATOS: DatosRadicacionInstitucional = {
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
  numeroFolios: 0,
  anexosDescripcion: '',
  archivos: [],
  fechaVencimiento: '2026-08-01T00:00:00.000Z',
};

const ACTOR: ActorRadicacion = { uid: 'u1', nombre: 'Ana Recepción', tenantId: 'VENTANILLA_UNICA' };

describe('radicarSegunFlag — bifurcación del kill-switch', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/recepcion/radicacion-interna-flag');
    vi.doUnmock('@/lib/actions/radicarVentanilla');
    vi.doUnmock('@/lib/recepcion/radicar-interna-cliente');
    vi.resetModules();
  });

  it('flag OFF → invoca el camino legado (radicarInstitucionalmente) y no el endpoint', async () => {
    const radicarInstitucionalmente = vi.fn().mockResolvedValue({ radicadoId: 'legado-1', consecutivo: 1 });
    const radicarInternaCliente = vi.fn().mockResolvedValue({ radicadoId: 'nuevo-1', consecutivo: 1 });

    vi.doMock('@/lib/recepcion/radicacion-interna-flag', () => ({ USA_RADICACION_INTERNA_SERVER: false }));
    vi.doMock('@/lib/actions/radicarVentanilla', () => ({ radicarInstitucionalmente }));
    vi.doMock('@/lib/recepcion/radicar-interna-cliente', () => ({ radicarInternaCliente }));

    const { radicarSegunFlag } = await import('@/lib/recepcion/radicar-segun-flag');
    const onProgress = vi.fn();
    const resultado = await radicarSegunFlag(DATOS, ACTOR, onProgress);

    expect(radicarInstitucionalmente).toHaveBeenCalledTimes(1);
    expect(radicarInstitucionalmente).toHaveBeenCalledWith(DATOS, ACTOR, onProgress);
    expect(radicarInternaCliente).not.toHaveBeenCalled();
    expect(resultado).toEqual({ radicadoId: 'legado-1', consecutivo: 1 });
  });

  it('flag ON → invoca el cliente del endpoint (radicarInternaCliente) y no el legado', async () => {
    const radicarInstitucionalmente = vi.fn().mockResolvedValue({ radicadoId: 'legado-2', consecutivo: 2 });
    const radicarInternaCliente = vi.fn().mockResolvedValue({ radicadoId: 'nuevo-2', consecutivo: 2 });

    vi.doMock('@/lib/recepcion/radicacion-interna-flag', () => ({ USA_RADICACION_INTERNA_SERVER: true }));
    vi.doMock('@/lib/actions/radicarVentanilla', () => ({ radicarInstitucionalmente }));
    vi.doMock('@/lib/recepcion/radicar-interna-cliente', () => ({ radicarInternaCliente }));

    const { radicarSegunFlag } = await import('@/lib/recepcion/radicar-segun-flag');
    const onProgress = vi.fn();
    const resultado = await radicarSegunFlag(DATOS, ACTOR, onProgress);

    expect(radicarInternaCliente).toHaveBeenCalledTimes(1);
    expect(radicarInternaCliente).toHaveBeenCalledWith(DATOS, onProgress);
    expect(radicarInstitucionalmente).not.toHaveBeenCalled();
    expect(resultado).toEqual({ radicadoId: 'nuevo-2', consecutivo: 2 });
  });
});
