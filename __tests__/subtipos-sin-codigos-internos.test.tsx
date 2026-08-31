import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SelectorSubtiposNormativos } from '@/app/interno/licencias/components/SelectorSubtiposNormativos';
import { CATALOGO_FIGURAS_NORMATIVAS } from '@/lib/motor-expedientes/catalogo-subtipos-normativo';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   EL CHECKLIST NO LE ENSEÑA CÓDIGOS INTERNOS A LA FUNCIONARIA.

   Cada opción pintaba su `codigo` entre paréntesis —`(SUBDIVISION_RURAL)`,
   `(CONSTRUCCION)`, `(APROBACION_PH)`— ocupando casi la mitad del renglón en
   una lista de nueve.

   La decisión (propietario, 31-ago-2026) no fue estética: está verificada
   contra la fuente. El ingeniero de Planeación escribe `LSR`, `LSU`, `LC`,
   `LU`, `LR`, `PH` en su planilla, y el catálogo tiene una tabla
   —`EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS`— cuyo único trabajo es
   traducir esa columna a estos códigos. Son dos vocabularios distintos, y ni
   siquiera uno a uno: `LC y PH` se traduce en DOS códigos. Mostrar el
   nuestro no ayuda a casar con el expediente físico — solo estorba.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA lo que se PINTA:
     · que ningún código del catálogo aparezca como texto en pantalla;
     · que el nombre legible de cada figura sí aparezca;
     · que el código siga siendo la identidad que viaja al formulario.
   Esto NO mira: el contenido del catálogo (`catalogo-subtipos-normativo`),
   ni la tabla de equivalencias, ni el selector de modalidades. Y NO vigila
   los códigos del INGENIERO (`LSR`, `LC`…): hoy tampoco se muestran, pero si
   un día se decidiera mostrarlos —son los que sí están en su papel— esta
   prueba debe seguir verde. Lo que se prohíbe es enseñar los NUESTROS.
══════════════════════════════════════════════════════════════ */

/** Todos los códigos internos del catálogo, que son los que no deben verse. */
const CODIGOS_INTERNOS = CATALOGO_FIGURAS_NORMATIVAS.map((f) => f.codigo);

describe('el checklist de subtipos no muestra códigos internos', () => {
  it('ninguno de los códigos del catálogo aparece en pantalla', () => {
    render(<SelectorSubtiposNormativos seleccionados={[]} onAlternar={vi.fn()} />);

    const pintado = document.body.textContent ?? '';
    const filtrados = CODIGOS_INTERNOS.filter((c) => pintado.includes(c));

    expect(
      filtrados,
      `el checklist volvió a enseñar códigos internos: ${filtrados.join(', ')}. `
      + 'No le sirven a quien atiende el mostrador — el ingeniero escribe LSR/LSU/LC, '
      + 'no éstos, y la traducción vive en EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS.',
    ).toEqual([]);
  });

  it('pero sí muestra el nombre legible de cada figura', () => {
    render(<SelectorSubtiposNormativos seleccionados={[]} onAlternar={vi.fn()} />);

    // Si se quitara el nombre además del código, la lista quedaría muda: la
    // prueba de arriba pasaría igual y ésta es la que lo impide.
    for (const figura of CATALOGO_FIGURAS_NORMATIVAS) {
      expect(
        screen.getByText(figura.nombre),
        `la figura «${figura.nombre}» dejó de tener nombre visible`,
      ).toBeTruthy();
    }
  });

  it('y el código sigue siendo la identidad que viaja al formulario', () => {
    const alternar = vi.fn();
    const construccion = CATALOGO_FIGURAS_NORMATIVAS.find((f) => f.codigo === 'CONSTRUCCION');
    render(<SelectorSubtiposNormativos seleccionados={[]} onAlternar={alternar} />);

    // Quitarlo de la VISTA no puede quitarlo del DATO: el formulario, la API y
    // el expediente siguen hablando en códigos.
    fireEvent.click(screen.getByText(construccion!.nombre));

    expect(alternar).toHaveBeenCalledWith('CONSTRUCCION');
  });

  it('y la selección marcada se sigue reflejando por código', () => {
    render(<SelectorSubtiposNormativos seleccionados={['CONSTRUCCION']} onAlternar={vi.fn()} />);

    const construccion = CATALOGO_FIGURAS_NORMATIVAS.find((f) => f.codigo === 'CONSTRUCCION')!;
    const casilla = screen.getByText(construccion.nombre)
      .closest('label')
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

    expect(casilla?.checked, 'la casilla marcada dejó de reflejarse').toBe(true);
  });
});
