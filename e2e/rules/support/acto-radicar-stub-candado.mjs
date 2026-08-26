/**
 * e2e/rules/support/acto-radicar-stub-candado.mjs
 *
 * TERCERA FRONTERA del arnés del acto de radicar (ver `acto-radicar-entorno.mjs`).
 *
 * Reexporta `@/lib/server/expedientes-licencias` ENTERO —el evaluador, el
 * planificador, los guards, todo— y sustituye UNA sola función:
 * `evaluarCandadoEmisionReal`, que aquí declara el candado ABIERTO.
 *
 * POR QUÉ. `EMISION_REAL_EXPEDIENTES_HABILITADA = false` (doctrina R10) hace
 * que la ruta devuelva 422 SIEMPRE. Es lo correcto en producción, y es lo que
 * impide ejercitar aquí la concurrencia del acto.
 *
 * La alternativa —una vía de escape por variable de entorno en la constante—
 * se descartó: aflojar una protección de producción para comodidad de una
 * prueba es exactamente lo que este proyecto no hace, y además el candado
 * dejaría de poder verificarse leyendo el código.
 *
 * LO QUE ESTE ARCHIVO SIGNIFICA, dicho para que nadie lo descubra tarde: las
 * pruebas que pasan por aquí NO verifican que el candado esté cerrado. Eso lo
 * asevera `__tests__/expedientes-licencias-rutas-ejecucion.test.ts` sobre el
 * código real y sin este arnés.
 */

export * from '../../../lib/server/expedientes-licencias';

/** Candado abierto — SOLO dentro del arnés del emulador. */
export function evaluarCandadoEmisionReal() {
  return { candadoAbierto: true };
}
