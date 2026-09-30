/**
 * NÚMERO DE RADICADO EDITABLE EN VENTANILLA — relevo del software anterior.
 *
 * POR QUÉ. El municipio releva el software que veía ventanilla, y ese sistema
 * sigue emitiendo radicados hasta el día del corte. Cuál será el último NO se
 * sabe de antemano: hay días sin nada y días en que el número salta decenas
 * (1744 → 1780 en una jornada). El dato solo existe el día del relevo, en el
 * libro que tiene la funcionaria delante. Por eso el número aparece escrito y
 * editable en el momento de radicar, no configurado semanas antes.
 *
 * QUÉ HACE ESTE MÓDULO. Traduce lo que la funcionaria escribe a la decisión que
 * corresponde, ANTES de tocar la red:
 *  · escribió el mismo número que ya venía → radicar y no molestar a nadie;
 *  · escribió uno mayor → hay que fijar el contador primero (el ajuste declara
 *    el ÚLTIMO del sistema anterior, o sea el escrito menos uno);
 *  · escribió uno menor → se explica aquí y no se envía: retroceder reemitiría
 *    radicados que ya están en manos de ciudadanos.
 *
 * DÓNDE MANDA DE VERDAD. Esta es una función de pantalla: ayuda a ver el número
 * y a entender el error antes de enviarlo. La regla vive en el servidor
 * (`lib/server/ajuste-consecutivo-radicacion.ts`) y allí se vuelve a validar
 * dentro de una transacción. Si algún día discrepan, gana el servidor.
 *
 * NO SE TOCA LA EMISIÓN. El consecutivo se sigue emitiendo por la transacción de
 * siempre (defecto H3 — consecutivos fantasma, guard D9, ADR-0029). Lo que hace
 * este camino es dejar el contador en su sitio y radicar normal: la numeración
 * legal continúa saliendo de donde siempre ha salido.
 */

/** Longitud del consecutivo en el identificador institucional: `1-110-{AAAAMM}-{8}`. */
export const DIGITOS_CONSECUTIVO = 8;

/** Reconoce el identificador institucional para poder partirlo sin adivinar. */
const IDENTIFICADOR = /^(1-\d+-\d{6}-)(\d{1,8})$/;

export interface PartesIdentificador {
  /** `1-110-202609-` — fijo: nunca lo edita nadie desde la pantalla. */
  prefijo: string;
  /** Los dígitos finales, tal cual vienen (con ceros a la izquierda). */
  consecutivo: string;
}

/**
 * Parte `1-110-202609-00001780` en prefijo y consecutivo.
 * Devuelve `null` si el texto no es un identificador — así la pantalla sabe
 * cuándo NO puede ofrecer edición (por ejemplo mientras aún está cargando).
 */
export function partirIdentificador(radicado: string): PartesIdentificador | null {
  const m = IDENTIFICADOR.exec(radicado.trim());
  return m ? { prefijo: m[1], consecutivo: m[2] } : null;
}

/** Deja solo dígitos y recorta al ancho del campo: lo que se pega desde el libro suele venir sucio. */
export function normalizarConsecutivo(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, DIGITOS_CONSECUTIVO);
}

export type PlanRelevo =
  /** El número no se cambió: se radica por el camino de siempre. */
  | { accion: 'radicar' }
  /** Hay que fijar el contador antes de radicar. */
  | { accion: 'ajustar'; ultimoDelSistemaAnterior: number; motivo: string; numeroEsperado: number }
  /** No se envía nada: lo escrito no puede emitirse y se explica por qué. */
  | { accion: 'rechazar'; mensaje: string };

/**
 * ¿Qué hay que hacer con lo que escribió la funcionaria?
 *
 * @param proximoOriginal Identificador que el servidor dijo que saldría (`1-110-202609-00000030`).
 * @param consecutivoEscrito Los dígitos que quedaron en el campo.
 */
export function planearRelevo(proximoOriginal: string, consecutivoEscrito: string): PlanRelevo {
  const partes = partirIdentificador(proximoOriginal);
  if (!partes) {
    // Sin número de referencia no hay nada que comparar: se radica normal y el
    // servidor emite lo que toque. Nunca se bloquea una radicación por esto.
    return { accion: 'radicar' };
  }

  const escrito = normalizarConsecutivo(consecutivoEscrito);
  if (escrito === '') {
    return { accion: 'rechazar', mensaje: 'Escriba el número del radicado o deje el que apareció.' };
  }

  const numero = Number(escrito);
  const original = Number(partes.consecutivo);

  if (numero === original) return { accion: 'radicar' };

  if (numero === 0) {
    return {
      accion: 'rechazar',
      mensaje: 'El radicado no puede ser el número cero. Escriba el número que sigue al del libro.',
    };
  }

  if (numero < original) {
    return {
      accion: 'rechazar',
      mensaje:
        `El número ${numero} ya se usó: el siguiente disponible es el ${original}. `
        + 'Los radicados ya emitidos están en manos de los ciudadanos y repetirlos '
        + 'crearía dos trámites con el mismo número. El consecutivo solo puede avanzar.',
    };
  }

  /* El motivo no es trámite: es la línea que le explica el hueco a quien audite
     el libro dentro de dos años, cuando nadie recuerde por qué faltan números.
     Se escribe solo, con los dos datos que importan: de dónde venía y a dónde va. */
  return {
    accion: 'ajustar',
    ultimoDelSistemaAnterior: numero - 1,
    numeroEsperado: numero,
    motivo:
      `Relevo del software anterior: en ventanilla se declara ${numero - 1} como último `
      + `radicado del libro, para continuar en ${numero}.`,
  };
}
