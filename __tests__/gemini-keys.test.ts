import { afterEach, describe, expect, it, vi } from 'vitest';
import { obtenerClavesGemini, esErrorDeCuota } from '@/lib/ai/gemini-keys';

/* ══════════════════════════════════════════════════════════════
   Rotación de claves de Gemini.
══════════════════════════════════════════════════════════════ */

afterEach(() => { vi.unstubAllEnvs(); });

describe('obtenerClavesGemini', () => {
  /* 1 · principal + respaldo, en orden */
  it('lee GEMINI_API_KEY y GEMINI_API_KEY_2 en orden', () => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-A');
    vi.stubEnv('GEMINI_API_KEY_2', 'clave-B');
    expect(obtenerClavesGemini()).toEqual(['clave-A', 'clave-B']);
  });

  /* 2 · solo la principal si no hay respaldo */
  it('funciona con una sola clave', () => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-A');
    vi.stubEnv('GEMINI_API_KEY_2', '');
    expect(obtenerClavesGemini()).toEqual(['clave-A']);
  });

  /* 3 · la lista CSV agrega más claves */
  it('agrega claves desde GEMINI_API_KEYS (CSV)', () => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-A');
    vi.stubEnv('GEMINI_API_KEYS', 'clave-C, clave-D');
    expect(obtenerClavesGemini()).toEqual(['clave-A', 'clave-C', 'clave-D']);
  });

  /* 4 · duplicados y vacíos se descartan */
  it('deduplica y descarta vacíos', () => {
    vi.stubEnv('GEMINI_API_KEY', 'clave-A');
    vi.stubEnv('GEMINI_API_KEY_2', 'clave-A');       // repetida
    vi.stubEnv('GEMINI_API_KEYS', ' , clave-B ,');    // vacíos + una válida
    expect(obtenerClavesGemini()).toEqual(['clave-A', 'clave-B']);
  });

  /* 5 · sin ninguna configurada, lista vacía */
  it('sin claves devuelve arreglo vacío', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY_2', '');
    vi.stubEnv('GEMINI_API_KEYS', '');
    expect(obtenerClavesGemini()).toEqual([]);
  });
});

describe('esErrorDeCuota', () => {
  /* 6 · reconoce el 429 real de Gemini */
  it('detecta cuota agotada en varias formas', () => {
    expect(esErrorDeCuota('GEMINI_ERROR: Gemini HTTP 429: exceeded your current quota')).toBe(true);
    expect(esErrorDeCuota('RESOURCE_EXHAUSTED')).toBe(true);
    expect(esErrorDeCuota('You exceeded your current quota')).toBe(true);
  });

  /* 7 · no confunde otros errores (esos no se arreglan cambiando de clave) */
  it('no marca errores de red o de contenido como cuota', () => {
    expect(esErrorDeCuota('GEMINI_ERROR: Gemini HTTP 500: internal error')).toBe(false);
    expect(esErrorDeCuota('La IA no devolvió JSON válido.')).toBe(false);
    expect(esErrorDeCuota('fetch failed')).toBe(false);
  });
});
