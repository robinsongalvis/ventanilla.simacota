import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * EL ACTO DE RADICAR EMITE OTRA VEZ — Y BAJO CANDADO.
 *
 * REESCRITA el 2-sep-2026 por el ADR-0041 (conforme al ADR-0039 §3).
 *
 * QUÉ SE RETIRA: la prohibición de emitir. Esta prueba nació el 26-ago, cuando
 * el propietario decidió que el número oficial fuera el del libro de ventanilla
 * transcrito; al quitarse la emisión, el candado R10 dejó de aplicar a esta
 * ruta, y la prueba se puso en su lugar para que la ausencia no se perdiera.
 *
 * CON QUÉ FUNDAMENTO SE RETIRA: el ADR-0041, aprobado por el propietario el
 * 1-sep, devuelve a las licencias su número propio de la serie `expedientes`
 * —el `68745-…` que continúa el libro del ingeniero de Planeación— emitido en
 * este mismo acto. La premisa de la prueba («la ruta NO PUEDE alcanzar la
 * serie») es exactamente lo que la decisión revierte.
 *
 * QUÉ SOBREVIVE, Y ES LA MITAD QUE IMPORTA: que la emisión no pueda ocurrir
 * sin candado, que el número no se pueda inventar en el servidor y que la
 * fecha no se pueda inventar en el cuerpo. Nada de eso lo tocó el ADR.
 *
 * QUÉ VIGILA AHORA, ADEMÁS: que la emisión esté DENTRO de la transacción y
 * ANTES de la primera escritura. Fuera de ella, un fallo posterior dejaría un
 * número consumido para siempre por un acto que no ocurrió — y en una serie
 * legal eso no se arregla, se anula con acta.
 *
 * LÍMITE DECLARADO (la lección del barrido del 30-ago): las aserciones de
 * ORDEN se hacen sobre el texto del fuente, y el texto no es el mecanismo. Lo
 * que SÍ se ejecuta —que con candado cerrado no se escribe un número de la
 * serie `expedientes`— vive en `emision-bajo-candado.test.ts`, sobre las
 * funciones puras.
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

describe('la ruta del acto emite bajo candado, y dentro de la transacción', () => {
  it('la emisión pasa por el candado R10 — no hay camino que lo esquive', () => {
    /* El invariante que sobrevive a la reescritura: emitir sin preguntar al
       candado es lo que R10 existe para impedir. */
    expect(FUENTE).toContain('evaluarCandadoEmisionReal');
    const iCandado = FUENTE.indexOf('evaluarCandadoEmisionReal');
    const iEmision = FUENTE.indexOf('emitirNumeroExpedienteReal(');
    expect(iEmision, 'la ruta dejó de emitir — si fue a propósito, esta prueba se reescribe con su fundamento').toBeGreaterThan(-1);
    expect(iCandado, 'el candado debe consultarse ANTES de emitir').toBeLessThan(iEmision);
  });

  it('emite DENTRO de la transacción y ANTES de la primera escritura', () => {
    /* Fuera de la transacción, un fallo posterior dejaría el número consumido
       por un acto que no ocurrió. En una serie legal eso no se corrige: se
       anula con acta. */
    const iTx = FUENTE.indexOf('runTransaction');
    const iEmision = FUENTE.indexOf('emitirNumeroExpedienteReal(');
    const iPrimeraEscritura = FUENTE.indexOf('tx.create(');
    expect(iEmision, 'la emisión quedó FUERA de la transacción').toBeGreaterThan(iTx);
    expect(iEmision, 'la emisión quedó DESPUÉS de la primera escritura').toBeLessThan(iPrimeraEscritura);
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
