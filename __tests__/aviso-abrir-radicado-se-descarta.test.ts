/**
 * El aviso de «no fue posible abrir el radicado» no puede quedarse pegado.
 *
 * VISTO EN PRODUCCIÓN el 29-sep-2026: la funcionaria intentó abrir un radicado
 * fuera de su alcance, y el aviso rojo la siguió de «Salidas» a «Ventanilla»,
 * tapando la cabecera de una pantalla con la que no tenía relación. El estado
 * SÍ se limpiaba —pero solo cuando una apertura POSTERIOR salía bien, es decir
 * casi nunca.
 *
 * Es un banner `fixed` que oculta contenido mientras siga en pantalla, así que
 * su permanencia no es un detalle estético: deja a la funcionaria leyendo un
 * error que ya no corresponde a lo que está viendo.
 *
 * Se custodian las TRES salidas, porque cada una cubre un caso distinto:
 * cambiar de vista, esperar, o cerrarlo a mano.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLERO = readFileSync(join(process.cwd(), 'app/interno/dashboard/page.tsx'), 'utf8');

describe('el aviso de apertura fallida se descarta solo', () => {
  it('se limpia al cambiar de vista — el error era de la pantalla anterior', () => {
    expect(TABLERO).toMatch(
      /useEffect\(\(\) => \{\s*setErrorAbrirRadicado\(null\);\s*\}, \[vistaActual\]\)/,
    );
  });

  it('se descarta solo pasado un tiempo — el banner tapa contenido', () => {
    expect(TABLERO).toMatch(/setTimeout\(\(\) => setErrorAbrirRadicado\(null\)/);
    // Con limpieza del temporizador: sin ella, cada aviso nuevo dejaría uno
    // colgando que podría borrar un mensaje posterior antes de tiempo.
    expect(TABLERO).toMatch(/clearTimeout\(temporizador\)/);
  });

  it('se puede cerrar a mano', () => {
    expect(TABLERO).toMatch(/aria-label="Cerrar aviso"/);
    expect(TABLERO).toMatch(/onClick=\{\(\) => setErrorAbrirRadicado\(null\)\}/);
  });

  it('sigue anunciándose como alerta accesible', () => {
    // El arreglo no puede costar la accesibilidad: quien usa lector de
    // pantalla tiene que seguir enterándose de que la apertura falló.
    expect(TABLERO).toMatch(/role="alert"/);
  });
});
