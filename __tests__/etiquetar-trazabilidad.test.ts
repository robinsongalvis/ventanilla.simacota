import { describe, expect, it } from 'vitest';
import type { TrazabilidadRadicado } from '@/src/types/ventanilla';
import {
  etiquetarUltimaActuacion,
  formatFechaRelativa,
} from '@/lib/proxima-accion/etiquetar-trazabilidad';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 1 — mapper de trazabilidad + fecha relativa.
══════════════════════════════════════════════════════════════ */

function evento(overrides: Partial<TrazabilidadRadicado>): TrazabilidadRadicado {
  const base: TrazabilidadRadicado = {
    fecha:       new Date().toISOString(),
    actorUid:    'uid-abc',
    actorNombre: 'Funcionaria',
    nota:        'Nota',
    accion:      'RADICACION',
  };
  return { ...base, ...overrides };
}

describe('Panel Op Fase 1 — etiquetarUltimaActuacion', () => {
  /* 1 · Acciones conocidas del enum */
  it('traduce acciones conocidas a labels humanos cortos', () => {
    expect(etiquetarUltimaActuacion(evento({ accion: 'RADICACION' })).label)
      .toBe('Radicado recibido');
    expect(etiquetarUltimaActuacion(evento({ accion: 'ASIGNACION' })).label)
      .toBe('Asignada a dependencia');
    expect(etiquetarUltimaActuacion(evento({ accion: 'RESPUESTA_FUNCIONARIO' })).label)
      .toBe('Respuesta oficial registrada');
  });

  /* 2 · Acciones específicas de Sprints 1.5/2/3 */
  it('traduce eventos de Sprints operativos', () => {
    expect(etiquetarUltimaActuacion(evento({ accion: 'DATOS_NO_APORTADOS_MARCADOS' })).label)
      .toBe('Datos no aportados registrados');
    expect(etiquetarUltimaActuacion(evento({ accion: 'CONSTANCIA_ENVIADA_CORREO' })).label)
      .toBe('Constancia enviada por correo');
    expect(etiquetarUltimaActuacion(evento({ accion: 'DOCUMENTO_SELLADO' })).label)
      .toBe('Documento sellado');
  });

  /* 3 · Fallback para acción no mapeada */
  it('devuelve el string tal cual si la acción no está mapeada', () => {
    const raro = etiquetarUltimaActuacion(evento({ accion: 'ACCION_LEGACY_XYZ' as never }));
    expect(raro.label).toBe('ACCION_LEGACY_XYZ');
    expect(raro.accionRaw).toBe('ACCION_LEGACY_XYZ');
  });
});

describe('Panel Op Fase 1 — formatFechaRelativa', () => {
  const REFERENCIA = new Date('2026-07-02T15:00:00.000Z');

  /* 4 · Minutos y horas */
  it('formatea minutos y horas', () => {
    expect(formatFechaRelativa('2026-07-02T14:55:00.000Z', REFERENCIA)).toBe('hace 5 min');
    expect(formatFechaRelativa('2026-07-02T12:00:00.000Z', REFERENCIA)).toBe('hace 3 h');
    expect(formatFechaRelativa('2026-07-02T15:00:00.000Z', REFERENCIA)).toBe('ahora');
  });

  /* 5 · Días, meses, años */
  it('formatea días, meses y años', () => {
    expect(formatFechaRelativa('2026-06-30T15:00:00.000Z', REFERENCIA)).toBe('hace 2 días');
    expect(formatFechaRelativa('2026-06-01T15:00:00.000Z', REFERENCIA)).toMatch(/hace 1 mes/);
    expect(formatFechaRelativa('2025-06-30T15:00:00.000Z', REFERENCIA)).toMatch(/hace 1 año/);
    expect(formatFechaRelativa('2024-06-30T15:00:00.000Z', REFERENCIA)).toMatch(/hace 2 años/);
  });

  /* 6 · Fechas inválidas y futuras */
  it('maneja fechas inválidas y futuras sin romper', () => {
    expect(formatFechaRelativa('esto-no-es-una-fecha', REFERENCIA)).toBe('—');
    // Fecha en el futuro respecto a la referencia → "ahora" (delta clamp a 0).
    expect(formatFechaRelativa('2027-01-01T00:00:00.000Z', REFERENCIA)).toBe('ahora');
  });
});
