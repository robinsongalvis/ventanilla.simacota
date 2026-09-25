/**
 * lib/motor-expedientes/acto-lsr/reglas-acto-lsr.ts
 *
 * LAS REGLAS DE NEGOCIO DEL ACTO — lo que no se rellena, se decide.
 *
 * Un campo dinámico se copia del expediente. Una regla produce un resultado a
 * partir de otros datos, y equivocarla cambia el fondo del acto. Están juntas
 * aquí, puras y probables, para que se puedan leer sin abrir el generador.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECIDE: qué Unidad Agrícola Familiar aplica a un predio, si los lotes
 * la cumplen, cuántos S.M.D.L.V. se cobran, y la vigencia de la licencia.
 *
 * Esto NO DECIDE: desde cuándo corre esa vigencia (decisión pendiente
 * `ORIGEN_VIGENCIA`), ni qué vereda pertenece a qué zona — el reparto real es
 * un dato de Planeación y aquí está DECLARADO VACÍO a propósito.
 */
import { sumarMeses } from './calendario-acto';

/* ── LA UNIDAD AGRÍCOLA FAMILIAR ──────────────────────────────────────────

   Es el corazón jurídico de toda licencia de subdivisión rural. El art. 44 de
   la Ley 160/1994 prohíbe fraccionar por debajo de la UAF «so pena de nulidad
   absoluta»; el art. 45 literal C abre la excepción, y es la que el acto real
   invoca. De elegir bien la zona depende que la resolución esté motivada o sea
   nula.

   La Resolución INCORA 041/1996 art. 23 —citada literal en el acto— pone al
   municipio de Simacota en DOS zonas a la vez, según la altura y la parte del
   territorio. Por eso no basta con saber que el predio es de Simacota. */

export type ZonaUaf = 'MAGDALENA_MEDIO' | 'GUANENTA';

export interface RangoUaf {
  zona: ZonaUaf;
  /** Hectáreas, extremo inferior y superior del rango de la Resolución 041/1996. */
  desdeHas: number;
  hastaHas: number;
  /** La cita, para imprimirla en el acto sin reescribirla. */
  descripcion: string;
}

export const RANGOS_UAF: Readonly<Record<ZonaUaf, RangoUaf>> = {
  MAGDALENA_MEDIO: {
    zona: 'MAGDALENA_MEDIO',
    desdeHas: 50,
    hastaHas: 68,
    descripcion: 'Zona relativamente homogénea No. 1 Magdalena Medio — Simacota: las áreas con altura inferior a 1.000 m.s.n.m.',
  },
  GUANENTA: {
    zona: 'GUANENTA',
    desdeHas: 8,
    hastaHas: 10,
    descripcion: 'Zona relativamente homogénea No. 4 Provincia de Guanentá — Alto Simacota.',
  },
};

/**
 * LA ZONA NO SE DEDUCE: SE DETERMINA, Y PARA ESTE PREDIO.
 *
 * ── EL ERROR QUE ESTO CORRIGE (14-sep-2026) ───────────────────────────────
 *
 * La primera versión de este módulo traía un mapa `ZONA_UAF_POR_VEREDA`, y con
 * él una pregunta para Planeación: «¿qué veredas están bajo los 1.000 m.s.n.m.?».
 * El propietario la rechazó, y al releer el texto que la propia resolución cita
 * quedó claro por qué:
 *
 *   «Bolívar, Simacota, Río negro y Landázuri: LAS ÁREAS con altura inferior a
 *    1.000 m.s.n.m.»
 *
 * **Áreas**, no veredas. La frontera es una curva de nivel, y una misma vereda
 * puede quedar partida por ella. No existe una tabla municipal que reparta
 * veredas por zona porque la unidad no es la vereda: es el predio, con su
 * altura, y eso sale del levantamiento topográfico o del mapa del EOT — no de
 * una decisión administrativa que alguien pueda dictar en una reunión.
 *
 * El ejemplo que el propio módulo citaba lo estaba diciendo: el predio de una
 * vereda llamada «Alta» va por Magdalena Medio. No es que el nombre engañe; es
 * que la vereda no era la unidad.
 *
 * ── POR QUÉ LA FUENTE ES OBLIGATORIA ──────────────────────────────────────
 *
 * De esta zona depende que la subdivisión sea válida o nula (art. 44 de la Ley
 * 160: «so pena de nulidad absoluta»). Un expediente que afirme la zona sin
 * decir de dónde la sacó no puede defender su propia motivación. Por eso
 * `fuente` no es opcional: el dato viaja con su respaldo o no viaja.
 */
