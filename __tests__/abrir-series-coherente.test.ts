import { describe, it, expect } from 'vitest';
import { decidirApertura } from '@/lib/server/apertura-series';
// El script es .mjs; se importa a propósito para enfrentarlo a la
// implementación de referencia en TypeScript.
import { decidir, MOTIVO_DEL_SALTO as MOTIVO_MJS } from '@/scripts/operacion/abrir-series.mjs';
import { MOTIVO_DEL_SALTO } from '@/lib/server/apertura-series';

/**
 * El script de apertura es un `.mjs` y no puede importar TypeScript, así que
 * lleva REPLICADA la lógica de decisión. Esta prueba impide que esa copia
 * derive: enfrenta ambas implementaciones a una matriz de casos y falla si
 * divergen en uno solo.
 *
 * Es la misma disciplina que la siembra de stage: una copia sin guarda es una
 * copia que se desvía, y aquí lo que estaría en juego es la numeración legal.
 */
const CASOS: Array<[number, unknown]> = [
  [27, { desde: 1600, autorizadoPor: 'P' }],        // apertura normal
  [1599, { desde: 1600, autorizadoPor: 'P' }],      // quedaría igual: no avanza
  [1700, { desde: 1600, autorizadoPor: 'P' }],      // ya está por encima
  [0, { desde: 1, autorizadoPor: 'P' }],            // borde inferior
  [27, undefined],                                   // sin configurar
  [27, { desde: 0, autorizadoPor: 'P' }],           // punto inválido
  [27, { desde: -5, autorizadoPor: 'P' }],
  [27, { desde: 1.5, autorizadoPor: 'P' }],
  [27, { desde: 1600, autorizadoPor: '   ' }],      // sin dueño
  [-1, { desde: 1600, autorizadoPor: 'P' }],        // contador corrupto
  [3.7, { desde: 1600, autorizadoPor: 'P' }],
];

describe('el script de apertura no se desvía de la lógica de referencia', () => {
  it.each(['radicados', 'salidas', 'planillas', 'expedientes'] as const)(
    'coincide en los %s casos de la serie %s', (serie) => {
      for (const [ultimo, cfg] of CASOS) {
        const ref = decidirApertura(serie, ultimo, cfg as never);
        const scr = decidir(serie, ultimo, cfg);
        expect(scr.accion, `serie=${serie} ultimo=${ultimo} cfg=${JSON.stringify(cfg)}`).toBe(ref.accion);
        if (ref.accion === 'ABRIR') {
          expect(scr.nuevoUltimo).toBe(ref.nuevoUltimo);
          expect(scr.veniaDe).toBe(ref.veniaDe);
        }
      }
    });

  it('el motivo del salto es LITERALMENTE el mismo texto en los dos sitios', () => {
    // Se escribe en el contador de producción: si divergen, dos contadores
    // abiertos con versiones distintas explicarían el salto de forma distinta.
    expect(MOTIVO_MJS).toBe(MOTIVO_DEL_SALTO);
  });
});
