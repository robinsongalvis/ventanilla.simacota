import { describe, expect, it } from 'vitest';
import {
  MEDIOS_ANEXOS,
  componerDescripcionAnexos,
  toggleMedio,
} from '@/lib/recepcion/medios-anexos';

/* ══════════════════════════════════════════════════════════════
   Sprint Recepción fluida — medios físicos entregados (chips).
══════════════════════════════════════════════════════════════ */

describe('Recepción — medios de anexos', () => {
  /* 1 · el catálogo es el acordado */
  it('ofrece CD, USB, Sobre sellado y Otro', () => {
    expect([...MEDIOS_ANEXOS]).toEqual(['CD', 'USB', 'Sobre sellado', 'Otro']);
  });

  /* 2 · toggle agrega y quita */
  it('toggleMedio agrega un medio ausente y quita uno presente', () => {
    const conCd = toggleMedio([], 'CD');
    expect(conCd).toEqual(['CD']);
    expect(toggleMedio(conCd, 'CD')).toEqual([]);
  });

  /* 3 · el orden sigue el catálogo sin importar el orden de clics */
  it('mantiene el orden del catálogo aunque se marque en desorden', () => {
    let medios: string[] = [];
    medios = toggleMedio(medios, 'Otro');
    medios = toggleMedio(medios, 'CD');
    medios = toggleMedio(medios, 'USB');
    expect(medios).toEqual(['CD', 'USB', 'Otro']);
  });

  /* 4 · la descripción compuesta es el texto corto del sello */
  it('componerDescripcionAnexos une con coma', () => {
    expect(componerDescripcionAnexos(['CD', 'USB'])).toBe('CD, USB');
    expect(componerDescripcionAnexos([])).toBe('');
  });
});
