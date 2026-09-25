import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calcularCompletitudExpediente } from '@/lib/server/completitud-expediente';

/**
 * El sembrador de stage es un `.mjs` y no puede importar la definición del
 * trámite, así que lleva copiados los ids de los requisitos obligatorios. Esta
 * prueba existe para que esa copia NO se quede a la buena fe: si la definición
 * cambia y el sembrador no, falla aquí y no en stage tres semanas después.
 *
 * El principio de fondo es el del ADR-0033 §4.6: un stage que produce estados
 * que producción ya no puede producir es un stage que miente, y una copia sin
 * guarda es una copia que se desvía.
 */
const fuente = readFileSync('scripts/laboratorio/sembrar-licencias-stage.mjs', 'utf8');

describe('la siembra de stage es coherente con la máquina de estados', () => {
  it('sus requisitos obligatorios coinciden con los de la definición vigente', () => {
    const enSembrador = JSON.parse(
      (fuente.match(/const REQUISITOS_OBLIGATORIOS = (\[[^\]]+\])/)?.[1] ?? '[]').replace(/'/g, '"'),
    ) as string[];
    const enDefinicion = calcularCompletitudExpediente([], {}, new Date())
      .faltantes.map((f) => f.requisitoId);
    expect([...enSembrador].sort()).toEqual([...enDefinicion].sort());
  });

  it('siembra un caso en PRESENTADA — o el estado nuevo nunca se ejercita en la interfaz', () => {
    expect(fuente).toMatch(/estadoJuridico: 'PRESENTADA'/);
  });

  it('el caso PRESENTADA no lleva fecha de alerta: no hay término que proyectar', () => {
    const caso = fuente.slice(fuente.indexOf("estadoJuridico: 'PRESENTADA'"));
    expect(caso.slice(0, 400)).toMatch(/fechaAlertaConservadora: null/);
  });

  it('la actuación de radicación está condicionada — no se escribe en PRESENTADA', () => {
    // Si se escribiera, arrancaría el término: exactamente lo que el estado
    // previo existe para impedir.
    expect(fuente).toMatch(/if \(c\.estadoJuridico !== 'PRESENTADA'\)[\s\S]{0,80}actuaciones/);
  });
});
