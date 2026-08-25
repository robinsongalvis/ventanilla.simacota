import type { SerieConsecutivo } from '@/lib/server/consecutivo-legal';

/**
 * APERTURA DE UNA SERIE CONSECUTIVA — sincronizar la plataforma con el libro.
 *
 * POR QUÉ EXISTE, y por qué el número no es continuo con el libro de papel.
 *
 * El libro de correspondencia de la Alcaldía **avanza todos los días**: mientras
 * ventanilla siga radicando a mano, cualquier número que se fije por anticipado
 * queda viejo antes del primer trámite real. Si hoy el libro va en 1542, cuando
 * la plataforma arranque puede ir en 1550 o en 1600.
 *
 * Por eso la apertura NO se fija en el código ni con semanas de antelación: el
 * propietario consulta el libro el día del arranque y fija el punto entonces.
 *
 * Y por eso se abre POR ENCIMA del libro, con margen, no en el número
 * siguiente. Entre la consulta y el arranque puede que ventanilla radique algo
 * a mano; con margen ese radicado cabe sin chocar. La regla que lo justifica es
 * asimétrica y conviene tenerla escrita:
 *
 *     UN HUECO EN LA SERIE SE EXPLICA. UN DUPLICADO NO.
 *
 * Un hueco se documenta con un acta y se sostiene ante una auditoría. Dos
 * documentos distintos con el mismo número de radicado son dos expedientes que
 * se pisan, y eso no se arregla con una explicación.
 *
 * ACTO ÚNICO, NUNCA UN AJUSTE CONTINUO. Si el contador ya está por encima del
 * punto configurado, esta operación NO HACE NADA — no baja, no corrige, no
 * "sincroniza". Bajar un contador es emitir dos veces el mismo número, que es
 * exactamente lo que se viene a evitar.
 */

/** Lo que el propietario configura, sin desplegar, para abrir una serie. */
export interface AperturaConfigurada {
  /** Primer consecutivo que la plataforma emitirá. Se fija CON MARGEN sobre el libro. */
  desde: number;
  /** Quién lo autorizó — queda escrito en el contador para que el salto tenga dueño. */
  autorizadoPor: string;
  /** Acta o referencia que respalda la apertura. */
  referencia?: string;
}

export type DecisionApertura =
  | { accion: 'ABRIR'; veniaDe: number; nuevoUltimo: number }
  /** El contador ya está igual o por encima: no se toca. NO es un error. */
  | { accion: 'NADA'; motivo: string }
  /** La configuración no sirve: se rechaza sin escribir. */
  | { accion: 'RECHAZAR'; motivo: string };

/**
 * Decide qué hacer con una serie. Función PURA: sin Firestore, sin reloj.
 *
 * @param ultimoActual Valor de `counters/{serie}-{año}.ultimo` (0 si no existe).
 * @param config       Lo que el propietario configuró para esa serie.
 */
export function decidirApertura(
  serie: SerieConsecutivo,
  ultimoActual: number,
  config: AperturaConfigurada | undefined,
): DecisionApertura {
  if (!config) {
    return { accion: 'NADA', motivo: `La serie '${serie}' no tiene punto de apertura configurado.` };
  }
  if (!Number.isInteger(ultimoActual) || ultimoActual < 0) {
    return {
      accion: 'RECHAZAR',
      motivo: `El contador de '${serie}' tiene un valor inválido (${ultimoActual}). No se abre sobre un contador que no se entiende.`,
    };
  }
  if (!Number.isInteger(config.desde) || config.desde <= 0) {
    return {
      accion: 'RECHAZAR',
      motivo: `Punto de apertura inválido para '${serie}' (${config.desde}). Debe ser un entero positivo.`,
    };
  }
  if (!config.autorizadoPor?.trim()) {
    return {
      accion: 'RECHAZAR',
      motivo: `La apertura de '${serie}' no declara quién la autoriza. Un salto en la serie sin dueño es un salto que nadie puede explicar.`,
    };
  }

  /* `desde` es el PRIMER número a emitir, así que el contador debe quedar en
     `desde - 1`: la próxima emisión hace +1 y sale `desde`. Confundir esto
     desplaza la serie entera en uno, que es un error silencioso y caro. */
  const nuevoUltimo = config.desde - 1;

  if (nuevoUltimo <= ultimoActual) {
    return {
      accion: 'NADA',
      motivo:
        `El contador de '${serie}' ya está en ${ultimoActual}; abrir en ${config.desde} lo dejaría en ` +
        `${nuevoUltimo}, que no avanza. NO se toca: bajar un contador es emitir dos veces el mismo número.`,
    };
  }

  return { accion: 'ABRIR', veniaDe: ultimoActual, nuevoUltimo };
}

/** Lo que se escribe en el contador al abrir — el salto queda con su historia. */
export interface RegistroApertura {
  /** Valor que tenía el contador antes de la apertura. */
  veniaDe: number;
  /** Primer consecutivo que se emitirá tras la apertura. */
  abiertoEn: number;
  fecha: string;
  autorizadoPor: string;
  referencia?: string;
  /**
   * Por qué el número NO es continuo con el libro de papel. Se guarda en el
   * DATO y no solo en un acta: dentro de un año alguien verá el salto en la
   * serie, y la explicación debe estar donde está el salto.
   */
  motivoDelSalto: string;
}

export const MOTIVO_DEL_SALTO =
  'El libro de correspondencia avanza a diario mientras ventanilla radica a mano, ' +
  'así que cualquier número fijado por anticipado queda desactualizado antes del ' +
  'primer trámite real. La serie se abre POR ENCIMA del libro, con margen, para ' +
  'que un radicado manual hecho entre la consulta y el arranque no choque: un ' +
  'hueco en la serie se explica con acta, un duplicado no se arregla.';

export function construirRegistroApertura(
  decision: Extract<DecisionApertura, { accion: 'ABRIR' }>,
  config: AperturaConfigurada,
  ahoraIso: string,
): RegistroApertura {
  return {
    veniaDe: decision.veniaDe,
    abiertoEn: decision.nuevoUltimo + 1,
    fecha: ahoraIso,
    autorizadoPor: config.autorizadoPor.trim(),
    ...(config.referencia ? { referencia: config.referencia } : {}),
    motivoDelSalto: MOTIVO_DEL_SALTO,
  };
}
