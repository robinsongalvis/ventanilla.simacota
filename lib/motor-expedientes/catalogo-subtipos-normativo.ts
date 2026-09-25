/**
 * Catálogo normativo de figuras de trámite — DF-4, ADR-0029.
 *
 * PURO, sin I/O. Dato: las figuras que el Decreto 1077/2015 (compilado,
 * reformado por D.1203/2017 y D.1783/2021) y normas conexas regulan como
 * licencias urbanísticas, actos de reconocimiento u "otras actuaciones" —
 * congeladas por el ADR-0029 porque están CONFIRMADAS POR NORMA (investigación
 * `docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md`, pregunta P1), NO por
 * inferencia sobre datos locales. Este catálogo es DATO de una futura
 * `DefinicionTramite.subtipos` (D4, `./tipos.ts`), no un enum en código.
 *
 * DELIBERADAMENTE fuera de este catálogo (mismo eje, NO expandido con 9
 * códigos más): las 9 MODALIDADES de construcción (art. 2.2.6.1.1.7) — ver
 * `MODALIDADES_CONSTRUCCION` más abajo. Una modalidad (p. ej. "ampliación")
 * es un atributo DENTRO de la figura `CONSTRUCCION`, no una figura distinta
 * — combinar ambos ejes en un solo catálogo perdería esa relación (una
 * solicitud puede combinar VARIAS modalidades dentro de una misma licencia
 * de construcción, art. 2.2.6.1.1.7 par. 1).
 */

import type { EquivalenciaMigracion } from './equivalencia-migracion';

export type TipoFigura = 'LICENCIA' | 'ACTO_RECONOCIMIENTO' | 'OTRA_ACTUACION';

export interface FiguraTramiteNormativa {
  /** Código estable, SCREAMING_SNAKE_CASE — usado como `SubtipoTramite.codigo` cuando se instancie la Definición. */
  codigo: string;
  nombre: string;
  tipoFigura: TipoFigura;
  /** Agrupa modalidades de una misma clase normativa (p. ej. las 3 de subdivisión) — opcional, solo donde el decreto agrupa explícitamente. */
  claseDe?: string;
  /** Cita normativa exacta (artículo del decreto/ley compilado o vigente). */
  fundamento: string;
}

/**
 * Las 5 clases de licencia (art. 2.2.6.1.1.2) + el acto de reconocimiento
 * (Ley 1848/2017, NO es licencia) + la aprobación de planos PH ("otra
 * actuación", NO es licencia) — 9 figuras en total, `tipoFigura` distingue
 * las 3 familias jurídicas.
 *
 * Nota deliberada (P1 del anexo): el registro local de Simacota NO usa
 * PARCELACION ni ESPACIO_PUBLICO — se incluyen aquí de todas formas porque
 * el catálogo es NORMATIVO NACIONAL, no un recorte por uso histórico local
 * (D9: "ninguna Secretaría debe requerir modificaciones del núcleo").
 */
