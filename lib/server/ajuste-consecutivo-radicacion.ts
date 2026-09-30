import { formatearRadicadoInstitucional } from '@/lib/radicado-institucional';

/**
 * AJUSTE DEL CONSECUTIVO DE RADICACIÓN — relevo entre sistemas.
 *
 * POR QUÉ EXISTE. La Alcaldía viene de otro software que sigue emitiendo
 * radicados hasta el día del relevo. Cuál será el último NO se sabe de
 * antemano: hay días en que no llega nada y días en que llegan decenas, así que
 * el número puede pasar de 1744 a 1780 en una jornada. Fijarlo por adelantado
 * es adivinar; el dato solo existe el día del corte, y lo tiene la funcionaria
 * de ventanilla mirando su libro.
 *
 * Por eso el ajuste es una operación de ADMINISTRACIÓN y no una constante del
 * código: alguien con el libro delante dice «el último fue el 1779» y el
 * sistema continúa desde el 1780, sin huecos y sin repetir.
 *
 * ── LA ÚNICA REGLA QUE IMPORTA: SOLO SE AVANZA ────────────────────────────
 *
 * Retroceder el contador reemitiría números ya entregados. Y un radicado
 * entregado no se puede recuperar: el ciudadano se fue con su constancia en la
 * mano. Dos trámites distintos con el mismo número no son un error de datos —
 * son dos expedientes con la misma identidad legal, y no hay forma limpia de
 * decidir cuál de los dos ciudadanos tiene el papel que vale.
 *
 * Avanzar, en cambio, es siempre seguro: como mucho deja un hueco, y un hueco
 * se explica en una línea del acta de migración.
 *
 * Por eso la validación es asimétrica a propósito — permisiva hacia adelante,
 * cerrada hacia atrás — y vive en el SERVIDOR: la pantalla puede ayudar, pero
 * no es quien decide.
 */

/** Tope defensivo: el consecutivo se reinicia cada año y ningún municipio radica tanto. */
export const MAXIMO_CONSECUTIVO_RAZONABLE = 99_999_999;

export interface ErrorAjusteConsecutivo {
  status: number;
  mensaje: string;
}

export interface EstadoConsecutivoRadicacion {
  anio: number;
  /** Último consecutivo EMITIDO. El próximo radicado será este + 1. */
  ultimo: number;
  /** Cómo se verá el próximo radicado — para confirmar antes de guardar. */
  proximoRadicado: string;
}

export function describirEstado(anio: number, ultimo: number, fecha = new Date()): EstadoConsecutivoRadicacion {
  return {
    anio,
    ultimo,
    proximoRadicado: formatearRadicadoInstitucional(ultimo + 1, fecha),
  };
}

/**
 * ¿Es válido mover el contador de `actual` a `nuevo`?
 *
 * Función PURA: no lee ni escribe: así la regla se puede probar sola y no
 * depende de que quien la llame haya hecho bien su transacción.
 *
 * @param actual Último consecutivo emitido hoy.
 * @param nuevo  Último consecutivo del sistema ANTERIOR (el próximo radicado será `nuevo + 1`).
 */
export function validarAjusteConsecutivo(actual: number, nuevo: unknown): ErrorAjusteConsecutivo | null {
  if (typeof nuevo !== 'number' || !Number.isFinite(nuevo)) {
    return { status: 400, mensaje: 'El consecutivo debe ser un número.' };
  }
  if (!Number.isInteger(nuevo)) {
    return { status: 400, mensaje: 'El consecutivo debe ser un número entero, sin decimales.' };
  }
  if (nuevo < 0) {
    return { status: 400, mensaje: 'El consecutivo no puede ser negativo.' };
  }
  if (nuevo > MAXIMO_CONSECUTIVO_RAZONABLE) {
    return {
      status: 400,
      mensaje: `El consecutivo supera el máximo admitido (${MAXIMO_CONSECUTIVO_RAZONABLE.toLocaleString('es-CO')}). Revise el número.`,
    };
  }
  if (nuevo === actual) {
    return { status: 409, mensaje: `El consecutivo ya está en ${actual}. No hay nada que cambiar.` };
  }
  if (nuevo < actual) {
    return {
      status: 409,
      mensaje:
        `No se puede retroceder el consecutivo de ${actual} a ${nuevo}. `
        + 'Los radicados ya emitidos están en manos de los ciudadanos y volver atrás los repetiría. '
        + 'El consecutivo solo puede avanzar.',
    };
  }
  return null;
}
