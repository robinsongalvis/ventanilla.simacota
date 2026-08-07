import { describe, expect, it } from 'vitest';
import { festivosColombia, sumarDiasHabiles, atLocalNoon } from '@/lib/tiempos-radicado';
import {
  horaBogota,
  esCandidatoHoraTardia,
  atLocalNoonBogota,
  festivosColombia as festivosColombiaPortado,
  recalcularVencimiento,
  evaluarCandidato,
} from '../scripts/laboratorio/barrido-vencimientos-tz.mjs';

/**
 * PASO 10 — barrido one-off transicional del fix de TZ (ENTREGABLE, NO
 * EJECUTADO contra Firestore por este test; solo su lógica PURA).
 *
 * `scripts/laboratorio/barrido-vencimientos-tz.mjs` porta un subconjunto de
 * `lib/tiempos-radicado.ts` porque corre como Node ESM plano (sin loader de
 * TypeScript, mismo patrón que `detectar-consecutivos-fantasma.mjs`). Este
 * archivo es la RED DE SEGURIDAD de esa duplicación: si el calendario
 * festivo o el anclaje de `lib/tiempos-radicado.ts` cambian y el script no
 * se actualiza junto, la prueba de equivalencia cruzada de abajo falla.
 */

describe('equivalencia cruzada — el puerto del script coincide con lib/tiempos-radicado.ts', () => {
  it('festivosColombia: mismo conjunto de fechas para 2025, 2026 y 2027', () => {
    for (const anio of [2025, 2026, 2027]) {
      const real = [...festivosColombia(anio)].sort();
      const portado = [...festivosColombiaPortado(anio)].sort();
      expect(portado).toEqual(real);
    }
  });

  it('atLocalNoonBogota: mismo resultado que atLocalNoon para instantes tardíos (el caso RS-1)', () => {
    const instantes = [
      '2026-08-06T23:30:00-05:00',
      '2026-08-06T10:00:00-05:00',
      '2026-01-06T00:00:00-05:00',
      '2027-12-31T23:59:00-05:00',
    ];
    for (const iso of instantes) {
      expect(atLocalNoonBogota(iso).getTime()).toBe(atLocalNoon(iso).getTime());
    }
  });

  it('recalcularVencimiento (HABILES) coincide con sumarDiasHabiles real para varios casos', () => {
    const casos = [
      { desde: '2026-06-01T23:30:00-05:00', dias: 15 },
      { desde: '2026-01-16T09:00:00-05:00', dias: 1 },
      { desde: '2025-12-20T20:00:00-05:00', dias: 10 },
    ];
    for (const c of casos) {
      const real = sumarDiasHabiles(c.desde, c.dias).toISOString();
      const portado = recalcularVencimiento(c.desde, c.dias, 'HABILES');
      expect(portado).toBe(real);
    }
  });

  it('recalcularVencimiento (CALENDARIO) suma días calendario simples', () => {
    const portado = recalcularVencimiento('2026-06-01T23:30:00-05:00', 30, 'CALENDARIO');
    // 30 días calendario desde el 1-jun (día civil Bogotá) = 1-jul.
    const fecha = new Date(portado);
    expect(fecha.getMonth()).toBe(6); // julio (0-index)
    expect(fecha.getDate()).toBe(1);
  });
});

describe('horaBogota / esCandidatoHoraTardia', () => {
  it('23:30 hora Bogotá → hora 23, candidato (>= 19:00)', () => {
    expect(horaBogota('2026-08-06T23:30:00-05:00')).toBe(23);
    expect(esCandidatoHoraTardia('2026-08-06T23:30:00-05:00')).toBe(true);
  });

  it('10:00 hora Bogotá → hora 10, NO candidato', () => {
    expect(horaBogota('2026-08-06T10:00:00-05:00')).toBe(10);
    expect(esCandidatoHoraTardia('2026-08-06T10:00:00-05:00')).toBe(false);
  });

  it('19:00 exacto → SÍ candidato (umbral inclusivo)', () => {
    expect(esCandidatoHoraTardia('2026-08-06T19:00:00-05:00')).toBe(true);
  });

  it('18:59 → NO candidato', () => {
    expect(esCandidatoHoraTardia('2026-08-06T18:59:00-05:00')).toBe(false);
  });

  it('instante vacío/nulo → NO candidato (no lanza)', () => {
    expect(esCandidatoHoraTardia(null)).toBe(false);
    expect(esCandidatoHoraTardia('')).toBe(false);
  });
});

