/**
 * lib/motor-expedientes/describir-tramite.ts
 *
 * Deriva la descripción del trámite que aparece en los PAPELES QUE RECIBE EL
 * CIUDADANO —la constancia impresa de radicación y el acuse de recibo por
 * correo— a partir de lo que el expediente REALMENTE tiene guardado.
 *
 * Puro, sin I/O: dato de entrada, texto de salida.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────────
 *
 * Los dos papeles decían «licencia de construcción · obra nueva» a TODO el
 * mundo, porque tomaban el nombre de la única `DefinicionTramite` cableada en
 * el servidor. Un acto de reconocimiento recibía un papel firmado por la
 * Secretaría de Planeación afirmando que había solicitado una licencia de
 * construcción de obra nueva. En un documento con efectos, eso no es una
 * etiqueta mal puesta.
 *
 * ── EL ALCANCE, DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────
 *
 * QUÉ MIRA: `expediente.subtipos`, los códigos de FIGURA validados contra
 * `CATALOGO_FIGURAS_NORMATIVAS` en los dos caminos de creación y persistidos
 * en el documento raíz. Son las 9 figuras del D.1077/2015: urbanización,
 * parcelación, subdivisión (rural y urbana), reloteo, construcción, espacio
 * público, reconocimiento y aprobación de planos de propiedad horizontal.
 *
 * QUÉ NO DICE, DELIBERADAMENTE: **la modalidad**. Las 9 modalidades de
 * construcción del art. 2.2.6.1.1.7 —obra nueva, ampliación, adecuación,
 * modificación, restauración, reforzamiento estructural, demolición,
 * cerramiento y reconstrucción— son un EJE DISTINTO de las figuras (así lo
 * declara el propio catálogo), y hoy **el sistema no las captura en ninguna
 * parte**: no son un subtipo, no son una clave de contexto, no hay campo que
 * las guarde. Nadie se las pregunta al funcionario.
 *
 * Por eso estos papeles ya no afirman ninguna. Decir «construcción» cuando el
 * expediente dice CONSTRUCCION es cierto para las nueve modalidades, incluida
 * la demolición —que es una modalidad de la licencia de construcción, no una
 * licencia aparte—. Añadirle «obra nueva» sería inventar el único dato que
 * nadie recogió. La doctrina es la del ADR-0033: no afirmar un hecho que no
 * ocurrió, y tampoco callarlo; aquí se calla lo que no se sabe, y lo que se
 * sabe se dice completo.
 *
 * CUANDO EL SISTEMA CAPTURE LA MODALIDAD, este es el sitio donde entra: se le
 * añade un segundo argumento y se compone «licencia de construcción ·
 * demolición». Mientras tanto, la ausencia es visible aquí y no repartida por
 * las plantillas.
 */
import { CATALOGO_FIGURAS_NORMATIVAS } from './catalogo-subtipos-normativo';

/**
 * Texto usado cuando el expediente no tiene figuras utilizables. No nombra
 * ninguna licencia: un expediente histórico migrado puede no traer subtipos, y
 * el papel no puede rellenar ese hueco con una suposición.
 */
export const DESCRIPCION_TRAMITE_SIN_FIGURA = 'trámite ante la Secretaría de Planeación';

/** Índice código → nombre, construido UNA vez desde el catálogo normativo. */
const NOMBRE_POR_CODIGO = new Map(
  CATALOGO_FIGURAS_NORMATIVAS.map((f) => [f.codigo, f.nombre.toLowerCase()]),
);

/**
 * Compone la descripción del trámite para un papel dirigido al ciudadano.
 *
 * @param subtipos Códigos de figura persistidos en el expediente. Una solicitud
 *   puede combinar varias (p. ej. urbanización + construcción), y entonces el
 *   papel las nombra todas: omitir una sería describir de menos lo que se pidió.
 * @returns Texto en minúsculas, listo para insertarse en una frase corrida.
 *
 * Un código que no esté en el catálogo NO se descarta en silencio —sería
 * exactamente el defecto que este módulo corrige, cambiado de sitio—: se
 * transcribe tal cual, para que el papel muestre el código real y quien lo lea
 * note que hay algo que el sistema no sabe traducir.
 */
export function describirTramiteDesdeSubtipos(subtipos: readonly string[] | undefined): string {
  if (!Array.isArray(subtipos) || subtipos.length === 0) {
    return DESCRIPCION_TRAMITE_SIN_FIGURA;
  }

  const nombres = subtipos
    .map((codigo) => (typeof codigo === 'string' ? codigo.trim() : ''))
    .filter((codigo) => codigo.length > 0)
    .map((codigo) => NOMBRE_POR_CODIGO.get(codigo) ?? codigo);

  if (nombres.length === 0) return DESCRIPCION_TRAMITE_SIN_FIGURA;
  if (nombres.length === 1) return nombres[0];

  const ultimo = nombres[nombres.length - 1];
  return `${nombres.slice(0, -1).join(', ')} y ${ultimo}`;
}
