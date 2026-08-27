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
 * QUÉ AÑADE, SI Y SOLO SI ESTÁ CAPTURADA: **la modalidad**. Las 9 modalidades
 * de construcción del art. 2.2.6.1.1.7 son un EJE DISTINTO de las figuras (así
 * lo declara el catálogo) y viven en `expediente.modalidadesConstruccion`.
 *
 * Hubo un tiempo —hasta que ese campo existió— en que estos papeles NO podían
 * nombrarla, porque nadie la capturaba y nombrarla habría sido inventarla. Esa
 * es la regla que sobrevive al cambio: **lo que no está capturado no se
 * nombra**. Un expediente anterior al campo sigue diciendo «licencia de
 * construcción» a secas, y eso es cierto para las nueve modalidades —incluida
 * la demolición, que es una modalidad de esa licencia, no una licencia aparte—.
 *
 * Lo que NUNCA se hace es rellenar la ausencia con «obra nueva»: es la doctrina
 * del ADR-0033, no afirmar un hecho que no ocurrió.
 */
import { CATALOGO_FIGURAS_NORMATIVAS } from './catalogo-subtipos-normativo';
import { describirModalidades, FIGURA_CON_MODALIDAD } from './modalidad-construccion';

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
 * @param modalidadesConstruccion Modalidades capturadas, si las hay. Se anexan
 *   a la figura de construcción —«licencia de construcción · demolición»— y solo
 *   cuando esa figura está presente: una modalidad sin su figura sería un dato
 *   descolgado, y el papel no lo arrastra.
 * @returns Texto en minúsculas, listo para insertarse en una frase corrida.
 *
 * Un código que no esté en el catálogo NO se descarta en silencio —sería
 * exactamente el defecto que este módulo corrige, cambiado de sitio—: se
 * transcribe tal cual, para que el papel muestre el código real y quien lo lea
 * note que hay algo que el sistema no sabe traducir.
 */
export function describirTramiteDesdeSubtipos(
  subtipos: readonly string[] | undefined,
  modalidadesConstruccion?: readonly string[] | undefined,
): string {
  if (!Array.isArray(subtipos) || subtipos.length === 0) {
    return DESCRIPCION_TRAMITE_SIN_FIGURA;
  }

  /* La modalidad califica a SU figura, no a la frase entera: en una solicitud
     combinada (urbanización + construcción) es la construcción la que lleva
     apellido. */
  const modalidades = subtipos.includes(FIGURA_CON_MODALIDAD)
    ? describirModalidades(modalidadesConstruccion)
    : null;

  const nombres = subtipos
    .map((codigo) => (typeof codigo === 'string' ? codigo.trim() : ''))
    .filter((codigo) => codigo.length > 0)
    .map((codigo) => {
      const nombre = NOMBRE_POR_CODIGO.get(codigo) ?? codigo;
      return codigo === FIGURA_CON_MODALIDAD && modalidades ? `${nombre} · ${modalidades}` : nombre;
    });

  if (nombres.length === 0) return DESCRIPCION_TRAMITE_SIN_FIGURA;
  if (nombres.length === 1) return nombres[0];

  const ultimo = nombres[nombres.length - 1];
  return `${nombres.slice(0, -1).join(', ')} y ${ultimo}`;
}
