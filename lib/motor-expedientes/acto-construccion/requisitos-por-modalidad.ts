/**
 * lib/motor-expedientes/acto-construccion/requisitos-por-modalidad.ts
 *
 * LAS NUEVE MODALIDADES, UNA POR UNA — qué sabemos y qué NO de cada una.
 *
 * El art. 2.2.6.1.1.7 lista nueve modalidades de licencia de construcción, y
 * NO comparten requisitos: obra nueva parte de cero y los pide todos; una
 * demolición no necesita proyecto arquitectónico de lo que va a desaparecer;
 * un cerramiento no mueve estructura. Tratarlas como si el checklist de obra
 * nueva sirviera para todas fue exactamente el defecto que
 * `__tests__/checklist-ciego-a-la-modalidad.test.ts` dejó documentado.
 *
 * Este archivo es la matriz que faltaba: para cada modalidad dice si tenemos su
 * lista de requisitos verificada y si su propio nombre está confirmado contra
 * el texto oficial. No inventa requisitos —cuando no los tenemos, lo dice—; es
 * el inventario honesto del que depende poder generar la resolución correcta de
 * cada una.
 *
 * ── DE DÓNDE SALE CADA VEREDICTO ──────────────────────────────────────────
 *
 *  · `requisitos`: solo OBRA NUEVA tiene definición sembrada y verificada
 *    contra el formato oficial (F-PGD-009 v02, 19 requisitos —
 *    `../definiciones/licencia-construccion-parcial.ts`). Las otras ocho NO
 *    tienen formato aportado, así que quedan en `PENDIENTE_PLANEACION`.
 *  · `nombreVerificado`: la investigación normativa
 *    (`../catalogo-subtipos-normativo.ts`, JSDoc de `MODALIDADES_CONSTRUCCION`)
 *    solo confirmó por cita textual la POSICIÓN de demolición (numeral 7). Los
 *    demás nombres provienen del orden estándar del decreto y NO se han
 *    cotejado contra el texto oficial — quedan `false` hasta el cotejo.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECLARA el estado de cada modalidad. NO define requisitos que no
 * tengamos, NO evalúa completitud (eso es del motor con la definición
 * correspondiente) y NO decide qué requisitos lleva cada modalidad pendiente.
 */

import { MODALIDADES_CONSTRUCCION } from '../catalogo-subtipos-normativo';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '../definiciones/licencia-construccion-parcial';

export type EstadoRequisitos =
  /** Tenemos la lista completa, verificada contra el formato oficial. */
  | 'VERIFICADO'
  /** No hay formato aportado para esta modalidad; los requisitos los debe entregar Planeación. */
  | 'PENDIENTE_PLANEACION';

export interface EstadoModalidad {
  codigo: string;
  nombre: string;
  numeral: number;
  requisitos: EstadoRequisitos;
  /** `id` de la Definición sembrada, si existe. */
  definicionId: string | null;
  /** ¿El NOMBRE de la modalidad está confirmado contra el texto oficial del artículo? */
  nombreVerificado: boolean;
  /** Qué falta para poder generar la resolución de esta modalidad, en una línea. */
  nota: string;
}

/**
 * La única modalidad con requisitos verificados hoy. Se deriva del `id` de la
 * definición sembrada, no se escribe a mano: si la definición cambiara de
 * modalidad, esto deja de mentir.
 */
const MODALIDAD_CON_DEFINICION = 'obra-nueva';
const ID_DEFINICION_OBRA_NUEVA = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.id;

/** Las modalidades cuyo nombre confirmó la investigación por cita textual. */
const NOMBRES_VERIFICADOS = new Set<string>(['demolicion']);

export const ESTADO_REQUISITOS_POR_MODALIDAD: readonly EstadoModalidad[] =
  MODALIDADES_CONSTRUCCION.map((m) => {
    const tieneDefinicion = m.codigo === MODALIDAD_CON_DEFINICION;
    return {
      codigo: m.codigo,
      nombre: m.nombre,
      numeral: m.numeral,
      requisitos: tieneDefinicion ? 'VERIFICADO' : 'PENDIENTE_PLANEACION',
      definicionId: tieneDefinicion ? ID_DEFINICION_OBRA_NUEVA : null,
      nombreVerificado: NOMBRES_VERIFICADOS.has(m.codigo),
      nota: tieneDefinicion
        ? 'Requisitos completos y verificados (F-PGD-009 v02, 19 requisitos).'
        : `Sin formato de requisitos aportado. ${NOMBRES_VERIFICADOS.has(m.codigo)
            ? 'El nombre sí está confirmado por norma.'
            : 'Además, el nombre no se ha cotejado contra el texto oficial del art. 2.2.6.1.1.7.'}`,
    };
  });

/** El estado de una modalidad por su código, o `null` si no está en el catálogo. */
export function estadoDeModalidad(codigo: string): EstadoModalidad | null {
  return ESTADO_REQUISITOS_POR_MODALIDAD.find((e) => e.codigo === codigo) ?? null;
}

/**
 * ¿Podemos evaluar los requisitos de TODAS las modalidades de esta solicitud?
 * `false` si alguna no tiene definición — no para bloquear por bloquear, sino
 * para que quien intente generar sepa que evaluaría contra una lista que no
 * tiene.
 */
export function requisitosDisponiblesPara(modalidades: readonly string[]): boolean {
  if (modalidades.length === 0) return false;
  return modalidades.every((c) => estadoDeModalidad(c)?.requisitos === 'VERIFICADO');
}