export const CATALOGO_FIGURAS_NORMATIVAS: readonly FiguraTramiteNormativa[] = [
  {
    codigo: 'URBANIZACION',
    nombre: 'Licencia de urbanización',
    tipoFigura: 'LICENCIA',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.2 (clases de licencia); art. 2.2.6.1.1.4 (D.1783/2021 art. 7) — figura de suelo urbano.',
  },
  {
    codigo: 'PARCELACION',
    nombre: 'Licencia de parcelación',
    tipoFigura: 'LICENCIA',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.2 (clases de licencia); art. 2.2.6.1.1.5.',
  },
  {
    codigo: 'SUBDIVISION_RURAL',
    nombre: 'Licencia de subdivisión — modalidad rural',
    tipoFigura: 'LICENCIA',
    claseDe: 'SUBDIVISION',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.6 (D.1783/2021 art. 9); no autoriza obras (par. 1).',
  },
  {
    codigo: 'SUBDIVISION_URBANA',
    nombre: 'Licencia de subdivisión — modalidad urbana',
    tipoFigura: 'LICENCIA',
    claseDe: 'SUBDIVISION',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.6 (D.1783/2021 art. 9); no autoriza obras (par. 1).',
  },
  {
    codigo: 'RELOTEO',
    nombre: 'Licencia de subdivisión — modalidad reloteo',
    tipoFigura: 'LICENCIA',
    claseDe: 'SUBDIVISION',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.6 (D.1783/2021 art. 9); no autoriza obras (par. 1).',
  },
  {
    codigo: 'CONSTRUCCION',
    nombre: 'Licencia de construcción',
    tipoFigura: 'LICENCIA',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.7 (D.1203/2017 + D.1783/2021 art. 10); 9 modalidades — ver MODALIDADES_CONSTRUCCION.',
  },
  {
    codigo: 'ESPACIO_PUBLICO',
    nombre: 'Licencia de intervención y ocupación del espacio público',
    tipoFigura: 'LICENCIA',
    fundamento: 'D.1077/2015 art. 2.2.6.1.1.2 (clases de licencia).',
  },
  {
    codigo: 'RECONOCIMIENTO',
    nombre: 'Acto de reconocimiento de edificaciones',
    tipoFigura: 'ACTO_RECONOCIMIENTO',
    fundamento: 'Ley 1848/2017 art. 6; D.1077/2015 Tít. 6 Cap. 4 (D.1333/2020) — NO es licencia; procedimiento de licencias aplicable, 45 días hábiles, SIN silencio administrativo positivo (art. 2.2.6.4.2.4 par.).',
  },
  {
    codigo: 'APROBACION_PH',
    nombre: 'Aprobación de planos de propiedad horizontal',
    tipoFigura: 'OTRA_ACTUACION',
    fundamento: 'D.1077/2015 art. 2.2.6.1.3.1 num. 5; Ley 675/2001 arts. 4-7 — "otra actuación", NO es licencia; 15 días hábiles si va sola; la licencia la CONLLEVA cuando va junta (art. 2.2.6.1.2.1.1 par. 2).',
  },
];

/**
 * Las 9 modalidades de construcción (art. 2.2.6.1.1.7, D.1203/2017 +
 * D.1783/2021 art. 10) — eje DISTINTO de `CATALOGO_FIGURAS_NORMATIVAS`
 * (ver JSDoc de cabecera). Lista aparte, NO expande el catálogo de figuras.
 *
 * SUPUESTO DECLARADO (Principio 13): la investigación normativa
 * (`INVESTIGACION_NORMATIVA_LICENCIAS.md`, P1) confirmó el NÚMERO (9) y la
 * POSICIÓN de demolición (num. 7, "demolición nunca sola") por cita
 * textual, pero no transcribió los 9 nombres completos del artículo. Los
 * nombres de abajo provienen de conocimiento general del Decreto 1077/2015
 * art. 2.2.6.1.1.7 (orden estándar: obra nueva, ampliación, adecuación,
 * modificación, restauración, reforzamiento estructural, demolición,
 * cerramiento, reconstrucción) — consistentes con el único dato verificado
 * del anexo (posición 7 = demolición). NO se trata como fuente primaria
 * verificada: cotejar contra el texto oficial del artículo (SUIN-Juriscol
 * estuvo inaccesible durante la investigación) antes de usar esta lista
 * para cualquier decisión que dependa de su exactitud textual.
 */
export const MODALIDADES_CONSTRUCCION: readonly { codigo: string; nombre: string; numeral: number }[] = [
  { codigo: 'obra-nueva', nombre: 'Obra nueva', numeral: 1 },
  { codigo: 'ampliacion', nombre: 'Ampliación', numeral: 2 },
  { codigo: 'adecuacion', nombre: 'Adecuación', numeral: 3 },
  { codigo: 'modificacion', nombre: 'Modificación', numeral: 4 },
  { codigo: 'restauracion', nombre: 'Restauración', numeral: 5 },
  { codigo: 'reforzamiento-estructural', nombre: 'Reforzamiento estructural', numeral: 6 },
  { codigo: 'demolicion', nombre: 'Demolición', numeral: 7 }, // única modalidad verificada por número explícito en el anexo ("nunca sola, num. 7")
  { codigo: 'cerramiento', nombre: 'Cerramiento', numeral: 8 },
  { codigo: 'reconstruccion', nombre: 'Reconstrucción', numeral: 9 },
];

