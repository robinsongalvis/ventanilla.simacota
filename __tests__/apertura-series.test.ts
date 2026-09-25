import { describe, it, expect } from 'vitest';
import { decidirApertura, construirRegistroApertura, MOTIVO_DEL_SALTO } from '@/lib/server/apertura-series';

const CONF = { desde: 1600, autorizadoPor: 'Propietario del proyecto', referencia: 'acta-arranque' };
const AHORA = '2026-09-01T12:00:00.000Z';

describe('apertura de una serie consecutiva', () => {
  it('abre dejando el contador en desde-1: la próxima emisión sale EN el número fijado', () => {
    // Confundir esto desplaza la serie entera en uno — error silencioso y caro.
    const d = decidirApertura('radicados', 27, CONF);
    expect(d).toEqual({ accion: 'ABRIR', veniaDe: 27, nuevoUltimo: 1599 });
    const reg = construirRegistroApertura(d as never, CONF, AHORA);
    expect(reg.abiertoEn).toBe(1600);
    expect(reg.veniaDe).toBe(27);
    expect(reg.autorizadoPor).toBe('Propietario del proyecto');
    expect(reg.motivoDelSalto).toBe(MOTIVO_DEL_SALTO);
  });

  it('NUNCA baja el contador — si ya está por encima, no hace nada', () => {
    const d = decidirApertura('radicados', 1700, CONF);
    expect(d.accion).toBe('NADA');
    // El motivo debe nombrar los DOS números, para que quien lea el informe
    // entienda por qué no se actuó sin tener que abrir el código.
    expect('motivo' in d && d.motivo).toContain('1700');
    expect('motivo' in d && d.motivo).toContain('1600');
  });

  it('tampoco actúa si dejaría el contador igual — «no avanza» no es «avanza cero»', () => {
    // desde=1600 ⇒ nuevoUltimo=1599. Con el contador ya en 1599, abrir no
    // avanzaría: se omite en vez de reescribir el mismo valor.
    expect(decidirApertura('radicados', 1599, CONF).accion).toBe('NADA');
  });

  it('es idempotente: aplicarla dos veces no mueve nada la segunda', () => {
    const primera = decidirApertura('radicados', 27, CONF);
    expect(primera.accion).toBe('ABRIR');
    const segunda = decidirApertura('radicados', (primera as never as { nuevoUltimo: number }).nuevoUltimo, CONF);
    expect(segunda.accion).toBe('NADA');
  });

  it('sin configuración no hace nada — no inventa un punto de apertura', () => {
    expect(decidirApertura('salidas', 0, undefined).accion).toBe('NADA');
  });

  it('rechaza una apertura sin dueño: un salto sin autor no se puede explicar', () => {
    const d = decidirApertura('radicados', 27, { desde: 1600, autorizadoPor: '  ' });
    expect(d.accion).toBe('RECHAZAR');
  });

  it.each([[0], [-5], [1.5], [Number.NaN]])('rechaza un punto de apertura inválido (%s)', (desde) => {
    const d = decidirApertura('radicados', 27, { desde: desde as number, autorizadoPor: 'X' });
    expect(d.accion).toBe('RECHAZAR');
  });

  it('rechaza abrir sobre un contador corrupto en vez de pisarlo', () => {
    expect(decidirApertura('radicados', -1, CONF).accion).toBe('RECHAZAR');
    expect(decidirApertura('radicados', 3.7, CONF).accion).toBe('RECHAZAR');
  });

  it('funciona igual para CUALQUIER serie, no solo radicados', () => {
    for (const serie of ['radicados', 'salidas', 'planillas', 'expedientes'] as const) {
      expect(decidirApertura(serie, 0, { desde: 500, autorizadoPor: 'X' })).toEqual({
        accion: 'ABRIR', veniaDe: 0, nuevoUltimo: 499,
      });
    }
  });
});
