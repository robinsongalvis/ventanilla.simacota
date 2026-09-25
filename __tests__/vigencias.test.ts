import { describe, expect, it } from 'vitest';
import {
  FECHA_CORTE_D1783,
  VIGENCIAS_D1783,
  VIGENCIAS_ANTERIORES_D1469,
  regimenAplicable,
  proyectarVencimientoVigencia,
  seleccionarReglaVigencia,
  calcularVencimientoVigencia,
  validarSolicitudProrroga,
  type ErrorVigencia,
} from '@/lib/motor-expedientes/vigencias';

function err(x: unknown): ErrorVigencia {
  if (!x || typeof x !== 'object' || !('codigo' in x)) throw new Error('esperaba un ErrorVigencia');
  return x as ErrorVigencia;
}

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
    const regla = VIGENCIAS_D1783.reglas[0]!; // 36 meses
    expect(regla.meses).toBe(36);
    const vencimiento = proyectarVencimientoVigencia(regla, '2026-08-15T12:00:00.000Z');
    expect(vencimiento.getFullYear()).toBe(2029);
    expect(vencimiento.getMonth()).toBe(7); // agosto (0-index)
  });

  it('12 meses improrrogable (subdivisión) desde una firmeza', () => {
    const reglaSubdivision = VIGENCIAS_D1783.reglas.find((r) => r.meses === 12)!;
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
  it('VIGENCIAS_D1783: regla de 36 meses (obra nueva/urbanización/parcelación) tiene prórroga de 12 y revalidación ≤2 meses', () => {
    const regla36 = VIGENCIAS_D1783.reglas.find((r) => r.meses === 36)!;
    expect(regla36.prorroga).toEqual({ meses: 12, unica: true, radicarDiasHabilesAntesMin: 30 });
    expect(regla36.revalidacion).toEqual({ ventanaMesesTrasVencimiento: 2, unica: true });
  });

  it('regla de 24 meses (construcción no-obra-nueva + espacio público) tiene prórroga de 12, SIN revalidación', () => {
    const regla24 = VIGENCIAS_D1783.reglas.find((r) => r.meses === 24)!;
    expect(regla24.prorroga?.meses).toBe(12);
    expect(regla24.revalidacion).toBeUndefined();
  });

  it('regla de 12 meses (subdivisión + saneamientos) es improrrogable, sin prórroga ni revalidación (par. 4)', () => {
    const regla12 = VIGENCIAS_D1783.reglas.find((r) => r.meses === 12)!;
    expect(regla12.improrrogable).toBe(true);
    expect(regla12.prorroga).toBeUndefined();
    expect(regla12.revalidacion).toBeUndefined();
  });

  it('VIGENCIAS_ANTERIORES_D1469: subdivisión 6 meses, improrrogable (art. 47 histórico)', () => {
    expect(VIGENCIAS_ANTERIORES_D1469.id).toBe('ANTERIOR');
    expect(VIGENCIAS_ANTERIORES_D1469.reglas).toHaveLength(1);
    const regla = VIGENCIAS_ANTERIORES_D1469.reglas[0]!;
    expect(regla.meses).toBe(6);
    expect(regla.improrrogable).toBe(true);
  });

  it('D1783 vigenteDesde coincide con FECHA_CORTE_D1783', () => {
    expect(VIGENCIAS_D1783.vigenteDesde).toBe(FECHA_CORTE_D1783);
  });
});

/* ══════════════════════════════════════════════════════════════
   ACTIVACIÓN (Bloque "Términos y vigencias protectores", 10-ago-2026)
   — funciones que SÍ consumen la semilla. Ver procedencia en el JSDoc de
   cabecera de vigencias.ts.
══════════════════════════════════════════════════════════════ */

describe('seleccionarReglaVigencia', () => {
  it('CONSTRUCCION + modalidad obra-nueva → regla de 36 meses', () => {
    const regla = seleccionarReglaVigencia({ subtipos: ['CONSTRUCCION'], modalidadConstruccion: 'obra-nueva' }, VIGENCIAS_D1783);
    expect((regla as { meses: number }).meses).toBe(36);
  });

  it('CONSTRUCCION + otra modalidad (p. ej. ampliación) → regla de 24 meses', () => {
    const regla = seleccionarReglaVigencia({ subtipos: ['CONSTRUCCION'], modalidadConstruccion: 'ampliacion' }, VIGENCIAS_D1783);
    expect((regla as { meses: number }).meses).toBe(24);
  });

  it('CONSTRUCCION SIN modalidad → error MODALIDAD_REQUERIDA (nunca adivina)', () => {
    const resultado = seleccionarReglaVigencia({ subtipos: ['CONSTRUCCION'] }, VIGENCIAS_D1783);
    expect(err(resultado).codigo).toBe('MODALIDAD_REQUERIDA');
  });

  it('URBANIZACION (sin ambigüedad de modalidad) → 36 meses directo', () => {
    const regla = seleccionarReglaVigencia({ subtipos: ['URBANIZACION'] }, VIGENCIAS_D1783);
    expect((regla as { meses: number }).meses).toBe(36);
  });

  it.each(['SUBDIVISION_RURAL', 'SUBDIVISION_URBANA', 'RELOTEO'])('%s → 12 meses improrrogable', (figura) => {
    const regla = seleccionarReglaVigencia({ subtipos: [figura] }, VIGENCIAS_D1783);
    expect((regla as { meses: number; improrrogable?: true }).improrrogable).toBe(true);
  });

  it('más de un subtipo → COMBINADA_EN_UN_MISMO_ACTO (48 meses, único valor registrado)', () => {
    const regla = seleccionarReglaVigencia({ subtipos: ['CONSTRUCCION', 'APROBACION_PH'], modalidadConstruccion: 'obra-nueva' }, VIGENCIAS_D1783);
    expect((regla as { meses: number }).meses).toBe(48);
  });

  it('figura sin regla en el régimen → error FIGURA_SIN_REGLA', () => {
    const resultado = seleccionarReglaVigencia({ subtipos: ['APROBACION_PH_INEXISTENTE'] }, VIGENCIAS_D1783);
    expect(err(resultado).codigo).toBe('FIGURA_SIN_REGLA');
  });

  it('subtipos vacío → error FIGURA_SIN_REGLA (nunca asume una figura por defecto)', () => {
    const resultado = seleccionarReglaVigencia({ subtipos: [] }, VIGENCIAS_D1783);
    expect(err(resultado).codigo).toBe('FIGURA_SIN_REGLA');
  });
});

