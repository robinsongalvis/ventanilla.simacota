import { describe, expect, it } from 'vitest';
import { diasRestantesHabiles, sumarDiasHabiles } from '@/lib/tiempos-radicado';
import {
  calcularVencimiento,
  derivarEventosTermino,
  type EventoTermino,
  type PoliticaTermino,
} from '@/lib/motor-expedientes/termino';
import type { Actuacion } from '@/lib/motor-expedientes/tipos';

/* PASO 7 (Fase 2 arranque) — término como proyección sobre eventos. */

const RADICACION_FECHA = new Date(2026, 5, 1, 12, 0, 0, 0); // 1-jun-2026, mediodía (convención atLocalNoon)

const POLITICA_REINICIO: PoliticaTermino = {
  plazoDias: 45,
  computo: 'HABILES',
  efectoSubsanacion: 'REINICIO_A_CERO',
  anclaje: 'RADICACION_EN_DEBIDA_FORMA',
};
const POLITICA_SUSPENSION: PoliticaTermino = { ...POLITICA_REINICIO, efectoSubsanacion: 'SUSPENSION_REANUDACION' };

describe('calcularVencimiento — sin radicación en debida forma → null', () => {
  it('lista vacía → null', () => {
    expect(calcularVencimiento([], POLITICA_REINICIO)).toBeNull();
  });
  it('eventos sin RADICACION_DEBIDA_FORMA → null', () => {
    const eventos: EventoTermino[] = [{ tipo: 'MODIFICACION_SOLICITUD', fecha: RADICACION_FECHA }];
    expect(calcularVencimiento(eventos, POLITICA_REINICIO)).toBeNull();
  });
});

describe('calcularVencimiento — sin más eventos, ambas políticas coinciden (45 hábiles desde la radicación)', () => {
  it('REINICIO_A_CERO y SUSPENSION_REANUDACION dan el MISMO vencimiento si no hay acta/respuesta/modificación', () => {
    const eventos: EventoTermino[] = [{ tipo: 'RADICACION_DEBIDA_FORMA', fecha: RADICACION_FECHA }];
    const vReinicio = calcularVencimiento(eventos, POLITICA_REINICIO)!;
    const vSuspension = calcularVencimiento(eventos, POLITICA_SUSPENSION)!;
    const esperado = sumarDiasHabiles(RADICACION_FECHA, 45);
    expect(vReinicio.getTime()).toBe(esperado.getTime());
    expect(vSuspension.getTime()).toBe(esperado.getTime());
  });
});

describe('calcularVencimiento — REINICIO_A_CERO vs SUSPENSION_REANUDACION: MISMOS eventos, resultado distinto', () => {
  // Acta de observaciones 15 días hábiles (~3 semanas) tras la radicación;
  // el ciudadano responde 5 días hábiles después del acta.
  const actaFecha = sumarDiasHabiles(RADICACION_FECHA, 15);
  const respuestaFecha = sumarDiasHabiles(actaFecha, 5);
  const eventos: EventoTermino[] = [
    { tipo: 'RADICACION_DEBIDA_FORMA', fecha: RADICACION_FECHA },
    { tipo: 'ACTA_OBSERVACIONES', fecha: actaFecha },
    { tipo: 'RESPUESTA_SUBSANACION', fecha: respuestaFecha },
  ];

  it('REINICIO_A_CERO: 45 hábiles desde la RESPUESTA (el tiempo pre-acta se descarta por completo)', () => {
    const vencimiento = calcularVencimiento(eventos, POLITICA_REINICIO)!;
    expect(vencimiento.getTime()).toBe(sumarDiasHabiles(respuestaFecha, 45).getTime());
  });

  it('SUSPENSION_REANUDACION: solo se restituyen los hábiles que quedaban al momento del acta (45-15=30 desde la respuesta)', () => {
    const vencimiento = calcularVencimiento(eventos, POLITICA_SUSPENSION)!;
    expect(vencimiento.getTime()).toBe(sumarDiasHabiles(respuestaFecha, 30).getTime());
  });

  it('la diferencia entre ambas políticas es EXACTAMENTE los 15 días hábiles (~3 semanas) que REINICIO_A_CERO le regala al trámite', () => {
    const vReinicio = calcularVencimiento(eventos, POLITICA_REINICIO)!;
    const vSuspension = calcularVencimiento(eventos, POLITICA_SUSPENSION)!;
    const diferenciaHabiles = diasRestantesHabiles(vReinicio, vSuspension);
    expect(diferenciaHabiles).toBe(15); // 15 días hábiles ≈ 3 semanas de 5 días
    expect(vReinicio.getTime()).toBeGreaterThan(vSuspension.getTime()); // REINICIO_A_CERO vence MÁS TARDE
  });
});

