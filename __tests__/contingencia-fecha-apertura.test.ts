import { describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { periodoColombia } from '@/lib/fecha-colombia';
import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';
import { leerConsecutivosLegales, confirmarConsecutivosLegales } from '@/lib/server/consecutivo-legal';
import {
  contarColisionesDesde,
  evaluarContingencia,
} from '@/scripts/operacion/abrir-series.mjs';

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
    expect(formatearRadicadoInstitucional(37, fecha)).toBe(`1-110-${anio}${mes}-00000037`);
  });
  it('rechaza fecha inválida', () => expect(() => periodoColombia(new Date('inválida'))).toThrow());
});

const NUMERO_SINTETICO = 4321;

function dobles(
  apertura?: { abiertoEn: number; autorizadoPor: string; referencia: string },
  ultimo = NUMERO_SINTETICO - 1,
) {
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
    expect(set).toHaveBeenCalledWith(
      { path: 'counters/radicados-2026' },
      expect.objectContaining({ anio: 2026, ultimo: NUMERO_SINTETICO }),
      { merge: true },
    );
  });
  it.each([
    undefined,
    { abiertoEn: NUMERO_SINTETICO + 1, autorizadoPor: 'A', referencia: 'R' },
    { abiertoEn: NUMERO_SINTETICO, autorizadoPor: '', referencia: 'R' },
  ])('no emite sin acta de apertura coincidente', async (apertura) => {
    const { db, tx, create, set } = dobles(apertura);
    await expect(leerConsecutivosLegales(tx, db, new Date(), [{
      serie: 'radicados',
      formatear: formatearRadicadoInstitucional,
      aperturaMinima: NUMERO_SINTETICO,
    }])).rejects.toThrow(/apertura formal/);
    expect(create).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it('una apertura sintética permite reservar N, sin modificar el historial', async () => {
    const { db, tx, create, set } = dobles({
      abiertoEn: NUMERO_SINTETICO,
      autorizadoPor: 'Secretaría',
      referencia: 'acta',
    });
    const fecha = new Date('2026-09-29T15:00:00Z');
    const pendientes = await leerConsecutivosLegales(tx, db, fecha, [{
      serie: 'radicados',
      formatear: formatearRadicadoInstitucional,
      aperturaMinima: NUMERO_SINTETICO,
    }]);
    confirmarConsecutivosLegales(tx, fecha, pendientes);
    expect(create).toHaveBeenCalledWith(
      { path: 'unicidad_radicados/1-110-202609-00004321' },
      expect.objectContaining({ consecutivo: NUMERO_SINTETICO }),
    );
    expect(set).toHaveBeenCalledTimes(1);
  });
});

describe('propuesta oficial puramente en memoria', () => {
  const entrada = { ultimo: 29, primerNumero: 1901, ocupados: 0, reservas: 0 };
  it('usa el número confirmado en el libro sin persistir configuración', () => {
    expect(evaluarContingencia(entrada)).toEqual({
      d: { accion: 'ABRIR', veniaDe: 29, nuevoUltimo: 1900 },
      problemas: [],
      ok: true,
    });
  });
  it.each([
    { primerNumero: 29 },
    { primerNumero: 0 },
    { primerNumero: 100_000_000 },
    { ocupados: 1 },
    { reservas: 1 },
  ])('aborta por una condición incompatible: %j', (cambio) => {
    expect(evaluarContingencia({ ...entrada, ...cambio }).ok).toBe(false);
  });

  it('admite otro N válido sin depender de una cifra histórica', () => {
    expect(evaluarContingencia({ ...entrada, primerNumero: 2507 }).d).toEqual({
      accion: 'ABRIR',
      veniaDe: 29,
      nuevoUltimo: 2506,
    });
  });

  it('falla cerrado si --primer-numero se usa fuera del preflight de solo lectura', () => {
    const resultado = spawnSync(
      process.execPath,
      ['scripts/operacion/abrir-series.mjs', '--proyecto', 'proyecto-sintetico', '--primer-numero', '1901'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: '' },
      },
    );

    expect(resultado.status).toBe(1);
    expect(resultado.stderr).toContain('--primer-numero solo es válido con --propuesta-contingencia-solo-lectura');
    expect(resultado.stderr).toContain('Nada se escribió');
    expect(resultado.stderr).not.toContain('Falta FIREBASE_SERVICE_ACCOUNT');
  }, 15_000);
});

describe('barrido de colisiones del preflight', () => {
  const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

  it('rechaza cualquier consecutivo del año vigente igual o posterior a N', () => {
    const docs = [
      doc('1-110-202610-00001900', { control: { consecutivo: 1900 } }),
      doc('1-110-202610-00001901', { control: { consecutivo: 1901 } }),
      doc('1-110-202611-00002500', { control: { consecutivo: 2500 } }),
    ];
    expect(contarColisionesDesde(docs, 2026, 1901)).toBe(2);
  });

  it('ignora otro año y falla cerrado ante un número ambiguo del año vigente', () => {
    const docs = [
      doc('1-110-202510-00002500', { control: { consecutivo: 2500 } }),
      doc('1-110-202610-sin-numero', { control: { radicadoId: '1-110-202610-sin-numero' } }),
    ];
    expect(contarColisionesDesde(docs, 2026, 1901)).toBe(1);
  });

  it('falla cerrado cuando no puede determinar el año de un registro legado', () => {
    const docs = [
      doc('registro-legado-sin-anio', { consecutivo: 1901 }),
    ];
    expect(contarColisionesDesde(docs, 2026, 1901)).toBe(1);
  });
});
