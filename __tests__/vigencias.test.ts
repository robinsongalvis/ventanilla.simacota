import { describe, expect, it } from 'vitest';
import {
  FECHA_CORTE_D1783,
  VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE,
  VIGENCIAS_ANTERIORES_D1469_SEMILLA,
  regimenAplicable,
  proyectarVencimientoVigencia,
} from '@/lib/motor-expedientes/vigencias';

/* DF-8 (ADR-0029) — estructura de vigencias, semillas NO ejecutables + funciones puras que SÍ operan sobre datos del caller. */

describe('regimenAplicable — transición D.1783/2021 art. 36', () => {
  it('fecha exactamente en el corte (2021-12-20) → D1783', () => {
    expect(regimenAplicable(FECHA_CORTE_D1783)).toBe('D1783');
  });
  it('un día antes del corte → ANTERIOR', () => {
    expect(regimenAplicable('2021-12-19')).toBe('ANTERIOR');
  });
  it('un día después del corte → D1783', () => {
    expect(regimenAplicable('2021-12-21')).toBe('D1783');
  });
  it('fecha muy anterior (2015) → ANTERIOR', () => {
    expect(regimenAplicable('2015-06-01')).toBe('ANTERIOR');
  });
  it('fecha reciente (2026) → D1783', () => {
    expect(regimenAplicable('2026-06-01')).toBe('D1783');
  });
  it('acepta Date además de string', () => {
    expect(regimenAplicable(new Date(2026, 0, 1))).toBe('D1783');
  });
});

describe('proyectarVencimientoVigencia — meses calendario desde la firmeza', () => {
  it('36 meses desde una firmeza da la fecha correspondiente (reutiliza sumarMesCalendario)', () => {
    const regla = VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE.reglas[0]!; // 36 meses
    expect(regla.meses).toBe(36);
    const vencimiento = proyectarVencimientoVigencia(regla, '2026-08-15T12:00:00.000Z');
    expect(vencimiento.getFullYear()).toBe(2029);
    expect(vencimiento.getMonth()).toBe(7); // agosto (0-index)
  });

  it('12 meses improrrogable (subdivisión) desde una firmeza', () => {
    const reglaSubdivision = VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE.reglas.find((r) => r.meses === 12)!;
    const vencimiento = proyectarVencimientoVigencia(reglaSubdivision, '2026-01-31T12:00:00.000Z');
    // Código Civil art. 67 (sumarMesCalendario): 31-ene +12m → 31-ene del año siguiente.
    expect(vencimiento.getFullYear()).toBe(2027);
    expect(vencimiento.getMonth()).toBe(0);
    expect(vencimiento.getDate()).toBe(31);
  });

  it('función pura: NO lee ninguna semilla por sí sola, opera sobre la regla que el caller pasa', () => {
    const reglaSintetica = { figuras: ['X'], meses: 6 };
    const vencimiento = proyectarVencimientoVigencia(reglaSintetica, '2026-01-01T12:00:00.000Z');
    expect(vencimiento.getMonth()).toBe(6); // julio
  });
});

describe('semillas — estructura declarada (contenido documental, no ejecutable — ver contrato anti-consumo)', () => {
  it('VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE: regla de 36 meses (obra nueva/urbanización/parcelación) tiene prórroga de 12 y revalidación ≤2 meses', () => {
    const regla36 = VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE.reglas.find((r) => r.meses === 36)!;
    expect(regla36.prorroga).toEqual({ meses: 12, unica: true, radicarDiasHabilesAntesMin: 30 });
    expect(regla36.revalidacion).toEqual({ ventanaMesesTrasVencimiento: 2, unica: true });
  });

  it('regla de 24 meses (construcción no-obra-nueva + espacio público) tiene prórroga de 12, SIN revalidación', () => {
    const regla24 = VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE.reglas.find((r) => r.meses === 24)!;
    expect(regla24.prorroga?.meses).toBe(12);
    expect(regla24.revalidacion).toBeUndefined();
  });

  it('regla de 12 meses (subdivisión + saneamientos) es improrrogable, sin prórroga ni revalidación (par. 4)', () => {
    const regla12 = VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE.reglas.find((r) => r.meses === 12)!;
    expect(regla12.improrrogable).toBe(true);
    expect(regla12.prorroga).toBeUndefined();
    expect(regla12.revalidacion).toBeUndefined();
  });

  it('VIGENCIAS_ANTERIORES_D1469_SEMILLA: subdivisión 6 meses, improrrogable (art. 47 histórico)', () => {
    expect(VIGENCIAS_ANTERIORES_D1469_SEMILLA.id).toBe('ANTERIOR');
    expect(VIGENCIAS_ANTERIORES_D1469_SEMILLA.reglas).toHaveLength(1);
    const regla = VIGENCIAS_ANTERIORES_D1469_SEMILLA.reglas[0]!;
    expect(regla.meses).toBe(6);
    expect(regla.improrrogable).toBe(true);
  });

  it('D1783 vigenteDesde coincide con FECHA_CORTE_D1783', () => {
    expect(VIGENCIAS_D1783_SEMILLA_NO_EJECUTABLE.vigenteDesde).toBe(FECHA_CORTE_D1783);
  });
});
