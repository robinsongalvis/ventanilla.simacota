/**
 * lib/motor-expedientes/acto-lsr/decisiones-pendientes.ts
 *
 * LAS CUATRO DECISIONES QUE ESTE MÓDULO NO TOMA.
 *
 * El generador del F-PGJ-002 está construido hasta el borde de cada una de
 * ellas y ahí se detiene. No elige por defecto, no adivina, y —sobre todo— no
 * produce un documento que parezca terminado cuando le falta una: un acto
 * administrativo con un número inventado o con el texto de recursos equivocado
 * no es un borrador imperfecto, es un vicio.
 *
 * ── POR QUÉ UN CATÁLOGO Y NO CUATRO `TODO` ────────────────────────────────
 *
 * Un comentario `TODO` no se puede consultar desde una pantalla, no aparece en
 * un informe y no impide que alguien rellene el hueco con lo primero que se le
 * ocurra. Esto es un dato: dice qué falta, quién lo decide y en qué punto del
 * generador se enchufa. El día que lleguen las respuestas, el trabajo es
 * rellenar estos cuatro valores — no buscar dónde iban.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECLARA qué falta y dónde entra. NO decide ninguna de las cuatro, ni
 * ofrece un valor por defecto para ninguna.
 */

/** Quién resuelve cada pendiente. No es lo mismo y no se piden igual. */
export type DecideQuien = 'PLANEACION' | 'JURIDICA' | 'PLANEACION_O_JURIDICA';

export interface DecisionPendiente {
  id: string;
  /** La pregunta, tal como hay que hacerla. */
  pregunta: string;
  decide: DecideQuien;
  /** Qué parte del documento queda en blanco mientras no haya respuesta. */
  bloquea: string;
  /** La evidencia que tenemos hoy, y por qué no basta para decidir sola. */
  evidencia: string;
}

export const DECISIONES_PENDIENTES: readonly DecisionPendiente[] = [
  {
    id: 'SERIE_DEL_ACTO',
    pregunta: '¿El número de la resolución sale de UNA serie de actos, o de una serie por modalidad (LSR, LC, LSU…)? ¿Reinicia cada año?',
    decide: 'PLANEACION',
    bloquea: 'La emisión del número. El generador lo RECIBE; nunca lo pide a un contador.',
    evidencia:
      'La resolución real dice «LSR No. 001 DE 2.025» y el libro de impuestos del ingeniero registra «2025 - 001» solo para LSR. '
      + 'El insumo del 6-ago mostró «LSR 2,022-001», «LSU 2,022-001» y «PH 2,022-001» conviviendo, lo que sugiere serie por modalidad. '
      + 'Pero el ADR-0041 optó por serie ÚNICA para el expediente con un argumento que aquí también aplica, así que no se deduce: se pregunta.',
  },
  {
    id: 'FORMATO_DEL_NUMERO',
    pregunta: '¿El número va «AAAA-NNN» o «NNN-AAAA»? ¿Con el prefijo de modalidad dentro del número o fuera?',
    decide: 'PLANEACION',
    bloquea: 'Cómo se escribe el número en las ocho posiciones del documento donde aparece.',
    evidencia:
      'En el MISMO archivo conviven las dos formas: la pestaña se llama «Licencia Subdivision 024 - 2023» y su celda dice «2025 - 001». '
      + 'El formato no está estabilizado, así que elegirlo nosotros sería fijar por accidente lo que nadie decidió.',
  },
  {
    id: 'TEXTO_RECURSOS',
    pregunta: '¿Contra la resolución proceden reposición Y apelación, o solo reposición?',
    decide: 'JURIDICA',
    bloquea: 'El artículo de recursos y la advertencia del acta de notificación.',
    evidencia:
      'La resolución real dice «proceden los recursos de reposición y apelación». El propietario aclaró el 10-ago-2026 que en Simacota '
      + 'todo queda en la Secretaría de Planeación y el Alcalde no resuelve —solo reposición—, y así lo redacta ya el sistema en el acto de '
      + 'desistimiento. Los dos textos no pueden ser correctos a la vez, y enunciar mal los recursos vicia la notificación.',
  },
  {
    id: 'ORIGEN_VIGENCIA',
    pregunta: '¿Los 12 meses de vigencia corren desde la EXPEDICIÓN o desde la FIRMEZA del acto?',
    decide: 'PLANEACION_O_JURIDICA',
    bloquea: 'La fecha de vencimiento del artículo de términos de ejecución.',
    evidencia:
      'La resolución real dice «doce (12) meses contados a partir de la fecha de expedición» y el libro lo confirma (expedida 02-ene-2025, '
      + 'vence 01-ene-2026). La investigación normativa transcribió que las vigencias del D.1783 art. 27 corren desde la FIRMEZA, y ese '
      + 'mismo acto quedó en firme el 20-ene-2025: dieciocho días de diferencia en una sola licencia.',
  },
];

/**
 * Los valores, cuando existan. `null` significa SIN DECIDIR — nunca «usa el
 * más común». Que sean `null` y no opcionales es deliberado: obliga a cada
 * llamador a construirlos explícitamente y deja el hueco visible en el tipo.
 */
export interface ParametrosDelActo {
  /**
   * El número ya emitido, tal cual debe imprimirse («001 DE 2.025»). Lo
   * RECIBE el generador: mientras la serie y el formato no estén decididos,
   * pedirlo a un contador sería consumir un consecutivo real bajo una regla
   * que nadie aprobó.
   */
  numeroResolucion: string | null;
  /** El texto literal del artículo de recursos. */
  textoRecursos: string | null;
  /** Desde cuándo corren los 12 meses. */
  origenVigencia: 'EXPEDICION' | 'FIRMEZA' | null;
}

/** Ningún parámetro decidido — el estado de hoy, escrito una sola vez. */
export const SIN_DECIDIR: ParametrosDelActo = {
  numeroResolucion: null,
  textoRecursos: null,
  origenVigencia: null,
};

/** Qué decisiones siguen abiertas, dado un juego de parámetros. */
export function decisionesQueFaltan(p: ParametrosDelActo): DecisionPendiente[] {
  const abiertas: string[] = [];
  if (!p.numeroResolucion) abiertas.push('SERIE_DEL_ACTO', 'FORMATO_DEL_NUMERO');
  if (!p.textoRecursos) abiertas.push('TEXTO_RECURSOS');
  if (!p.origenVigencia) abiertas.push('ORIGEN_VIGENCIA');
  return DECISIONES_PENDIENTES.filter((d) => abiertas.includes(d.id));
}
