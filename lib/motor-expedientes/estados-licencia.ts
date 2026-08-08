/**
 * Esqueleto de estados JURÍDICOS del ciclo de licencias — DF-5, ADR-0029.
 *
 * PURO, sin I/O. Modela los HITOS que el Decreto 1077/2015 (compilado,
 * D.1203/2017 + D.1783/2021) exige para el procedimiento de licencias —
 * verificados por norma en `docs/planes/INVESTIGACION_NORMATIVA_LICENCIAS.md`
 * (P4). Es un esqueleto JURÍDICO, NO el mapeo de estados OPERATIVOS del
 * panel (`REVISADO`, `TERMINADO` y la cohorte 2022-2024 del Excel de
 * Planeación no tienen correlato normativo directo — P4′, ADR-0029, PENDIENTE
 * del ingeniero). Un estado operativo futuro se mapeará A estos hitos, no
 * al revés.
 *
 * DELIBERADAMENTE NO vive aquí: el EFECTO del acta de observaciones sobre
 * el término (⚖️ hueco 1 del ADR-0029 — `PoliticaTermino` dual en
 * `./termino.ts` sigue sin default). Este módulo solo modela QUÉ estados
 * jurídicos existen y CUÁNDO se puede pasar de uno a otro — no CUÁNTOS
 * días hábiles cuesta cada tránsito.
 *
 * También incluye `validarCierreExpediente` (DF-6): comparte módulo con
 * los estados porque "cerrar" un expediente ES, jurídicamente, alcanzar
 * `EN_FIRME` — la validación de qué datos exige ese cierre pertenece al
 * mismo concepto que las transiciones que llevan hasta ahí.
 */

import type { Expediente } from './tipos';

export type EstadoJuridicoLicencia =
  | 'RADICADA_EN_DEBIDA_FORMA'
  | 'EN_REVISION'
  | 'CON_ACTA_DE_OBSERVACIONES'
  | 'EN_VIABILIDAD'
  | 'CONCEDIDA'
  | 'NEGADA'
  | 'DESISTIDA'
  | 'NOTIFICADA'
  | 'EN_FIRME';

export interface OpcionesTransicionLicencia {
  /**
   * `true` si esta solicitud YA tuvo una acta de observaciones antes. El
   * acta procede "por una sola vez" (art. 2.2.6.1.2.2.4) — con este guard
   * en `EN_REVISION → CON_ACTA_DE_OBSERVACIONES` en vez de un estado
   * "CON_ACTA_2" o similar: el motor no necesita un estado nuevo por cada
   * invariante de cardinalidad, solo un parámetro que el caller (que sí
   * sabe cuántas actas hubo, vía la trazabilidad real del expediente) debe
   * proveer honestamente.
   */
  yaHuboActa?: boolean;
}

interface TransicionPermitida {
  hacia: EstadoJuridicoLicencia;
  /** Cita normativa exacta que sustenta este tránsito. */
  fundamento: string;
  /** `true` si esta transición exige `!opciones.yaHuboActa` para proceder. */
  requiereNoHuboActaPrevia?: boolean;
}

