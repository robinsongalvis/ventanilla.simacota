/**
 * PASO 3 (Fase 2 arranque) — `codigosNumeroExpediente` (fail-closed) y los
 * campos aditivos `codigoDane`/`codigoCuraduria` de `TenantConfig`.
 */
import { describe, it, expect } from 'vitest';
import { codigosNumeroExpediente, DIRECTORIO_TENANTS } from '@/src/types/reglas-negocio';

describe('codigosNumeroExpediente', () => {
  it('SEC_PLANEACION tiene codigoDane=68745 y codigoCuraduria=0 poblados', () => {
    expect(codigosNumeroExpediente('SEC_PLANEACION')).toEqual({
      codigoDane: '68745',
      codigoCuraduria: '0',
    });
  });

  it('un tenant SIN codigoDane/codigoCuraduria configurados lanza con mensaje descriptivo (fail-closed)', () => {
    // VENTANILLA_UNICA existe en el directorio pero no tiene estos códigos.
    expect(() => codigosNumeroExpediente('VENTANILLA_UNICA')).toThrow(/código DANE.*curaduría|codigoDane|codigoCuraduria/i);
  });

  it('nunca aplica un default silencioso: el error nombra la dependencia', () => {
    try {
      codigosNumeroExpediente('DESPACHO_ALCALDE');
      expect.unreachable('debía lanzar');
    } catch (err) {
      expect(String(err)).toContain('Despacho del Alcalde');
    }
  });
});

describe('DIRECTORIO_TENANTS — codigoDane/codigoCuraduria son strings (ceros a la izquierda no se pierden)', () => {
  it('SEC_PLANEACION.codigoCuraduria es el string "0", no el número 0', () => {
    expect(typeof DIRECTORIO_TENANTS.SEC_PLANEACION.codigoCuraduria).toBe('string');
    expect(DIRECTORIO_TENANTS.SEC_PLANEACION.codigoCuraduria).toBe('0');
  });
});