/** Fundamento normativo del art. 2.2.6.1.1.7 (D.1203/2017 + D.1783/2021 art. 10), reutilizado por las filas de equivalencia que combinan modalidades. */
const FUNDAMENTO_CONSTRUCCION = 'D.1077/2015 art. 2.2.6.1.1.7 (D.1203/2017 + D.1783/2021 art. 10).';
const FUNDAMENTO_SUBDIVISION_RURAL = 'D.1077/2015 art. 2.2.6.1.1.6 (D.1783/2021 art. 9).';
const FUNDAMENTO_SUBDIVISION_URBANA = FUNDAMENTO_SUBDIVISION_RURAL;
const FUNDAMENTO_URBANIZACION = 'D.1077/2015 art. 2.2.6.1.1.4 (D.1783/2021 art. 7).';
const FUNDAMENTO_RECONOCIMIENTO = 'Ley 1848/2017 art. 6; D.1077/2015 Tít. 6 Cap. 4.';
const FUNDAMENTO_PH = 'D.1077/2015 art. 2.2.6.1.3.1 num. 5; Ley 675/2001 arts. 4-7.';
const FUNDAMENTO_LICENCIA_CONLLEVA_PH = 'D.1077/2015 art. 2.2.6.1.2.1.1 par. 2 (la licencia conlleva la aprobación PH cuando va junta).';
const FUNDAMENTO_RECONOCIMIENTO_CONSTRUCCION_CONJUNTO = 'D.1077/2015 art. 2.2.6.4.2.5 par. 2 (reconocimiento + construcción resueltos conjuntamente).';
const FUNDAMENTO_OTRAS_ACTUACIONES_CONJUNTAS = 'D.1077/2015 art. 2.2.6.1.3.1 par. 2 ("otras actuaciones" conjuntas resueltas en el término de la licencia).';

/**
 * Semilla de `EquivalenciaMigracion` (`./equivalencia-migracion.ts`) para
 * los códigos históricos observados en el consecutivo real de Planeación
 * (`docs/planes/ANALISIS_INSUMO_CONSECUTIVO_LICENCIAS.md`, hallazgo H8) —
 * simples y combinados.
 *
 * `LA`, `LCR VISR`, `LRC` → `estado: 'CUARENTENA'`, `codigos: []`: su
 * significado local NO está confirmado por norma (el anexo los marca con
 * certeza BAJA / "¿ampliación?", "¿reconocimiento VIS rural?", "¿variante
 * de LR/LCR?" — puras conjeturas, nunca una fuente verificada) — quedan
 * PENDIENTES del ingeniero (P1′, ADR-0029 huecos). JAMÁS se mapean aquí,
 * ni siquiera con la conjetura del anexo: adivinar sería exactamente lo
 * que este mecanismo existe para evitar.
 *
 * Combos que involucran `LA` (`LA, PH`) heredan la cuarentena de `LA`: no
 * se puede resolver un combinado cuando uno de sus componentes es
 * desconocido.
 */
