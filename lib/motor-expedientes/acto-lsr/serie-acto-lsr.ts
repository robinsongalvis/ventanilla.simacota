/**
 * lib/motor-expedientes/acto-lsr/serie-acto-lsr.ts
 *
 * CÓMO SE ESCRIBE Y CÓMO SE CUENTA EL NÚMERO DE LA RESOLUCIÓN.
 *
 * Decidido por Planeación el 14-sep-2026: **una serie por modalidad, que
 * reinicia cada año**, escrita **«LSR No. 001-2025»**.
 *
 * ── ESTE ARCHIVO NO EMITE NINGÚN NÚMERO ───────────────────────────────────
 *
 * Da la FORMA y dice cuál es el siguiente; no toca contador ni reserva nada.
 * Abrir las series en producción es el paso 5 del ADR-0041 y lo ordena el
 * propietario — «producción la abro yo, y esa regla no tiene excepción».
 *
 * ── LA MODALIDAD QUE NO TIENE CONTADOR PROPIO, Y POR QUÉ ──────────────────
 *
 * El ingeniero describió LA (ampliación) como «la misma de LC en términos, pero
 * siguen siendo diferentes», y —a diferencia del resto— no dio un último número
 * para ella. La frase admite dos lecturas: que comparte el consecutivo de LC, o
 * que tiene el suyo y solo se parece en el régimen.
 *
 * Mientras eso no se aclare, LA **no abre contador propio**. El criterio no es
 * de gusto: las dos equivocaciones no cuestan lo mismo.
 *
 *   · Si LA comparte con LC y le abrimos serie propia, la primera ampliación
 *     del año se lleva un número que LC ya usó → DOS ACTOS CON EL MISMO NÚMERO.
 *   · Si LA tiene serie propia y la hacemos compartir, se saltan números en la
 *     de LC → un HUECO.
 *
 * Un hueco se explica y se corrige; un número repetido ya está notificado a dos
 * ciudadanos. Se elige el error recuperable. Es el mismo defecto que el libro
 * manual produjo con el `68745-0-25-0037`.
 */

/** Las modalidades que el libro del ingeniero registra. */
export type ModalidadActo = 'LSR' | 'LC' | 'LSU' | 'PH' | 'LR' | 'LA' | 'LU';

/**
 * Qué serie usa cada modalidad. LA apunta a LC — ver la cabecera.
 * Un mapa COMPLETO y no un `if`: una modalidad nueva sin serie no compila.
 */
export const SERIE_DE_LA_MODALIDAD: Readonly<Record<ModalidadActo, ModalidadActo>> = {
  LSR: 'LSR', LC: 'LC', LSU: 'LSU', PH: 'PH', LR: 'LR', LU: 'LU',
  /* Pendiente de aclarar. Comparte el consecutivo de construcción. */
  LA: 'LC',
};

/**
 * El CONTADOR del que sale el número de cada modalidad.
 *
 * Deriva de `SERIE_DE_LA_MODALIDAD`, no se escribe aparte: si LA dejara de
 * compartir con LC, cambiar el mapa de arriba basta y esto lo sigue. Dos listas
 * paralelas sobre lo mismo es exactamente lo que produjo la divergencia de
 * quince días en el plazo de subsanación.
 */
export function contadorDeLaModalidad(modalidad: ModalidadActo): string {
  return `actos-${SERIE_DE_LA_MODALIDAD[modalidad].toLowerCase()}`;
}

/**
 * El número, escrito. `LSR No. 001-2025`.
 *
 * El consecutivo va a TRES dígitos porque así lo lleva el libro (`001`, `013`)
 * y así lo imprime el acto. Cuatro dígitos serían otro formato, y el formato ya
 * se decidió.
 */
export function formatearNumeroActo(modalidad: ModalidadActo, consecutivo: number, anio: number): string {
  return `${modalidad} No. ${String(consecutivo).padStart(3, '0')}-${anio}`;
}

/** Lo contrario, para leer lo que ya está escrito. `null` si no tiene esta forma. */
export function leerNumeroActo(texto: string): { modalidad: string; consecutivo: number; anio: number } | null {
  /* Insensible a mayúsculas, pero la modalidad SÍ se normaliza: en el libro
     conviven «LSR» y «Lsr», y el rótulo del acto va siempre en mayúscula. */
  const m = /^([A-Za-z]{2,4})\s+No\.\s*(\d{1,4})-(\d{4})$/i.exec(texto.trim().replace(/\s+/g, ' '));
  if (!m) return null;
  return { modalidad: m[1]!.toUpperCase(), consecutivo: Number(m[2]), anio: Number(m[3]) };
}

/**
 * El siguiente de la serie. PURA: recibe el último usado y devuelve el que
 * sigue; no lee ni escribe contador alguno.
 *
 * Reinicia en 1 cuando cambia el año — es lo que se decidió, y lo que el libro
 * muestra: LSR fue 001 en 2025 y va en 013 en 2026.
 */
export function siguienteConsecutivo(
  ultimo: { consecutivo: number; anio: number } | null,
  anioDelActo: number,
): number {
  if (!ultimo || ultimo.anio !== anioDelActo) return 1;
  return ultimo.consecutivo + 1;
}

/**
 * EL ÚLTIMO NÚMERO USADO EN CADA SERIE, según el libro del ingeniero
 * (14-sep-2026). Es el punto de partida de la apertura, NO un contador vivo.
 *
 * `LU` no aparece: el ingeniero respondió «no tiene», así que su serie abriría
 * en 001 el día que se use. `LA` tampoco, porque no tiene serie propia.
 */
export const ULTIMO_CONFIRMADO_2026: Readonly<Partial<Record<ModalidadActo, number>>> = {
  LSR: 13, LC: 8, LSU: 2, PH: 3, LR: 1,
};

/** El último radicado de entrada usado en 2026 — `68745-0-26-0025`. La serie abre en 0026. */
export const ULTIMO_RADICADO_2026 = 25;
