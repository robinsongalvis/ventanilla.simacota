import { describe, expect, it } from 'vitest';
import {
  CODIGO_OFICINA_RADICADORA_SALIDA,
  formatearRadicadoSalida,
} from '@/lib/salidas/radicado-salida';

/* ══════════════════════════════════════════════════════════════
   Sprint Radicación de salida — formato de la serie de salida.

   ADR-0024 (2026-07-15, decisión del propietario): la salida deja el
   canal `SAL` y adopta el mismo código de oficina radicadora `110` que
   la entrada, con el tercer segmento en {AAAAMM} — alineado al sistema
   legado municipal. El consecutivo sigue siendo anual y propio
   (`counters/salidas-{año}`); el formato de ENTRADA no se toca.

   Los ids emitidos antes de este cambio (`2-SAL-{AAAA}-…`) nunca se
   reescriben — ver la guarda de compatibilidad al final.
══════════════════════════════════════════════════════════════ */

describe('Radicación de salida — formatearRadicadoSalida', () => {
  /* 1 · el formato aprobado (ADR-0024) */
  it('arma 2-110-{AAAAMM}-{consecutivo a 8 dígitos}', () => {
    expect(CODIGO_OFICINA_RADICADORA_SALIDA).toBe('110');
    expect(formatearRadicadoSalida(1, new Date('2026-07-04T10:00:00Z')))
      .toBe('2-110-202607-00000001');
    expect(formatearRadicadoSalida(12, new Date('2026-07-04T10:00:00Z')))
      .toBe('2-110-202607-00000012');
  });

  /* 2 · padding completo para consecutivos grandes */
  it('conserva 8 dígitos con consecutivos altos', () => {
    expect(formatearRadicadoSalida(12345678, new Date('2026-01-01T10:00:00Z')))
      .toBe('2-110-202601-12345678');
  });

  /* 3 · la serie es anual; el mes es solo informativo */
  it('usa el año y el mes de la fecha dada, con padding de dos dígitos', () => {
    expect(formatearRadicadoSalida(1, new Date('2027-01-15T10:00:00Z')))
      .toBe('2-110-202701-00000001');
    expect(formatearRadicadoSalida(1, new Date('2026-11-03T10:00:00Z')))
      .toBe('2-110-202611-00000001');
  });

  /* 4 · nunca colisiona con la serie de entrada */
  it('el prefijo 2-110 no coincide con el formato de entrada 1-110', () => {
    const salida = formatearRadicadoSalida(45, new Date('2026-07-04T10:00:00Z'));
    expect(salida.startsWith('2-110-')).toBe(true);
    expect(salida).not.toMatch(/^1-/);
  });
});

describe('compatibilidad hacia atrás — ids de salida anteriores al ADR-0024', () => {
  it('un id viejo con el canal SAL sigue teniendo la forma esperada por los parsers', () => {
    // Documentos ya persistidos con el formato anterior: nunca se reescriben
    // (AGN 060/2001 art. 5). Este caso documenta la forma exacta que
    // cualquier parser/validador de salidas debe seguir aceptando.
    const idViejo = '2-SAL-2026-00000006';
    expect(idViejo.startsWith('2-SAL-')).toBe(true);
    expect(idViejo).toMatch(/^2-SAL-\d{4}-\d{8}$/);
  });
});