describe('calcularVencimientoVigencia', () => {
  it('orquesta selección + proyección: CONSTRUCCION obra-nueva, firmeza 2026-08-15 → vencimiento 2029-08 (36 meses)', () => {
    const resultado = calcularVencimientoVigencia({
      fechaFirmeza: '2026-08-15T12:00:00.000Z',
      subtipos: ['CONSTRUCCION'],
      modalidadConstruccion: 'obra-nueva',
    });
    expect(esErrorVigenciaLocal(resultado)).toBe(false);
    if (!esErrorVigenciaLocal(resultado)) {
      expect(resultado.vencimiento.getFullYear()).toBe(2029);
      expect(resultado.vencimiento.getMonth()).toBe(7);
      expect(resultado.configAplicada.meses).toBe(36);
    }
  });

  it('sin fechaRadicacion → asume D1783 (régimen vigente hoy)', () => {
    const resultado = calcularVencimientoVigencia({ fechaFirmeza: '2026-01-31T12:00:00.000Z', subtipos: ['SUBDIVISION_RURAL'] });
    expect(esErrorVigenciaLocal(resultado)).toBe(false);
    if (!esErrorVigenciaLocal(resultado)) expect(resultado.configAplicada.meses).toBe(12);
  });

  it('con fechaRadicacion ANTES del corte → régimen ANTERIOR (subdivisión 6 meses)', () => {
    const resultado = calcularVencimientoVigencia({
      fechaFirmeza: '2020-06-15T12:00:00.000Z',
      fechaRadicacion: '2020-01-10',
      subtipos: ['SUBDIVISION_URBANA'],
    });
    expect(esErrorVigenciaLocal(resultado)).toBe(false);
    if (!esErrorVigenciaLocal(resultado)) expect(resultado.configAplicada.meses).toBe(6);
  });

  it('propaga el error de selección sin calcular nada (CONSTRUCCION sin modalidad)', () => {
    const resultado = calcularVencimientoVigencia({ fechaFirmeza: '2026-01-01T12:00:00.000Z', subtipos: ['CONSTRUCCION'] });
    expect(err(resultado).codigo).toBe('MODALIDAD_REQUERIDA');
  });
});

function esErrorVigenciaLocal(x: unknown): x is ErrorVigencia {
  return typeof x === 'object' && x !== null && 'codigo' in x;
}

describe('validarSolicitudProrroga', () => {
  const VENCIMIENTO = '2026-12-15T12:00:00.000Z';
  const REGLA_CON_PRORROGA = VIGENCIAS_D1783.reglas.find((r) => r.meses === 36)!; // radicarDiasHabilesAntesMin: 30
  const REGLA_IMPRORROGABLE = VIGENCIAS_D1783.reglas.find((r) => r.improrrogable)!;

  it('subdivisión (improrrogable) → SIEMPRE NO_PRORROGABLE, sin importar la fecha', () => {
    expect(validarSolicitudProrroga({ fechaSolicitud: '2026-01-01', vencimiento: VENCIMIENTO, config: REGLA_IMPRORROGABLE })).toBe('NO_PRORROGABLE');
    expect(validarSolicitudProrroga({ fechaSolicitud: '2026-12-14', vencimiento: VENCIMIENTO, config: REGLA_IMPRORROGABLE })).toBe('NO_PRORROGABLE');
  });

  it('caso de la mesa: solicitud a T-8 días hábiles del vencimiento (mínimo 30) → EXTEMPORANEA', () => {
    // 8 días hábiles antes del 2026-12-15 (martes) — cuenta hacia atrás sin festivos ni fines de semana relevantes en ese tramo corto.
    const resultado = validarSolicitudProrroga({ fechaSolicitud: '2026-12-03T12:00:00.000Z', vencimiento: VENCIMIENTO, config: REGLA_CON_PRORROGA });
    expect(resultado).toBe('EXTEMPORANEA');
  });

  it('solicitud con margen amplio (muchos días hábiles antes) → OK', () => {
    const resultado = validarSolicitudProrroga({ fechaSolicitud: '2026-08-01T12:00:00.000Z', vencimiento: VENCIMIENTO, config: REGLA_CON_PRORROGA });
    expect(resultado).toBe('OK');
  });

  it('solicitud DESPUÉS del vencimiento → VIGENCIA_VENCIDA', () => {
    const resultado = validarSolicitudProrroga({ fechaSolicitud: '2026-12-20T12:00:00.000Z', vencimiento: VENCIMIENTO, config: REGLA_CON_PRORROGA });
    expect(resultado).toBe('VIGENCIA_VENCIDA');
  });
});
