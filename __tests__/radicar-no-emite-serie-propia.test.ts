import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * EL ACTO DE RADICAR NO EMITE: RECIBE.
 *
 * Hasta el 26-ago-2026 esta ruta emitía un consecutivo de la serie
 * `expedientes` y el candado R10 la custodiaba. Por decisión del propietario, el
 * número oficial es el del LIBRO DE VENTANILLA, transcrito por el operario: en
 * la Administración Municipal todo entra por ventanilla, y ese número es el
 * único que vale.
 *
 * Al quitar la emisión, el candado R10 dejó de aplicar a esta ruta — y quitar
 * una comprobación sin dejar nada en su lugar es exactamente cómo se pierden.
 * Esta prueba es lo que queda en su lugar: asevera, sobre el código real, que
 * la ruta NO PUEDE alcanzar la serie de expedientes ni su contador.
 *
 * El candado sigue vigente donde importa: `expedientes-licencias-rutas-ejecucion`
 * lo asevera sobre la ruta de creación, que sí podría emitir.
 */
const RUTA = 'app/api/licencias/expedientes/[id]/radicar/route.ts';
const TEXTO = readFileSync(RUTA, 'utf8');

/**
 * SOLO EL CÓDIGO, SIN LOS COMENTARIOS.
 *
 * La cabecera de la ruta EXPLICA que ya no toca `counters/expedientes-*` ni
 * `unicidad_expedientes` — nombrarlos es parte de la explicación. Una prueba
 * que grepea el archivo entero confunde la prosa con el código y prohíbe
 * documentar el defecto que vino a impedir. Es el mismo error que se corrigió
 * en `apertura-forma-unica.test.ts`, y aquí volvió a aparecer.
 */
const FUENTE = TEXTO
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('la ruta del acto no puede consumir la serie de expedientes', () => {
  it.each([
    ['el emisor de números de expediente', 'emitirNumeroExpedienteReal'],
    ['el helper de consecutivos legales', 'leerConsecutivosLegales'],
    ['la confirmación de consecutivos', 'confirmarConsecutivosLegales'],
  ])('no importa ni invoca %s', (_que, simbolo) => {
    expect(FUENTE).not.toContain(simbolo);
  });

  it('no nombra el contador de expedientes ni su colección de unicidad', () => {
    expect(FUENTE).not.toMatch(/counters\/expedientes/);
    expect(FUENTE).not.toMatch(/unicidad_expedientes/);
  });

  it('sí reserva el número en la serie de VENTANILLA, que es de donde sale', () => {
    expect(FUENTE).toMatch(/unicidad_radicados\/\$\{numero\.canonico\}/);
  });

  it('valida el número antes de abrir la transacción', () => {
    const iValidacion = FUENTE.indexOf('validarNumeroRadicadoManual');
    const iTransaccion = FUENTE.indexOf('runTransaction');
    expect(iValidacion).toBeGreaterThan(-1);
    expect(iValidacion, 'la validación debe ir ANTES de abrir la transacción').toBeLessThan(iTransaccion);
  });

  /* Que el número no se pueda inventar en el servidor es la mitad del asunto;
     la otra mitad es que no se pueda inventar una FECHA. */
  it('no acepta ningún campo de fecha libre en el cuerpo', () => {
    expect(FUENTE).not.toMatch(/fechaRadicacion\?*:\s*string/);
    expect(FUENTE).toMatch(/anclaEsperada/);
  });
});
