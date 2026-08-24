/**
 * Pieza angular (P2.1) — kill-switch de la radicación interna a
 * servidor DEBE nacer en OFF (blueprint §Kill-switch de 1 línea): el
 * endpoint nuevo EXISTE pero la producción no cambia de comportamiento
 * hasta que el propietario dé el cutover (PdC 3,
 * docs/CRONOGRAMA_PIEZA_ANGULAR.md §FASE 3).
 *
 * Esta prueba es el guardarraíl automatizado: si alguien flipea el flag a
 * `true` sin pasar por el PdC 3, este test lo detecta en rojo.
 *
 * Fase 3 cableó la bifurcación (`lib/recepcion/radicar-segun-flag.ts`,
 * invocada por `app/interno/dashboard/page.tsx`). La aserción original
 * ("el dashboard llama radicarInstitucionalmente") se verificaba por
 * inspección manual (grep); ahora es una aserción de comportamiento real:
 * con el flag EN SU VALOR ACTUAL (false, sin mockear — es justo lo que se
 * quiere lockear), `radicarSegunFlag` invoca el camino legado y NUNCA el
 * cliente del endpoint nuevo. El caso complementario (flag ON → cliente
 * del endpoint) vive en `__tests__/radicar-segun-flag.test.ts`, donde SÍ
 * se mockea el flag para poder ejercer esa rama sin tocar este archivo.
 */
import { describe, it, expect, vi } from 'vitest';
import { USA_RADICACION_INTERNA_SERVER } from '@/lib/recepcion/radicacion-interna-flag';

vi.mock('@/lib/actions/radicarVentanilla', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/actions/radicarVentanilla')>();
  return { ...original, radicarInstitucionalmente: vi.fn().mockResolvedValue({ radicadoId: 'legado', consecutivo: 1 }) };
});
vi.mock('@/lib/recepcion/radicar-interna-cliente', () => ({
  radicarInternaCliente: vi.fn().mockResolvedValue({ radicadoId: 'servidor', consecutivo: 7 }),
}));

import { radicarInstitucionalmente, type DatosRadicacionInstitucional } from '@/lib/actions/radicarVentanilla';
import { radicarInternaCliente } from '@/lib/recepcion/radicar-interna-cliente';
import { radicarSegunFlag } from '@/lib/recepcion/radicar-segun-flag';

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

describe('kill-switch de radicación interna a servidor', () => {
  it('está en ON — cutover PT-1 ejecutado (23-ago-2026, autorizado por el propietario)', () => {
    // Si esto falla porque alguien lo puso en false: puede ser el rollback
    // legítimo de 1 línea (documentado en el flag) — actualice este test
    // JUNTO con el flag y deje constancia del porqué. Si falla porque
    // alguien lo cambió sin saberlo, este test acaba de evitar que la
    // radicación vuelva al cliente en silencio.
    expect(USA_RADICACION_INTERNA_SERVER).toBe(true);
  });

  it('con el switch en ON, el caller invoca el cliente del endpoint — nunca el camino legado', async () => {
    const resultado = await radicarSegunFlag(
      DATOS,
      { uid: 'u1', nombre: 'Ana Recepción', tenantId: 'VENTANILLA_UNICA' },
    );

    expect(radicarInternaCliente).toHaveBeenCalledTimes(1);
    expect(radicarInstitucionalmente).not.toHaveBeenCalled();
    expect(resultado).toEqual({ radicadoId: 'servidor', consecutivo: 7 });
  });
});