/**
 * Mapa de transiciones permitidas, con su fundamento normativo:
 *
 * - `RADICADA_EN_DEBIDA_FORMA → EN_REVISION`: la radicación en legal y
 *   debida forma es el ancla del término y del expediente (art.
 *   2.2.6.1.2.1.1 par. 1); sin ella el término NO corre (art.
 *   2.2.6.1.2.2.3 inc. 2) — de ahí entra a revisión (citación/valla,
 *   art. 2.2.6.1.2.2.1-2).
 * - `EN_REVISION → CON_ACTA_DE_OBSERVACIONES`: acta de observaciones, POR
 *   UNA SOLA VEZ (art. 2.2.6.1.2.2.4, redacción D.1783/2021 art. 19) —
 *   guardada con `requiereNoHuboActaPrevia` (ver `OpcionesTransicionLicencia`).
 * - `EN_REVISION → EN_VIABILIDAD`: si no requiere acta, pasa directo al
 *   acto de viabilidad (art. 2.2.6.1.2.3.1 par. 1: pide SOLO documentos de
 *   pago, máx. 30 días hábiles con trámite suspendido).
 * - `CON_ACTA_DE_OBSERVACIONES → EN_VIABILIDAD`: superada la observación,
 *   continúa a viabilidad (art. 2.2.6.1.2.3.1 par. 1).
 * - `CON_ACTA_DE_OBSERVACIONES → DESISTIDA`: incumplir el acta (no
 *   responder o no aportar lo pedido) "se entenderá desistida" (art.
 *   2.2.6.1.2.3.4).
 * - `EN_VIABILIDAD → CONCEDIDA` / `→ NEGADA`: decisión en 45 días hábiles
 *   — "viabilidad, negación o desistimiento" (art. 2.2.6.1.2.3.1 inc. 1).
 * - `EN_VIABILIDAD → DESISTIDA`: no aportar los documentos de pago exigidos
 *   en viabilidad (art. 2.2.6.1.2.3.1 par. 1 / art. 2.2.6.1.2.3.4).
 * - `{RADICADA_EN_DEBIDA_FORMA,EN_REVISION,CON_ACTA_DE_OBSERVACIONES,
 *   EN_VIABILIDAD} → DESISTIDA`: desistimiento EXPRESO, procede desde
 *   cualquier estado ANTES de la decisión (art. 2.2.6.1.2.3.4) — distinto
 *   del desistimiento TÁCITO por incumplimiento del acta/viabilidad (mismo
 *   estado destino; la distinción expreso/tácito es un atributo del
 *   EVENTO, no un estado separado).
 * - `{CONCEDIDA,NEGADA,DESISTIDA} → NOTIFICADA`: todo acto que resuelve
 *   (favorable, desfavorable o desistimiento) se notifica — CPACA,
 *   notificación electrónica SOLO si fue aceptada (art. 2.2.6.1.2.3.7).
 * - `NOTIFICADA → EN_FIRME`: firmeza del acto administrativo (CPACA art. 87).
 */
