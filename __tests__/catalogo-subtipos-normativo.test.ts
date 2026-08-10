import { describe, expect, it } from 'vitest';
import {
  CATALOGO_FIGURAS_NORMATIVAS,
  MODALIDADES_CONSTRUCCION,
  EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS,
} from '@/lib/motor-expedientes/catalogo-subtipos-normativo';
import { resolverEquivalencia, validarTablaEquivalencias } from '@/lib/motor-expedientes/equivalencia-migracion';

/* DF-4 (ADR-0029) — catálogo normativo de figuras + semilla de equivalencias. */

describe('CATALOGO_FIGURAS_NORMATIVAS', () => {
  it('tiene exactamente las 9 figuras esperadas (5 licencias + reconocimiento + PH, sin duplicar el eje de modalidades)', () => {
    const codigos = CATALOGO_FIGURAS_NORMATIVAS.map((f) => f.codigo).sort();
    expect(codigos).toEqual([
      'APROBACION_PH', 'CONSTRUCCION', 'ESPACIO_PUBLICO', 'PARCELACION',
      'RECONOCIMIENTO', 'RELOTEO', 'SUBDIVISION_RURAL', 'SUBDIVISION_URBANA', 'URBANIZACION',
    ].sort());
  });

  it('cada figura tiene fundamento no vacío', () => {
    for (const figura of CATALOGO_FIGURAS_NORMATIVAS) {
      expect(figura.fundamento.length, `figura ${figura.codigo} sin fundamento`).toBeGreaterThan(0);
    }
  });

  it('RECONOCIMIENTO es ACTO_RECONOCIMIENTO, no LICENCIA (Ley 1848/2017 — no es licencia)', () => {
    const reconocimiento = CATALOGO_FIGURAS_NORMATIVAS.find((f) => f.codigo === 'RECONOCIMIENTO')!;
    expect(reconocimiento.tipoFigura).toBe('ACTO_RECONOCIMIENTO');
  });

  it('APROBACION_PH es OTRA_ACTUACION, no LICENCIA', () => {
    const ph = CATALOGO_FIGURAS_NORMATIVAS.find((f) => f.codigo === 'APROBACION_PH')!;
    expect(ph.tipoFigura).toBe('OTRA_ACTUACION');
  });

  it('las 3 modalidades de subdivisión comparten claseDe="SUBDIVISION"', () => {
    const subdivisiones = CATALOGO_FIGURAS_NORMATIVAS.filter((f) => f.claseDe === 'SUBDIVISION');
    expect(subdivisiones.map((f) => f.codigo).sort()).toEqual(['RELOTEO', 'SUBDIVISION_RURAL', 'SUBDIVISION_URBANA'].sort());
  });

  it('códigos son únicos (sin duplicados)', () => {
    const codigos = CATALOGO_FIGURAS_NORMATIVAS.map((f) => f.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});

describe('MODALIDADES_CONSTRUCCION', () => {
  it('son exactamente 9, numeradas 1-9 sin huecos', () => {
    expect(MODALIDADES_CONSTRUCCION).toHaveLength(9);
    expect(MODALIDADES_CONSTRUCCION.map((m) => m.numeral).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('la modalidad en la posición numeral=7 es demolición (único dato verificado por número en el anexo)', () => {
    const demolicion = MODALIDADES_CONSTRUCCION.find((m) => m.numeral === 7)!;
    expect(demolicion.codigo).toBe('demolicion');
  });

  it('es un eje SEPARADO del catálogo de figuras: ningún código de modalidad aparece en CATALOGO_FIGURAS_NORMATIVAS', () => {
    const codigosFiguras = new Set(CATALOGO_FIGURAS_NORMATIVAS.map((f) => f.codigo));
    for (const modalidad of MODALIDADES_CONSTRUCCION) {
      expect(codigosFiguras.has(modalidad.codigo)).toBe(false);
    }
  });
});

describe('EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS — validez estructural', () => {
  it('la tabla completa es válida (sin TEXTO_HISTORICO_DUPLICADO, CUARENTENA_CON_CODIGOS, etc.)', () => {
    const resultado = validarTablaEquivalencias([...EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS]);
    expect(resultado.errores).toEqual([]);
    expect(resultado.valida).toBe(true);
  });
});

describe('EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS — simples MAPEADAS', () => {
  const tabla = [...EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS];

  it.each([
    ['LC', ['CONSTRUCCION']],
    ['LSR', ['SUBDIVISION_RURAL']],
    ['LSU', ['SUBDIVISION_URBANA']],
    ['LU', ['URBANIZACION']],
    ['LR', ['RECONOCIMIENTO']],
    ['PH', ['APROBACION_PH']],
  ])('%s → %j', (texto, esperado) => {
    expect(resolverEquivalencia(texto, tabla)).toEqual(esperado);
  });

  it('resuelve con casing/espacios distintos (normalización)', () => {
    expect(resolverEquivalencia('  lc  ', tabla)).toEqual(['CONSTRUCCION']);
  });
});

describe('EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS — combinados evidentes (H8)', () => {
  const tabla = [...EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS];

  it('"LC, A" → [CONSTRUCCION] ("A" es modalidad, no otra figura)', () => {
    expect(resolverEquivalencia('LC, A', tabla)).toEqual(['CONSTRUCCION']);
  });
  it('"LC y PH" → [CONSTRUCCION, APROBACION_PH]', () => {
    expect(resolverEquivalencia('LC y PH', tabla)).toEqual(['CONSTRUCCION', 'APROBACION_PH']);
  });
  it('"LC, PH y LSU" → [CONSTRUCCION, APROBACION_PH, SUBDIVISION_URBANA]', () => {
    expect(resolverEquivalencia('LC, PH y LSU', tabla)).toEqual(['CONSTRUCCION', 'APROBACION_PH', 'SUBDIVISION_URBANA']);
  });
  it('"LR, PH" → [RECONOCIMIENTO, APROBACION_PH]', () => {
    expect(resolverEquivalencia('LR, PH', tabla)).toEqual(['RECONOCIMIENTO', 'APROBACION_PH']);
  });
  it('"LR y LC,A" → [RECONOCIMIENTO, CONSTRUCCION]', () => {
    expect(resolverEquivalencia('LR y LC,A', tabla)).toEqual(['RECONOCIMIENTO', 'CONSTRUCCION']);
  });
});

describe('EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS — CUARENTENA, JAMÁS se mapean', () => {
  const tabla = [...EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS];

  it.each(['LCR VISR', 'LRC'])('%s → null (CUARENTENA, no se adivina)', (texto) => {
    expect(resolverEquivalencia(texto, tabla)).toBeNull();
  });

  it('las filas de cuarentena SÍ están en la tabla (constancia de que se vieron) pero con codigos:[] y nota', () => {
    const fila = tabla.find((f) => f.textoHistorico === 'LCR VISR')!;
    expect(fila.estado).toBe('CUARENTENA');
    expect(fila.codigos).toEqual([]);
    expect(fila.nota).toBeTruthy();
  });

  // P1′ parcial (10-ago-2026): "LA = Licencia de Ampliación" (respuesta del
  // ingeniero relatada por el propietario) — LA y su combinado salen de
  // cuarentena hacia construcción (modalidad ampliación).
  it('"LA" → [CONSTRUCCION] (modalidad ampliación, respuesta del ingeniero 10-ago-2026)', () => {
    expect(resolverEquivalencia('LA', tabla)).toEqual(['CONSTRUCCION']);
    const fila = tabla.find((f) => f.textoHistorico === 'LA')!;
    expect(fila.fundamento).toMatch(/ingeniero/);
  });

  it('"LA, PH" → [CONSTRUCCION, APROBACION_PH] (combinado desbloqueado por la misma respuesta)', () => {
    expect(resolverEquivalencia('LA, PH', tabla)).toEqual(['CONSTRUCCION', 'APROBACION_PH']);
  });

  it('texto totalmente ausente de la tabla (no LA/LCR VISR/LRC ni nada sembrado) → también null', () => {
    expect(resolverEquivalencia('XYZ-INEXISTENTE', tabla)).toBeNull();
  });
});
