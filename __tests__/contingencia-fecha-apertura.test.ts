import { describe, it, expect, vi } from 'vitest';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { periodoColombia } from '@/lib/fecha-colombia';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import { leerConsecutivosLegales, confirmarConsecutivosLegales } from '@/lib/server/consecutivo-legal';
import { evaluarContingencia } from '@/scripts/operacion/abrir-series.mjs';

describe('calendario institucional en frontera de mes y año', () => {
  it.each([
    ['2026-10-01T04:59:59.999Z', 2026, '09'],
    ['2026-10-01T05:00:00.000Z', 2026, '10'],
    ['2027-01-01T00:00:00.000Z', 2026, '12'],
    ['2027-01-01T04:59:59.999Z', 2026, '12'],
    ['2027-01-01T05:00:00.000Z', 2027, '01'],
  ])('%s conserva período %s-%s', (iso, anio, mes) => {
    const fecha = new Date(iso);
    expect(periodoColombia(fecha)).toEqual({ anio, mes });
    expect(formatearRadicadoInstitucional(1745, fecha)).toBe(`1-110-${anio}${mes}-00001745`);
  });
  it('rechaza fecha inválida', () => expect(() => periodoColombia(new Date('inválida'))).toThrow());
});

function dobles(apertura?: { abiertoEn: number; autorizadoPor: string; referencia: string }, ultimo = 1744) {
  const get = vi.fn(async () => ({ exists: true, data: () => ({ ultimo, apertura }) }));
  const set = vi.fn();
  const create = vi.fn();
  // Doble mínimo del SDK para observar paths y escrituras sin conexión externa.
  const db = { doc: (path: string) => ({ path }) } as Firestore;
  const tx = { get, set, create } as unknown as Transaction;
  return { db, tx, get, set, create };
}

describe('contador y apertura formal de contingencia', () => {
  it('lee y escribe el MISMO contador anual Bogotá', async () => {
    const { db, tx, get, set } = dobles();
    const fecha = new Date('2027-01-01T01:00:00Z');
    const pendientes = await leerConsecutivosLegales(tx, db, fecha, [{ serie: 'radicados', formatear: formatearRadicadoInstitucional }]);
    confirmarConsecutivosLegales(tx, fecha, pendientes);
    expect(get).toHaveBeenCalledWith({ path: 'counters/radicados-2026' });
    expect(set).toHaveBeenCalledWith({ path: 'counters/radicados-2026' }, expect.objectContaining({ anio: 2026, ultimo: 1745 }), { merge: true });
  });
  it.each([undefined, { abiertoEn: 1746, autorizadoPor: 'A', referencia: 'R' }, { abiertoEn: 1745, autorizadoPor: '', referencia: 'R' }])('no emite sin acta de apertura coincidente', async (apertura) => {
    const { db, tx, create, set } = dobles(apertura);
    await expect(leerConsecutivosLegales(tx, db, new Date(), [{ serie: 'radicados', formatear: formatearRadicadoInstitucional, aperturaMinima: 1745 }])).rejects.toThrow(/apertura formal/);
    expect(create).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it('apertura1745 permite reservar1745, sin modificar el historial', async () => {
    const { db, tx, create, set } = dobles({ abiertoEn: 1745, autorizadoPor: 'Secretaría', referencia: 'acta' });
    const fecha = new Date('2026-09-29T15:00:00Z');
    const pendientes = await leerConsecutivosLegales(tx, db, fecha, [{ serie: 'radicados', formatear: formatearRadicadoInstitucional, aperturaMinima: 1745 }]);
    confirmarConsecutivosLegales(tx, fecha, pendientes);
    expect(create).toHaveBeenCalledWith({ path: 'unicidad_radicados/1-110-202609-00001745' }, expect.objectContaining({ consecutivo: 1745 }));
    expect(set).toHaveBeenCalledTimes(1);
  });
});

describe('propuesta oficial puramente en memoria', () => {
  const entrada = { ultimo: 27, periodo: '202609', ocupados: 0, reservas: 0 };
  it('propone1744 y primer1745 sin persistir configuración', () => {
    expect(evaluarContingencia(entrada)).toEqual({ d: { accion: 'ABRIR', veniaDe: 27, nuevoUltimo: 1744 }, problemas: [], ok: true });
  });
  it.each([{ ultimo: 28 }, { periodo: '202610' }, { ocupados: 1 }, { reservas: 1 }])('aborta por cambio de condiciones: %j', (cambio) => {
    expect(evaluarContingencia({ ...entrada, ...cambio }).ok).toBe(false);
  });
});