export interface DeterminacionUaf {
  zona: ZonaUaf;
  /**
   * De dónde salió la altura del predio: «Levantamiento topográfico del
   * 12-ago-2026», «Cartografía del EOT», «Concepto técnico N.º …». Texto libre
   * mientras Planeación no normalice de dónde debe salir — normalizarlo antes
   * sería fijar una fuente que nadie ha declarado.
   */
  fuente: string;
}

/** El rango que aplica a este predio, o `null` si no se ha determinado. */
export function uafDeterminada(determinacion: DeterminacionUaf | null | undefined): RangoUaf | null {
  if (!determinacion || !determinacion.fuente?.trim()) return null;
  return RANGOS_UAF[determinacion.zona] ?? null;
}

/* ── LAS EXPENSAS ─────────────────────────────────────────────────────────
   Acuerdo Municipal 026 del 21-dic-2020, art. 194, ítem 10: «la Licencia de
   subdivisión para segregaciones rurales: la tarifa será fijada por la cantidad
   de lotes a segregar a razón de cinco (5) S.M.D.L.V.».

   Se calcula, no se transcribe: en el acto real el número va escrito a mano y
   nada lo contrasta contra la cantidad de lotes del cuadro de áreas. */

export const SMDLV_POR_LOTE_LSR = 5;

export function smdlvDeLaLicencia(cantidadLotes: number): number {
  return Math.max(0, Math.trunc(cantidadLotes)) * SMDLV_POR_LOTE_LSR;
}

/* ── LA VIGENCIA ──────────────────────────────────────────────────────────
   D.1783/2021 art. 27: subdivisión = 12 meses IMPRORROGABLES (par. 4, sin
   prórroga ni revalidación). El valor está verificado contra la norma y contra
   el acto real, que dice «doce (12) meses».

   DESDE CUÁNDO corren es otra cosa, y es la decisión pendiente
   `ORIGEN_VIGENCIA`: el acto real cuenta desde la EXPEDICIÓN y la norma dice
   desde la FIRMEZA. Por eso esta función EXIGE que le digan el ancla; no tiene
   valor por defecto. */

export const MESES_VIGENCIA_LSR = 12;
export const LSR_ES_IMPRORROGABLE = true;

export function vencimientoDeLaLicencia(anclaIso: string): string {
  /* Un año menos un día: el acto real expide el 02-ene-2025 y vence el
     01-ene-2026. Se replica ese criterio porque es el que Planeación viene
     aplicando; si al decidir `ORIGEN_VIGENCIA` se aclara otro, se cambia aquí. */
  const fin = sumarMeses(anclaIso, MESES_VIGENCIA_LSR);
  fin.setDate(fin.getDate() - 1);
  return fin.toISOString();
}

/* ── ¿CUMPLE LA UAF? ──────────────────────────────────────────────────────
   Si algún lote queda por debajo del extremo INFERIOR del rango, la
   subdivisión no cumple la UAF y el acto debe invocar la excepción del art. 45
   literal C, con el destino productivo de cada lote. Es exactamente lo que hace
   la resolución real.

   Se compara contra el extremo inferior y no contra el superior: por debajo del
   mínimo es donde la ley pone la nulidad. */

export function requiereExcepcionUaf(areasLotesHas: number[], uaf: RangoUaf): boolean {
  return areasLotesHas.some((a) => a < uaf.desdeHas);
}
