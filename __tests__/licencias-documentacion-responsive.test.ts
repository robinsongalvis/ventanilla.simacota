/**
 * Regresión responsive de la documentación de Licencias.
 *
 * jsdom no resuelve el algoritmo de grid/flex ni expone un scrollWidth útil;
 * por eso se custodian los contratos de las clases que impiden el overflow.
 * La inspección visual por viewport se completa cuando hay una sesión de
 * Licencias disponible en el entorno local o de stage.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const requisitoItem = readFileSync(join(raiz, 'app/interno/licencias/components/RequisitoItem.tsx'), 'utf8');
const checklist = readFileSync(join(raiz, 'app/interno/licencias/components/ChecklistRequisitos.tsx'), 'utf8');
const otrosDocumentos = readFileSync(join(raiz, 'app/interno/licencias/components/OtrosDocumentos.tsx'), 'utf8');
const resumenDocumentos = readFileSync(join(raiz, 'app/interno/licencias/components/ResumenDocumentos.tsx'), 'utf8');
const layout = readFileSync(join(raiz, 'app/interno/licencias/layout.tsx'), 'utf8');

describe('Documentación de Licencias — contratos contra overflow horizontal móvil', () => {
  it('apila cada requisito en una sola columna en móvil y reserva la grilla de columnas para md+', () => {
    expect(requisitoItem).toContain('[grid-template-columns:minmax(0,1fr)]');
    expect(requisitoItem).toContain('md:[grid-template-columns:26px_1.6fr_1.9fr_136px_1.5fr_150px]');
    expect(checklist).toContain('hidden md:grid');
  });

  it('permite que los hijos flex/grid se contraigan hasta el ancho disponible', () => {
    expect(requisitoItem).toContain('className="min-w-0 px-3 py-2.5 md:px-4"');
    expect(requisitoItem).toContain('grid min-w-0 items-center');
    expect(checklist).toContain('flex w-full min-w-0 flex-col gap-4');
    expect(checklist).toContain('flex w-full min-w-0 flex-col gap-3');
    expect(otrosDocumentos).toContain('w-full min-w-0 rounded-xl');
    expect(resumenDocumentos).toContain('w-full min-w-0 rounded-xl');
    expect(layout).toContain('flex-1 flex flex-col min-w-0 min-h-0');
  });

  it('permite partir nombres largos de archivo en vez de truncarlos o ensanchar la fila', () => {
    for (const fuente of [requisitoItem, otrosDocumentos, resumenDocumentos]) {
      expect(fuente).toContain("overflowWrap: 'anywhere'");
      expect(fuente).toContain('break-words');
      expect(fuente).not.toContain('truncate');
    }
  });

  it('reubica el contador de la sección bajo el título en móvil y conserva acciones ajustables', () => {
    expect(checklist).toContain('order-4 ml-auto flex basis-full justify-end md:order-none md:ml-0 md:basis-auto');
    expect(checklist).toContain('flex w-full min-w-0 flex-wrap items-center');
    expect(requisitoItem).toContain('flex flex-wrap items-center gap-1 justify-start md:flex-nowrap md:justify-end');
    expect(requisitoItem).toContain('absolute left-0 z-30');
    expect(requisitoItem).toContain('md:left-auto md:right-0');
  });

  it('no introduce 100vw en la cadena de contenedores de esta vista', () => {
    for (const fuente of [requisitoItem, checklist, otrosDocumentos, resumenDocumentos, layout]) {
      expect(fuente).not.toContain('100vw');
      expect(fuente).not.toContain('w-screen');
    }
  });
});
