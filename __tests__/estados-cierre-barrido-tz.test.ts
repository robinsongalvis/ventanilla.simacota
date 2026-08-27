import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESTADOS_CERRADOS } from '@/lib/radicado-estados';

/**
 * `scripts/laboratorio/barrido-vencimientos-tz.mjs` ESCRIBE sobre radicados
 * reales: corrige fechas de vencimiento afectadas por el sesgo de zona horaria.
 * Lo único que impide que toque un expediente ya cerrado es su lista local de
 * estados de cierre — y esa lista estuvo mal desde que se escribió.
 *
 * Traía `ARCHIVADO` y `CERRADO`, que no existen en `EstadoRadicado`, y le
 * faltaba `RECHAZADO`, que sí es cierre. Dos guardas inertes y un cierre
 * desprotegido, en un guion que invoca el art. 19 de la Ley 594/2000 para
 * justificar por qué no debe tocar lo cerrado.
 *
 * Es `.mjs`, así que no puede importar el criterio canónico. Esta prueba
 * sustituye a la importación que no se puede hacer.
 */
const FUENTE = readFileSync('scripts/laboratorio/barrido-vencimientos-tz.mjs', 'utf8');

function listaDelGuion(): string[] {
  const m = FUENTE.match(/const ESTADOS_CERRADOS = new Set\(\[([^\]]*)\]\)/);
  if (!m) throw new Error('no se encontró la lista de estados de cierre en el guion');
  return [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]).sort();
}

describe('la lista de cierres del barrido de zona horaria no se desvía de la canónica', () => {
  it('es exactamente la misma que ESTADOS_CERRADOS', () => {
    expect(listaDelGuion()).toEqual([...ESTADOS_CERRADOS].sort());
  });

  it('no declara estados que no existen en el dominio', () => {
    for (const estado of listaDelGuion()) {
      expect(ESTADOS_CERRADOS.has(estado), `'${estado}' no es un estado de cierre real`).toBe(true);
    }
  });

  /* Los dos fantasmas que estuvieron ahí. Que la prueba los nombre deja
     constancia de qué se corrigió, y evita que vuelvan por copia y pega. */
  it.each(['ARCHIVADO', 'CERRADO'])('no vuelve a aparecer el estado inexistente %s', (fantasma) => {
    expect(FUENTE).not.toMatch(new RegExp(`'${fantasma}'`));
  });
});
