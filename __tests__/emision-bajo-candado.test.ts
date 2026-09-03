import { describe, expect, it } from 'vitest';
import {
  EMISION_REAL_EXPEDIENTES_HABILITADA,
  identidadAlNacer,
} from '@/lib/server/expedientes-licencias';
import { numeroDeEntrada } from '@/lib/motor-expedientes/numeros-del-expediente';

/* ══════════════════════════════════════════════════════════════
   LA EMISIÓN, BAJO CANDADO — custodio de los pasos 3 y 4 del ADR-0041
   (2-sep-2026).

   Estos dos pasos preparan el arranque SIN abrirlo: el expediente aprende a
   nacer sin número y el acto de radicar aprende a emitir el `68745-…`, pero
   con el candado R10 cerrado ninguna de las dos ramas se alcanza en
   producción. Por eso se prueban por INYECCIÓN — el mismo patrón que ya usa
   `expedientes-licencias-decisiones` con el candado.

   POR QUÉ ESTE CUSTODIO EJECUTA en vez de leer el fuente: la prueba hermana
   (`radicar-no-emite-serie-propia`) asevera el ORDEN sobre el texto del
   archivo, y el texto no es el mecanismo — la lección del barrido del 30-ago.
   Lo que de verdad importa (qué se ESCRIBE con el candado abierto y con el
   candado cerrado) se ejecuta aquí, sobre funciones puras.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · qué identidad recibe un expediente al nacer, en las DOS posiciones del
       candado, incluida la huella de limpieza que el ADR §3.4 conserva;
     · que el candado esté CERRADO en el código que se despliega — un custodio
       que también es una alarma: si alguien lo abre sin querer, esta prueba
       se pone roja antes de que un número real se consuma.
   Esto NO mira: la emisión en sí (`emitir-numero-expediente` y su
   transaccionalidad tienen sus propias pruebas), ni el cableado de la ruta
   (orden y candado, en la prueba hermana).
══════════════════════════════════════════════════════════════ */

describe('el candado sigue CERRADO en lo que se despliega', () => {
  it('EMISION_REAL_EXPEDIENTES_HABILITADA es false — abrirlo es un acto, no un descuido', () => {
    /* Esta aserción es una ALARMA, no burocracia: mientras esté en false,
       ninguna rama de emisión se alcanza en producción. El día del arranque
       se cambia a propósito, y esta prueba con ella. */
    expect(EMISION_REAL_EXPEDIENTES_HABILITADA).toBe(false);
  });
});

describe('identidadAlNacer — qué recibe un expediente el día que nace', () => {
  const AHORA = new Date('2026-09-02T12:00:00.000Z');

  it('con el candado CERRADO nace de DEMOSTRACIÓN, con su huella completa', () => {
    /* La dupla `esPrueba` + serie `demo` NO es decorativa: es la huella con la
       que el guion de limpieza distingue lo borrable, y la que hace
       fail-closed a los gates de sello. El ADR-0041 §3.4 la conserva a
       propósito. */
    const id = identidadAlNacer(AHORA, false);
    expect(id.esPrueba).toBe(true);
    expect(id.numeroExpediente?.serieId).toBe('demo');
    expect(id.numeroExpediente?.numero).toMatch(/^DEMO-26-[0-9a-f]{8}$/);
  });

  it('con el candado ABIERTO nace SIN número y SIN marca de prueba', () => {
    /* El número se emite en la radicación en debida forma —el acto que el
       libro del ingeniero numera—; ponerle uno al nacer sería gastar serie
       por un expediente que quizá nunca se radique. */
    const id = identidadAlNacer(AHORA, true);
    expect(id.numeroExpediente).toBeUndefined();
    expect(id.esPrueba).toBeUndefined();
  });

  it('el que nace sin número NO se hace pasar por radicado en ninguna superficie', () => {
    /* La otra mitad: un expediente sin número no debe producir un valor que
       los papeles impriman bajo el rótulo de ventanilla. */
    const id = identidadAlNacer(AHORA, true);
    expect(numeroDeEntrada({ radicadoId: null, numeroExpediente: id.numeroExpediente })).toBeNull();
  });

  it('sin decirle nada, usa el candado real — no un valor por defecto inventado', () => {
    /* Si el parámetro tuviera un default distinto del candado, la rama que se
       ejecuta en producción no sería la que estas pruebas ejercitan.

       Se compara la FORMA, no el valor: el número DEMO lleva una parte
       aleatoria y dos llamadas nunca dan lo mismo. Lo que se afirma es que el
       default cae del mismo lado del candado. */
    const porDefecto = identidadAlNacer(AHORA);
    const conElCandadoReal = identidadAlNacer(AHORA, EMISION_REAL_EXPEDIENTES_HABILITADA);
    expect(porDefecto.esPrueba).toBe(conElCandadoReal.esPrueba);
    expect(porDefecto.numeroExpediente?.serieId).toBe(conElCandadoReal.numeroExpediente?.serieId);
  });
});