describe('evaluarCandidato — lógica pura de detección (sin Firestore)', () => {
  const terminoBase = { diasRespuesta: 15, unidad: 'HABILES' };

  it('radicado tardío con vencimiento almacenado INCORRECTO (calculado con el bug, +1 día) → difiere: true', () => {
    const fechaRadicado = '2026-06-01T23:30:00-05:00'; // 23:30 Bogotá → candidato
    const vencimientoCorrecto = recalcularVencimiento(fechaRadicado, 15, 'HABILES');
    // Simula el valor que el bug habría almacenado: el algoritmo viejo leía
    // el día UTC (1 día adelante) como ancla — aproximamos sumando 1 día
    // calendario al resultado correcto (suficiente para que sean distintos;
    // el punto de esta prueba es "difiere:true", no reproducir el bug bit a bit).
    const vencimientoBuggy = new Date(new Date(vencimientoCorrecto).getTime() + 86400000).toISOString();
    const radicado = {
      estadoActual: 'EN_PROCESO',
      control: { fechaRadicado },
      termino: { ...terminoBase, fechaVencimiento: vencimientoBuggy },
    };
    const resultado = evaluarCandidato(radicado);
    expect(resultado.esCandidato).toBe(true);
    expect(resultado.difiere).toBe(true);
    expect(resultado.recalculado).toBe(vencimientoCorrecto);
  });

  it('radicado tardío con vencimiento almacenado YA correcto → difiere: false (no es falso positivo)', () => {
    const fechaRadicado = '2026-06-01T23:30:00-05:00';
    const vencimientoCorrecto = recalcularVencimiento(fechaRadicado, 15, 'HABILES');
    const radicado = {
      estadoActual: 'EN_PROCESO',
      control: { fechaRadicado },
      termino: { ...terminoBase, fechaVencimiento: vencimientoCorrecto },
    };
    expect(evaluarCandidato(radicado).difiere).toBe(false);
  });

  it('radicado radicado ANTES de las 19:00 → ni siquiera es candidato', () => {
    const radicado = {
      estadoActual: 'EN_PROCESO',
      control: { fechaRadicado: '2026-06-01T09:00:00-05:00' },
      termino: { ...terminoBase, fechaVencimiento: '2026-06-22T12:00:00.000Z' },
    };
    expect(evaluarCandidato(radicado).esCandidato).toBe(false);
  });

  it('usa fechaRequerimiento de la suspensión si existe, en vez de fechaRadicado', () => {
    const radicado = {
      estadoActual: 'EN_SUBSANACION',
      control: { fechaRadicado: '2026-06-01T09:00:00-05:00' }, // temprano, no candidato por sí solo
      termino: {
        ...terminoBase,
        fechaVencimiento: '2026-06-22T12:00:00.000Z',
        suspension: { fechaRequerimiento: '2026-06-05T22:00:00-05:00' }, // tardío
      },
    };
    const resultado = evaluarCandidato(radicado);
    expect(resultado.esCandidato).toBe(true);
    expect(resultado.instanteRelevante).toBe('2026-06-05T22:00:00-05:00');
  });

  it('sin fechaRadicado ni fechaRequerimiento → no candidato, no lanza', () => {
    const radicado = { estadoActual: 'EN_PROCESO', control: {}, termino: terminoBase };
    expect(() => evaluarCandidato(radicado)).not.toThrow();
    expect(evaluarCandidato(radicado).esCandidato).toBe(false);
  });
});
