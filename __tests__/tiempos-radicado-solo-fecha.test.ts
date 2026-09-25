/**
 * Rescate del PR #156 — strings de SOLO fecha en `atLocalNoon`.
 *
 * `new Date('2026-01-06')` parsea MEDIANOCHE UTC, que en Bogotá (UTC−5) cae
 * el día civil ANTERIOR: un plazo legal nacería un día antes de lo que dice
 * el papel. El proyecto llamaba a esto «defecto documentado» en el test del
 * importador y mantenía una COPIA PRIVADA del parseo para esquivarlo
 * (`parsearFechaHistoricaANoonISO`). Este rescate arregla la raíz y deja la
 * lógica en UN solo sitio (`fechaCivilANoon`); estos tests vigilan las dos
 * cosas: el comportamiento y la no-duplicación.
 *
 * TZ=UTC se fija ANTES de importar para reproducir producción (Vercel corre
 * en UTC) — misma disciplina que __tests__ del bloque de términos.
 */
process.env.TZ = 'UTC';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atLocalNoon, fechaCivilANoon } from '@/lib/tiempos-radicado';

/** [año, mes(1-based), día] por getters locales (estable a mediodía). */
function ymd(d: Date): [number, number, number] {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
}

describe('atLocalNoon — solo fecha se toma como día civil (RS-1, rescate #156)', () => {
  it('"YYYY-MM-DD" NO se corre al día anterior', () => {
    // Con el defecto: new Date('2026-11-13') = medianoche UTC → 12-nov Bogotá.
    expect(ymd(atLocalNoon('2026-11-13'))).toEqual([2026, 11, 13]);
    expect(ymd(atLocalNoon('2026-01-06'))).toEqual([2026, 1, 6]);
  });

  it('solo-fecha y su instante mediodía-Bogotá coinciden en el día', () => {
    expect(ymd(atLocalNoon('2026-11-13'))).toEqual(ymd(atLocalNoon('2026-11-13T12:00:00-05:00')));
  });

  it('los instantes completos siguen anclando por Bogotá (no cambió la otra vía)', () => {
    // 04:30Z = 23:30 Bogotá del día anterior — el caso RS-1 original.
    expect(ymd(atLocalNoon('2026-11-13T04:30:00.000Z'))).toEqual([2026, 11, 12]);
    expect(ymd(atLocalNoon('2026-11-13T05:00:00.000Z'))).toEqual([2026, 11, 13]);
  });

  it('fecha calendario imposible → Invalid Date, NO se normaliza en silencio', () => {
    // Antes: '2026-02-31' → 2 de marzo, sin aviso. El contrato de atLocalNoon
    // es no lanzar (sumarMesCalendario depende de eso): Invalid Date es la
    // señal correcta — visible para toda guarda Number.isNaN existente.
    expect(Number.isNaN(atLocalNoon('2026-02-31').getTime())).toBe(true);
    expect(Number.isNaN(atLocalNoon('2026-02-30').getTime())).toBe(true);
    expect(Number.isNaN(atLocalNoon('2026-13-01').getTime())).toBe(true);
  });

  it('el resultado queda anclado a mediodía local', () => {
    expect(atLocalNoon('2026-11-13').getHours()).toBe(12);
  });
});

describe('fechaCivilANoon — el parseo único', () => {
  it('parsea el día civil literal', () => {
    expect(ymd(fechaCivilANoon('2026-01-06')!)).toEqual([2026, 1, 6]);
  });

  it('tolera espacios alrededor (los Excel históricos los traen)', () => {
    expect(ymd(fechaCivilANoon(' 2026-01-06 ')!)).toEqual([2026, 1, 6]);
  });

  it('null ante formato ajeno o fecha imposible', () => {
    expect(fechaCivilANoon('06/01/2026')).toBeNull();
    expect(fechaCivilANoon('2026-1-6')).toBeNull();
    expect(fechaCivilANoon('2026-02-31')).toBeNull();
    expect(fechaCivilANoon('')).toBeNull();
  });
});

describe('la copia privada quedó muerta de verdad (Principio 3)', () => {
  it('el importador delega en fechaCivilANoon en vez de reimplementar', () => {
    const fuente = readFileSync(
      join(process.cwd(), 'lib/migracion/planificar-importacion-consecutivo.ts'),
      'utf8',
    );
    expect(fuente).toContain('fechaCivilANoon');
    // La firma del parseo duplicado: construir Date por componentes y
    // re-validar contra ellos. Si reaparece aquí, volvió la copia.
    expect(fuente).not.toMatch(/getFullYear\(\)\s*!==\s*year/);
  });
});
