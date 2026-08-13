import { describe, expect, it } from 'vitest';
import { barrerContraste, canalesDeColor, razonDeContraste } from './utiles/contraste-accesibilidad';
import { CORREOS } from './utiles/correos-fixtures';
describe('la fórmula y el método del barrido', () => {
  it('reproduce contrastes conocidos', () => {
    expect(razonDeContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(razonDeContraste('rgb(255, 255, 255)', '#D4A017')).toBeCloseTo(2.38, 1);
  });

  it('acepta el formato rgb() que produce jsdom (un filtro solo-hex no mediría nada)', () => {
    expect(canalesDeColor('rgb(212, 160, 23)')).toEqual([212, 160, 23]);
    expect(canalesDeColor('#D4A017')).toEqual([212, 160, 23]);
  });
});

describe('barrido de contraste sobre TODAS las plantillas de correo', () => {
  it.each(CORREOS)('$nombre — ningún texto por debajo del umbral WCAG AA', ({ html }) => {
    const { ilegibles, inspeccionados } = barrerContraste(html());
    // Guardia anti-falso-verde: un correo sin textos medidos significa que
    // el analizador dejó de reconocer algo, no que el correo esté bien.
    expect(inspeccionados).toBeGreaterThan(5);
    expect(ilegibles).toEqual([]);
  });
});
