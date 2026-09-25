import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * NINGÚN TRABAJO PROGRAMADO PUEDE TERMINAR EN SILENCIO.
 *
 * El 27-ago-2026 se agendó el quinto cron, corrió dos veces en producción con
 * 200, y no hubo forma de saber qué hizo: los logs de Vercel guardan el estado
 * y la duración, no el cuerpo de la respuesta. Averiguarlo exigía el secreto de
 * producción.
 *
 * Al mirarlo se vio que era general: de los cinco crons, solo `auditoria-
 * consecutivos` dejaba rastro estructurado. Los otros cuatro terminaban mudos,
 * y su silencio era indistinguible de «no hizo nada» — que es exactamente lo
 * que un vigía no puede permitirse.
 *
 * Esta prueba recorre el árbol de `app/api/cron` y exige el rastro a TODOS.
 * Un cron nuevo lo hereda sin que nadie tenga que acordarse: el inventario se
 * DERIVA del sistema de archivos, como el de `vercel.json` y el del verificador
 * de restauración con `firestore.rules`.
 */
function listarCrons(raiz: string, prefijo = 'app/api/cron'): string[] {
  const rutas: string[] = [];
  for (const e of readdirSync(raiz, { withFileTypes: true })) {
    if (e.isDirectory()) rutas.push(...listarCrons(join(raiz, e.name), `${prefijo}/${e.name}`));
    else if (e.name === 'route.ts') rutas.push(`${prefijo}/route.ts`);
  }
  return rutas;
}

const CRONS = listarCrons('app/api/cron');

describe('todos los trabajos programados dejan rastro de lo que hicieron', () => {
  it('hay crons que revisar (la prueba no pasa por vacía)', () => {
    expect(CRONS.length).toBeGreaterThanOrEqual(5);
  });

  it.each(CRONS)('%s registra un evento de negocio', (ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    expect(
      fuente,
      `${ruta} termina sin registrar nada: su silencio sería indistinguible de «no hizo nada».`,
    ).toMatch(/registrarEventoNegocio\(/);
  });

  /* Que registre no basta: tiene que registrar CUÁNTO miró. Un evento que solo
     dice «corrió» repite lo que los logs de Vercel ya decían. */
  it.each(CRONS)('%s dice cuántos documentos revisó', (ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    expect(
      fuente,
      `${ruta} registra que corrió pero no cuánto miró, que es la pregunta que importa.`,
    ).toMatch(/docsLeidos:/);
  });

  it.each(CRONS)('%s usa el rol CRON, no un actor humano inventado', (ruta) => {
    const fuente = readFileSync(ruta, 'utf8');
    if (!/registrarEventoNegocio\(/.test(fuente)) return;
    expect(fuente).toMatch(/actorRol:\s*'CRON'/);
  });
});