describe('calcularVencimiento — REINICIO_A_CERO también reinicia con MODIFICACION_SOLICITUD', () => {
  it('el ancla es la modificación, no la radicación', () => {
    const modFecha = sumarDiasHabiles(RADICACION_FECHA, 10);
    const eventos: EventoTermino[] = [
      { tipo: 'RADICACION_DEBIDA_FORMA', fecha: RADICACION_FECHA },
      { tipo: 'MODIFICACION_SOLICITUD', fecha: modFecha },
    ];
    const vencimiento = calcularVencimiento(eventos, POLITICA_REINICIO)!;
    expect(vencimiento.getTime()).toBe(sumarDiasHabiles(modFecha, 45).getTime());
  });

  it('con varios reinicios, el ancla es el ÚLTIMO cronológicamente (sin tope, respuesta 4 de Jurídica)', () => {
    const acta1 = sumarDiasHabiles(RADICACION_FECHA, 10);
    const resp1 = sumarDiasHabiles(acta1, 5);
    const acta2 = sumarDiasHabiles(resp1, 8);
    const resp2 = sumarDiasHabiles(acta2, 3);
    const eventos: EventoTermino[] = [
      { tipo: 'RADICACION_DEBIDA_FORMA', fecha: RADICACION_FECHA },
      { tipo: 'ACTA_OBSERVACIONES', fecha: acta1 },
      { tipo: 'RESPUESTA_SUBSANACION', fecha: resp1 },
      { tipo: 'ACTA_OBSERVACIONES', fecha: acta2 },
      { tipo: 'RESPUESTA_SUBSANACION', fecha: resp2 },
    ];
    const vencimiento = calcularVencimiento(eventos, POLITICA_REINICIO)!;
    expect(vencimiento.getTime()).toBe(sumarDiasHabiles(resp2, 45).getTime());
  });
});

describe('derivarEventosTermino — deriva desde Actuacion[] real (append-only)', () => {
  const base: Omit<Actuacion, 'id' | 'tipo' | 'origen' | 'fecha'> = {
    expedienteId: 'exp-1', etapa: 'revision', actorUid: 'u1', actorNombre: 'M', actorRol: 'FUNCIONARIO',
  };

  it('mapea los slugs relevantes y ancla la fecha con atLocalNoon', () => {
    const actuaciones: Actuacion[] = [
      { ...base, id: 'a1', tipo: 'radicacion-debida-forma', origen: 'REAL', fecha: '2026-06-01T15:00:00.000Z' },
      { ...base, id: 'a2', tipo: 'acta-observaciones', origen: 'REAL', fecha: '2026-06-20T15:00:00.000Z' },
    ];
    const eventos = derivarEventosTermino(actuaciones);
    expect(eventos.map((e) => e.tipo)).toEqual(['RADICACION_DEBIDA_FORMA', 'ACTA_OBSERVACIONES']);
  });

  it('R9: excluye TODA actuación con origen RECONSTRUIDO, sin excepción', () => {
    const actuaciones: Actuacion[] = [
      { ...base, id: 'a1', tipo: 'radicacion-debida-forma', origen: 'REAL', fecha: '2026-06-01T15:00:00.000Z' },
      { ...base, id: 'a2', tipo: 'acta-observaciones', origen: 'RECONSTRUIDO', fecha: '2026-06-20T15:00:00.000Z' },
      { ...base, id: 'a3', tipo: 'respuesta-subsanacion', origen: 'RECONSTRUIDO', fecha: '2026-07-01T15:00:00.000Z' },
    ];
    const eventos = derivarEventosTermino(actuaciones);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.tipo).toBe('RADICACION_DEBIDA_FORMA');
  });

  it('ignora tipos de actuación sin relevancia para el término (D1: tipo es dato abierto)', () => {
    const actuaciones: Actuacion[] = [
      { ...base, id: 'a1', tipo: 'radicacion-debida-forma', origen: 'REAL', fecha: '2026-06-01T15:00:00.000Z' },
      { ...base, id: 'a2', tipo: 'nota-interna', origen: 'REAL', fecha: '2026-06-05T15:00:00.000Z' },
    ];
    const eventos = derivarEventosTermino(actuaciones);
    expect(eventos).toHaveLength(1);
  });

  it('lista vacía → lista vacía (no lanza)', () => {
    expect(derivarEventosTermino([])).toEqual([]);
  });
});

describe('integración: derivarEventosTermino + calcularVencimiento sobre trazabilidad mixta REAL/RECONSTRUIDO', () => {
  it('un acta RECONSTRUIDA no dispara la suspensión bajo SUSPENSION_REANUDACION', () => {
    const base: Omit<Actuacion, 'id' | 'tipo' | 'origen' | 'fecha'> = {
      expedienteId: 'exp-1', etapa: 'revision', actorUid: 'u1', actorNombre: 'M', actorRol: 'FUNCIONARIO',
    };
    const actuaciones: Actuacion[] = [
      { ...base, id: 'a1', tipo: 'radicacion-debida-forma', origen: 'REAL', fecha: RADICACION_FECHA.toISOString() },
      { ...base, id: 'a2', tipo: 'acta-observaciones', origen: 'RECONSTRUIDO', fecha: sumarDiasHabiles(RADICACION_FECHA, 5).toISOString() },
    ];
    const eventos = derivarEventosTermino(actuaciones);
    const vencimiento = calcularVencimiento(eventos, POLITICA_SUSPENSION)!;
    // Como el acta reconstruida se excluyó, el resultado es el mismo que sin ningún evento adicional.
    expect(vencimiento.getTime()).toBe(sumarDiasHabiles(RADICACION_FECHA, 45).getTime());
  });
});