const TRANSICIONES: Readonly<Record<EstadoJuridicoLicencia, readonly TransicionPermitida[]>> = {
  RADICADA_EN_DEBIDA_FORMA: [
    { hacia: 'EN_REVISION', fundamento: 'D.1077/2015 art. 2.2.6.1.2.1.1 par. 1 (ancla del término); art. 2.2.6.1.2.2.1-2 (citación/valla).' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — desistimiento expreso, procede antes de la decisión.' },
  ],
  EN_REVISION: [
    { hacia: 'CON_ACTA_DE_OBSERVACIONES', fundamento: 'D.1077/2015 art. 2.2.6.1.2.2.4 (D.1783/2021 art. 19) — acta por UNA SOLA VEZ.', requiereNoHuboActaPrevia: true },
    { hacia: 'EN_VIABILIDAD', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 — sin observaciones, pasa directo al acto de viabilidad.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — desistimiento expreso, procede antes de la decisión.' },
  ],
  CON_ACTA_DE_OBSERVACIONES: [
    { hacia: 'EN_VIABILIDAD', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 — observación superada, continúa a viabilidad.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.4 — incumplir el acta "se entenderá desistida" (tácito) o desistimiento expreso.' },
  ],
  EN_VIABILIDAD: [
    { hacia: 'CONCEDIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 inc. 1 — decisión en 45 días hábiles.' },
    { hacia: 'NEGADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 inc. 1 — decisión en 45 días hábiles.' },
    { hacia: 'DESISTIDA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.1 par. 1 / art. 2.2.6.1.2.3.4 — no aportar documentos de pago exigidos en viabilidad, o desistimiento expreso.' },
  ],
  CONCEDIDA: [
    { hacia: 'NOTIFICADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.7 — notificación CPACA (electrónica solo si fue aceptada).' },
  ],
  NEGADA: [
    { hacia: 'NOTIFICADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.7 — notificación CPACA (electrónica solo si fue aceptada).' },
  ],
  DESISTIDA: [
    { hacia: 'NOTIFICADA', fundamento: 'D.1077/2015 art. 2.2.6.1.2.3.7 — el acto de desistimiento también se notifica.' },
  ],
  NOTIFICADA: [
    { hacia: 'EN_FIRME', fundamento: 'CPACA (Ley 1437/2011) art. 87 — firmeza del acto administrativo.' },
  ],
  EN_FIRME: [],
};

/**
 * ¿Es válida la transición `desde → hacia`? Incluye el guard de acta única
 * (`opciones.yaHuboActa`) — si la transición exige "no hubo acta previa" y
 * `yaHuboActa` es `true`, se rechaza aunque el par de estados esté en el
 * mapa (fail-closed: el guard SIEMPRE se evalúa cuando la transición lo
 * declara, sin excepción implícita).
 */
export function puedeTransicionar(
  desde: EstadoJuridicoLicencia,
  hacia: EstadoJuridicoLicencia,
  opciones: OpcionesTransicionLicencia = {},
): boolean {
  const permitida = TRANSICIONES[desde].find((t) => t.hacia === hacia);
  if (!permitida) return false;
  if (permitida.requiereNoHuboActaPrevia && opciones.yaHuboActa === true) return false;
  return true;
}

/**
 * Transiciones posibles DESDE un estado, con su fundamento — para pintar
 * un panel operativo (Fase 3, no esta tanda) o para mensajes de error que
 * expliquen POR QUÉ una transición no procede. Aplica el guard de acta:
 * `CON_ACTA_DE_OBSERVACIONES` se excluye de la lista si `opciones.yaHuboActa`.
 */
export function transicionesDesde(
  estado: EstadoJuridicoLicencia,
  opciones: OpcionesTransicionLicencia = {},
): { hacia: EstadoJuridicoLicencia; fundamento: string }[] {
  return TRANSICIONES[estado]
    .filter((t) => !(t.requiereNoHuboActaPrevia && opciones.yaHuboActa === true))
    .map((t) => ({ hacia: t.hacia, fundamento: t.fundamento }));
}

/* ──────────────────────────────────────────────
   Validación de cierre (DF-6, ADR-0029)
────────────────────────────────────────────── */

export interface ResultadoValidacionCierreExpediente {
  valido: boolean;
  errores: string[];
}

/**
 * Valida que un expediente tenga los datos exigidos para cerrar (alcanzar
 * `EN_FIRME`). PURA — no cambia el estado, no persiste; el caller decide
 * qué hacer con el resultado. Sin cableado a rutas todavía (no hay
 * persistencia de expedientes en esta tanda) — función + tests únicamente.
 *
 * - `origen: 'REAL'` (o ausente — mismo criterio de default que el resto
 *   del motor: REAL es el caso normal, RECONSTRUIDO es la excepción que se
 *   declara explícitamente): exige `actoFinal.numero`, `actoFinal.fecha` Y
 *   `actoFinal.fechaFirmeza`. `fechaFirmeza` es la más importante de las
 *   tres (DF-6): sin ella no corren vigencias ni nace el reporte ELIC.
 * - `origen: 'RECONSTRUIDO'`: puede cerrar con `actoFinal.cierreDesconocido
 *   === true` en vez de los tres datos — el registro histórico de
 *   Planeación no siempre los conserva (D6, ADR-0026).
 */
export function validarCierreExpediente(
  expediente: Pick<Expediente, 'origen' | 'actoFinal'>,
): ResultadoValidacionCierreExpediente {
  const errores: string[] = [];
  const actoFinal = expediente.actoFinal;

  if (expediente.origen === 'RECONSTRUIDO') {
    const tieneDatosCompletos = !!(actoFinal?.numero && actoFinal?.fecha && actoFinal?.fechaFirmeza);
    if (!tieneDatosCompletos && actoFinal?.cierreDesconocido !== true) {
      errores.push('Expediente RECONSTRUIDO sin acto final completo debe declarar actoFinal.cierreDesconocido === true (D6, ADR-0026).');
    }
    return { valido: errores.length === 0, errores };
  }

  // REAL (o sin origen declarado — default REAL).
  if (!actoFinal?.numero) errores.push('actoFinal.numero es obligatorio para cerrar un expediente REAL.');
  if (!actoFinal?.fecha) errores.push('actoFinal.fecha es obligatoria para cerrar un expediente REAL.');
  if (!actoFinal?.fechaFirmeza) errores.push('actoFinal.fechaFirmeza es obligatoria para cerrar un expediente REAL (DF-6, ADR-0029: dispara vigencias y el reporte ELIC).');
  return { valido: errores.length === 0, errores };
}
