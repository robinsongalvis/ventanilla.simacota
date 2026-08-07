/**
 * Fase 2 (arranque, PASO 7) — tabla de equivalencias de migración
 * (PROVISIONAL, sujeta a P1/P2). Solo mecanismo — sin datos reales de
 * Planeación (esos los trae P1, no este módulo).
 */
import { describe, it, expect } from 'vitest';
import {
  normalizarTextoHistorico,
  resolverEquivalencia,
  validarTablaEquivalencias,
  type EquivalenciaMigracion,
} from '@/lib/motor-expedientes/equivalencia-migracion';

describe('normalizarTextoHistorico', () => {
  it('recorta extremos, colapsa espacios internos y pasa a mayúsculas', () => {
    expect(normalizarTextoHistorico('  lc   r visr  ')).toBe('LC R VISR');
  });
  it('ya normalizado se queda igual', () => {
    expect(normalizarTextoHistorico('LC')).toBe('LC');
  });
});

describe('resolverEquivalencia', () => {
  const tabla: EquivalenciaMigracion[] = [
    { textoHistorico: 'LC', codigos: ['licencia-construccion'] },
    { textoHistorico: 'LCR VISR', codigos: ['licencia-construccion', 'visto-bueno-redes'] }, // combinado
  ];

  it('resuelve por coincidencia normalizada (casing/espacios distintos, mismo texto)', () => {
    expect(resolverEquivalencia('  lc  ', tabla)).toEqual(['licencia-construccion']);
    expect(resolverEquivalencia('Lc', tabla)).toEqual(['licencia-construccion']);
  });

  it('resuelve combinados a varios códigos', () => {
    expect(resolverEquivalencia('lcr   visr', tabla)).toEqual(['licencia-construccion', 'visto-bueno-redes']);
  });

  it('texto no mapeable → null (CUARENTENA, nunca se adivina)', () => {
    expect(resolverEquivalencia('ANOMALIA-DESCONOCIDA', tabla)).toBeNull();
  });
});

describe('validarTablaEquivalencias', () => {
  it('tabla vacía → válida', () => {
    expect(validarTablaEquivalencias([]).valida).toBe(true);
  });

  it('tabla bien formada → válida', () => {
    const tabla: EquivalenciaMigracion[] = [
      { textoHistorico: 'LC', codigos: ['licencia-construccion'] },
      { textoHistorico: 'LSR', codigos: ['licencia-subdivision-rural'] },
    ];
    expect(validarTablaEquivalencias(tabla).valida).toBe(true);
  });

  it('textoHistorico vacío → TEXTO_HISTORICO_VACIO', () => {
    const tabla: EquivalenciaMigracion[] = [{ textoHistorico: '', codigos: ['x'] }];
    const resultado = validarTablaEquivalencias(tabla);
    expect(resultado.valida).toBe(false);
    expect(resultado.errores[0]!.codigo).toBe('TEXTO_HISTORICO_VACIO');
  });

  it('codigos vacío → SIN_CODIGOS', () => {
    const tabla: EquivalenciaMigracion[] = [{ textoHistorico: 'LC', codigos: [] }];
    const resultado = validarTablaEquivalencias(tabla);
    expect(resultado.valida).toBe(false);
    expect(resultado.errores[0]!.codigo).toBe('SIN_CODIGOS');
  });

  it('dos filas que normalizan al MISMO texto histórico → TEXTO_HISTORICO_DUPLICADO (fail-closed, ambigüedad rechazada)', () => {
    const tabla: EquivalenciaMigracion[] = [
      { textoHistorico: 'LC', codigos: ['licencia-construccion'] },
      { textoHistorico: '  lc  ', codigos: ['otro-codigo'] }, // mismo texto normalizado, distinta equivalencia
    ];
    const resultado = validarTablaEquivalencias(tabla);
    expect(resultado.valida).toBe(false);
    expect(resultado.errores.map((e) => e.codigo)).toContain('TEXTO_HISTORICO_DUPLICADO');
  });
});