export const EQUIVALENCIAS_MIGRACION_SEMILLA_LICENCIAS = [
  // ── Simples, MAPEADAS por norma ──────────────────────────────────────
  { textoHistorico: 'LC', codigos: ['CONSTRUCCION'], estado: 'MAPEADO', fundamento: FUNDAMENTO_CONSTRUCCION },
  { textoHistorico: 'LSR', codigos: ['SUBDIVISION_RURAL'], estado: 'MAPEADO', fundamento: FUNDAMENTO_SUBDIVISION_RURAL },
  { textoHistorico: 'LSU', codigos: ['SUBDIVISION_URBANA'], estado: 'MAPEADO', fundamento: FUNDAMENTO_SUBDIVISION_URBANA },
  { textoHistorico: 'LU', codigos: ['URBANIZACION'], estado: 'MAPEADO', fundamento: FUNDAMENTO_URBANIZACION },
  { textoHistorico: 'LR', codigos: ['RECONOCIMIENTO'], estado: 'MAPEADO', fundamento: FUNDAMENTO_RECONOCIMIENTO },
  { textoHistorico: 'PH', codigos: ['APROBACION_PH'], estado: 'MAPEADO', fundamento: FUNDAMENTO_PH },

  // ── Combinados evidentes (composición de códigos ya mapeados) ───────
  // 'LC, A' (H8, ×3): construcción en modalidad ampliación — "A" es
  // MODALIDAD (eje aparte, ver MODALIDADES_CONSTRUCCION), no otra figura.
  { textoHistorico: 'LC, A', codigos: ['CONSTRUCCION'], estado: 'MAPEADO', fundamento: `${FUNDAMENTO_CONSTRUCCION} "A" = modalidad ampliación (par. 1: varias modalidades por solicitud), no una figura distinta.` },
  // 'LC y PH' (H8, ×2): la licencia de construcción conlleva la PH.
  { textoHistorico: 'LC y PH', codigos: ['CONSTRUCCION', 'APROBACION_PH'], estado: 'MAPEADO', fundamento: FUNDAMENTO_LICENCIA_CONLLEVA_PH },
  // 'LC, PH y LSU' (H8, ×1): construcción + PH + subdivisión urbana.
  { textoHistorico: 'LC, PH y LSU', codigos: ['CONSTRUCCION', 'APROBACION_PH', 'SUBDIVISION_URBANA'], estado: 'MAPEADO', fundamento: `${FUNDAMENTO_LICENCIA_CONLLEVA_PH} Combinado con subdivisión urbana por composición evidente (par. 1: varias clases por solicitud).` },
  // 'LR, PH' (H8, ×1): reconocimiento + aprobación PH.
  { textoHistorico: 'LR, PH', codigos: ['RECONOCIMIENTO', 'APROBACION_PH'], estado: 'MAPEADO', fundamento: FUNDAMENTO_OTRAS_ACTUACIONES_CONJUNTAS },
  // 'LR y LC,A' (H8, ×2, variantes de espaciado — solo se sembró la forma
  // exacta citada por el anexo; otras variantes de espaciado observadas en
  // el Excel de origen y no transcritas en el anexo se añaden cuando se
  // confirmen, no se adivinan): reconocimiento + construcción (ampliación).
  { textoHistorico: 'LR y LC,A', codigos: ['RECONOCIMIENTO', 'CONSTRUCCION'], estado: 'MAPEADO', fundamento: FUNDAMENTO_RECONOCIMIENTO_CONSTRUCCION_CONJUNTO },

  // ── Resueltas por el ingeniero (P1′ parcial, 10-ago-2026) ────────────
  // Respuesta del ingeniero de Planeación relatada por el propietario
  // (10-ago-2026): "LA = Licencia de Ampliación". Con eso deja de ser
  // conjetura: ampliación es MODALIDAD de la licencia de construcción
  // (mismo tratamiento que 'LC, A', ya sembrado), no una figura aparte.
  { textoHistorico: 'LA', codigos: ['CONSTRUCCION'], estado: 'MAPEADO', fundamento: `${FUNDAMENTO_CONSTRUCCION} "LA" = modalidad ampliación — respuesta del ingeniero de Planeación (10-ago-2026, relatada por el propietario).` },
  // Combinado desbloqueado por la misma respuesta: LA (construcción,
  // modalidad ampliación) + PH (aprobación de planos PH).
  { textoHistorico: 'LA, PH', codigos: ['CONSTRUCCION', 'APROBACION_PH'], estado: 'MAPEADO', fundamento: `${FUNDAMENTO_LICENCIA_CONLLEVA_PH} "LA" = modalidad ampliación (respuesta del ingeniero, 10-ago-2026, relatada por el propietario).` },

  // ── Cuarentena: JAMÁS mapear (P1′ restante) ──────────────────────────
  { textoHistorico: 'LCR VISR', codigos: [], estado: 'CUARENTENA', nota: 'Significado local pendiente del ingeniero (P1′). No existe como figura normativa (capítulo de reconocimiento leído completo); el anexo conjetura "¿reconocimiento VIS rural?" con certeza BAJA. NO está en la respuesta del ingeniero del 10-ago-2026.' },
  { textoHistorico: 'LRC', codigos: [], estado: 'CUARENTENA', nota: 'Significado local pendiente del ingeniero (P1′). El anexo conjetura "¿variante de LR/LCR?" con certeza BAJA. NO está en la respuesta del ingeniero del 10-ago-2026.' },
] as const satisfies readonly EquivalenciaMigracion[];
