import { describe, expect, it } from 'vitest';
import {
  NORMOGRAMA_NUCLEO,
  validarSemilla,
} from '@/lib/simi/normograma-nucleo';

/* ══════════════════════════════════════════════════════════════
   Sprint SIMI Fase 2 — semilla del paquete núcleo del normograma.
══════════════════════════════════════════════════════════════ */

describe('Normograma núcleo — semilla', () => {
  /* 1 · la semilla está bien formada */
  it('no tiene problemas de estructura', () => {
    expect(validarSemilla()).toEqual([]);
  });

  /* 2 · trae el paquete núcleo esperado */
  it('incluye las normas fundamentales de PQRSD', () => {
    const slugs = NORMOGRAMA_NUCLEO.map((n) => n.slug);
    expect(slugs).toContain('ley-1755-2015-derecho-peticion');
    expect(slugs).toContain('ley-1437-2011-cpaca');
    expect(slugs).toContain('ley-1712-2014-transparencia');
    expect(slugs).toContain('ley-1581-2012-datos-personales');
    expect(slugs).toContain('decreto-1499-2017-mipg');
    expect(slugs).toContain('ley-594-2000-archivos');
    expect(NORMOGRAMA_NUCLEO.length).toBeGreaterThanOrEqual(10);
  });

  /* 3 · los slugs son únicos (idempotencia del cargador) */
  it('todos los slugs son únicos', () => {
    const slugs = NORMOGRAMA_NUCLEO.map((n) => n.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /* 4 · todas nacen citables (vigente) para que el RAG las use */
  it('las normas núcleo quedan en estado citable', () => {
    const citables = new Set(['vigente', 'parcialmente_vigente', 'interna_validada']);
    for (const n of NORMOGRAMA_NUCLEO) {
      expect(citables.has(n.estado)).toBe(true);
    }
  });

  /* 5 · cada una lleva la marca de curaduría inicial para ratificación */
  it('todas registran validado_por y fecha de curaduría', () => {
    for (const n of NORMOGRAMA_NUCLEO) {
      expect(n.validado_por).toMatch(/ratificación jurídica/i);
      expect(n.fecha_validacion).toBeTruthy();
    }
  });

  /* 6 · el validador detecta problemas inyectados */
  it('validarSemilla marca slug duplicado y estado inválido', () => {
    const base = NORMOGRAMA_NUCLEO[0];
    const problemas = validarSemilla([
      base,
      { ...base }, // duplicado
      { ...base, slug: 'raro', estado: 'inventado' as never, palabras_clave: [] },
    ]);
    const campos = problemas.map((p) => p.campo);
    expect(campos).toContain('slug');
    expect(campos).toContain('estado');
    expect(campos).toContain('palabras_clave');
  });
});
