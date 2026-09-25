/**
 * lib/motor-expedientes/acto-lsr/decisiones-tomadas.ts
 *
 * LAS RESPUESTAS — quién las dio, cuándo, y qué queda anotado de cada una.
 *
 * `decisiones-pendientes.ts` declara las cuatro preguntas y se niega a
 * contestarlas. Este archivo es el otro lado: las trae ya contestadas, con su
 * procedencia. Se separan a propósito — el que pregunta no puede ser el mismo
 * que responde, y así se ve de un vistazo qué se decidió fuera del código.
 *
 * ── LO QUE SE ANOTA, Y POR QUÉ NO ES ADORNO ───────────────────────────────
 *
 * Dos de estas decisiones se apartan de una fuente escrita, y el sistema tiene
 * que poder decir en qué se apoyó el día que alguien reclame:
 *
 *  · el FORMATO elegido (`LSR No. 001-2025`) no es el del acto real, que dice
 *    «LSR No. 001 DE 2.025»;
 *  · la VIGENCIA desde la expedición se aparta del D.1783/2021 art. 27, que la
 *    investigación normativa transcribió como «desde la firmeza» — y cuenta en
 *    contra del titular: le recorta días de licencia.
 *
 * Ninguna de las dos se corrige aquí. Se aplican como se decidieron y se deja
 * la salvedad escrita, que es lo que un expediente necesita para defenderse.
 */
import type { ParametrosDelActo } from './decisiones-pendientes';

export interface Procedencia {
  decision: string;
  quienDecidio: string;
  fecha: string;
  /** La salvedad, cuando la hay. Vacía cuando la decisión no se aparta de nada. */
  salvedad?: string;
}

/**
 * EL TEXTO DE RECURSOS.
 *
 * La SUSTANCIA está decidida: solo reposición, ante la misma Secretaría, dentro
 * de los diez días siguientes a la notificación (CPACA art. 76). La REDACCIÓN
 * exacta sigue reservada al concepto escrito de Jurídica — mismo tratamiento
 * que `TEXTO_RECURSOS_DESISTIMIENTO_TACITO`, y por el mismo motivo: un texto de
 * notificación mal redactado vicia el acto. Cuando llegue el concepto se cambia
 * esta constante, no la función que la usa.
 */
export const TEXTO_RECURSOS_RESOLUCION_LSR =
  'Contra la presente Resolución procede únicamente el recurso de reposición, ante la Secretaría de Planeación e '
  + 'Infraestructura del Municipio de Simacota, dentro de los diez (10) días siguientes a su notificación '
  + '(Ley 1437 de 2011, art. 76). No procede recurso de apelación.';

/** Los cuatro parámetros, tal como quedaron. */
export const PARAMETROS_DECIDIDOS: Omit<ParametrosDelActo, 'numeroResolucion'> = {
  textoRecursos: TEXTO_RECURSOS_RESOLUCION_LSR,
  origenVigencia: 'EXPEDICION',
};

export const PROCEDENCIA: readonly Procedencia[] = [
  {
    decision: 'SERIE_DEL_ACTO — una serie por modalidad, reiniciando cada año',
    quienDecidio: 'Planeación, por conducto del propietario',
    fecha: '2026-09-14',
    salvedad:
      'La modalidad LA (ampliación) quedó descrita como «la misma de LC en términos, pero siguen siendo diferentes». '
      + 'Mientras eso no se aclare, NO se abre contador propio para LA — ver `serie-acto-lsr.ts`.',
  },
  {
    decision: 'FORMATO_DEL_NUMERO — «LSR No. 001-2025»',
    quienDecidio: 'Planeación, por conducto del propietario',
    fecha: '2026-09-14',
    salvedad:
      'El acto real de enero de 2025 escribe «LSR No. 001 DE 2.025». Se adopta la forma con guion para lo que se '
      + 'expida de aquí en adelante; los actos ya expedidos no se reescriben (AGN 060).',
  },
  {
    decision: 'TEXTO_RECURSOS — solo reposición',
    quienDecidio: 'Jurídica, por conducto del propietario',
    fecha: '2026-09-14',
    salvedad:
      'Corrige el acto real, que enuncia «reposición y apelación». Coincide con lo acordado en la mesa del 10-ago-2026 '
      + 'y con lo que el sistema ya redacta en el acto de desistimiento. La FÓRMULA exacta sigue reservada al concepto '
      + 'escrito de Jurídica.',
  },
  {
    decision: 'ORIGEN_VIGENCIA — desde la expedición',
    quienDecidio: 'Planeación, por conducto del propietario',
    fecha: '2026-09-14',
    salvedad:
      'Se aparta del D.1783/2021 art. 27, transcrito en la investigación normativa como «desde la FIRMEZA», y cuenta '
      + 'en contra del titular: en el acto de enero de 2025 son dieciocho días menos de vigencia. Se aplica lo decidido '
      + 'y la salvedad queda escrita. Sigue pendiente el concepto escrito de Jurídica.',
  },
];
