/**
 * lib/motor-expedientes/acto-construccion/reglas-acto-construccion.ts
 *
 * CAPA 3 — REGLAS. Únicamente lo que YA está respaldado por el repositorio.
 * Nada de esto es del formato pendiente: son reglas de negocio con fuente
 * normativa transcrita y verificada, que se REUTILIZAN, no se reescriben.
 *
 * ── LO QUE SÍ HAY, Y DE DÓNDE VIENE ───────────────────────────────────────
 *
 *  · VIGENCIA — `../vigencias.ts` (régimen D.1783/2021, ACTIVADO 10-ago-2026).
 *    Obra nueva: 36 meses + prórroga única 12 + revalidación. Otras
 *    modalidades: 24 meses + prórroga única 12. **Desde la FIRMEZA**
 *    (art. 2.2.6.1.2.4.1) — y esto, a diferencia de subdivisión, NO es una
 *    decisión pendiente: la norma lo fija y el módulo ya lo ejecuta.
 *  · TÉRMINO del trámite — 45 días hábiles (art. 2.2.6.1.2.3.1 inc. 1).
 *  · SUBSANACIÓN — 30 días hábiles + 15 de prórroga (art. 2.2.6.1.2.2.4).
 *
 *   El término y la subsanación se LEEN de la Definición sembrada, no se
 *   reescriben: un valor en dos sitios es lo que produjo la divergencia de
 *   quince días que documenta `project_bloque_terminos_vigencias`.
 *
 * ── LO QUE NO HAY, Y POR QUÉ NO SE INVENTA ────────────────────────────────
 *
 *  · EXPENSAS. La tarifa de subdivisión está transcrita (Acuerdo 026 art. 194
 *    ítem 10, cinco S.M.D.L.V. por lote); la de CONSTRUCCIÓN no está en el
 *    repositorio. Sin tarifa no hay cálculo, y ponerle uno «parecido» sería
 *    inventar la liquidación de un acto administrativo. Queda `null` y viaja
 *    como pendiente (`./decisiones-pendientes-construccion.ts`).
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECIDE: la vigencia de la licencia (reutilizando `../vigencias.ts`), y
 * expone término y subsanación (leídos de la Definición). Esto NO DECIDE: la
 * tarifa de expensas (no está en el repositorio), ni desde cuándo corre la
 * vigencia (la norma ya lo fijó en la firmeza — no hay nada que decidir), ni
 * cómo desambiguar una combinación de modalidades (la norma no da criterio).
 */

import {
  calcularVencimientoVigencia,
  esErrorVigencia,
  type ErrorVigencia,
  type ReglaVigencia,
} from '../vigencias';
import { DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL } from '../definiciones/licencia-construccion-parcial';

export const FIGURA_CONSTRUCCION = 'CONSTRUCCION';

/* ── TÉRMINO Y SUBSANACIÓN — leídos de la Definición, fuente única ─────────
   Son valores de FIGURA (no de modalidad): el término de 45 días hábiles y el
   régimen de subsanación aplican a toda licencia de construcción. La Definición
   de obra nueva es hoy su único portador sembrado; se leen de ahí para no
   tener el número escrito dos veces. */

export const TERMINO_CONSTRUCCION = DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.terminos;
export const SUBSANACION_CONSTRUCCION = {
  dias: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.regimenSubsanacion.dias,
  unidad: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.regimenSubsanacion.unidad,
  prorrogaDias: DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL.regimenSubsanacion.prorrogaDias,
};

/* ── EXPENSAS — declaradas AUSENTES, a propósito ──────────────────────────── */

/** No hay tarifa de expensas de construcción en el repositorio. `null`, no un valor plausible. */
export const TARIFA_EXPENSAS_CONSTRUCCION = null;

/* ── VIGENCIA — reutiliza `../vigencias.ts`, no reimplementa nada ─────────── */

export type ResultadoVigenciaConstruccion =
  | { estado: 'CALCULADA'; vencimientoIso: string; meses: number; regla: ReglaVigencia }
  | { estado: 'FALTA_FIRMEZA' }
  | { estado: 'FALTA_MODALIDAD' }
  | { estado: 'COMBINACION_SIN_DESAMBIGUAR'; modalidades: string[] }
  | { estado: 'ERROR_REGLA'; error: ErrorVigencia };

/**
 * La vigencia de la licencia de construcción, a partir de la firmeza y de la(s)
 * modalidad(es). Orquesta `calcularVencimientoVigencia`; no reimplementa la
 * aritmética ni las reglas.
 *
 * Sobre las COMBINACIONES: `../vigencias.ts` recibe UNA modalidad. Cuando el
 * expediente trae varias (art. 2.2.6.1.1.7 par. 1 lo permite), elegir una para
 * calcular la vigencia sería una decisión de negocio que la norma no resuelve
 * mecánicamente —el mismo hueco que `seleccionarReglaVigencia` ya declara para
 * las figuras combinadas—. Aquí se devuelve `COMBINACION_SIN_DESAMBIGUAR` en
 * vez de escoger a escondidas.
 */
export function vigenciaDeLaConstruccion(
  fechaFirmeza: string | null,
  modalidades: readonly string[],
): ResultadoVigenciaConstruccion {
  if (!fechaFirmeza) return { estado: 'FALTA_FIRMEZA' };
  if (modalidades.length === 0) return { estado: 'FALTA_MODALIDAD' };
  if (modalidades.length > 1) return { estado: 'COMBINACION_SIN_DESAMBIGUAR', modalidades: [...modalidades] };

  const resultado = calcularVencimientoVigencia({
    fechaFirmeza,
    subtipos: [FIGURA_CONSTRUCCION],
    modalidadConstruccion: modalidades[0],
  });
  if (esErrorVigencia(resultado)) return { estado: 'ERROR_REGLA', error: resultado };

  return {
    estado: 'CALCULADA',
    vencimientoIso: resultado.vencimiento.toISOString(),
    meses: resultado.configAplicada.meses,
    regla: resultado.configAplicada,
  };
}
