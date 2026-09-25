/**
 * Tabla de equivalencias de ESTADOS OPERATIVOS — estructura P4′ nueva
 * (endurecimiento del importador de históricos, ago-2026).
 *
 * Cierra un hueco ESTRUCTURAL que `lib/motor-expedientes/equivalencia-migracion.ts`
 * (DF-4) no cubre: esa tabla resuelve texto histórico → CÓDIGO DE SUBTIPO
 * normativo (`SubtipoTramite.codigo`, p. ej. "LC" → CONSTRUCCION). Esta
 * tabla resuelve un eje DISTINTO: texto histórico del campo "estado" del
 * libro de consecutivo (p. ej. "TERMINADO", "REVISADO") → el hito de la
 * máquina de estados JURÍDICOS del ciclo de licencias (`EstadoJuridicoLicencia`,
 * `lib/motor-expedientes/estados-licencia.ts`, DF-5). Mezclar ambos ejes en
 * una sola tabla sería incorrecto: un mismo texto histórico de "estado"
 * ("REVISADO") no tiene relación alguna con los textos de "tipo" ("LC",
 * "PH"...) que resuelve la otra tabla — son preguntas jurídicas distintas
 * (P1′ vs P4′, ADR-0029) con respuestas independientes.
 *
 * MISMA disciplina que DF-4 (reutilizada, no reinventada):
 * `normalizarTextoHistorico` (trim + colapsar espacios + mayúsculas) viene
 * de `equivalencia-migracion.ts` — es genérica (no conoce subtipos ni
 * estados), así que sirve igual para este eje sin duplicar la función.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * POR QUÉ LA SEMILLA DE HOY ESTÁ 100% EN CUARENTENA (y por qué eso es
 * CORRECTO, no un defecto de esta implementación):
 *
 * El campo "estado" del libro de consecutivo es texto libre operativo del
 * panel de Planeación ("TERMINADO", "REVISADO"...), SIN definición
 * documentada de qué hito jurídico normativo corresponde a cada uno. DF-5
 * (ADR-0029) es explícito: "Los estados OPERATIVOS del panel y su mapeo
 * (incl. REVISADO y la cohorte 2022-2024) NO se congelan: esperan al
 * ingeniero (P4′, R4/R9)". Adivinar aquí que "TERMINADO" significa
 * `CONCEDIDA` (¿o `NEGADA`? ¿o `EN_FIRME` sin acto formal registrado?)
 * inventaría un desenlace jurídico sin evidencia — exactamente lo que este
 * módulo existe para evitar (mismo principio que `resolverEquivalencia`
 * nunca "adivina" un código de subtipo por parecido).
 *
 * Por eso la semilla de hoy declara CUARENTENA para:
 *  - `TERMINADO`/`TERMINADA` (dos filas — el libro usa ambos géneros):
 *    "probable cierre" pero P4′ decide CUÁL hito exacto (¿CONCEDIDA?
 *    ¿NEGADA? ¿EN_FIRME?) — no se adivina un desenlace.
 *  - `REVISADO`/`REVISADA`: "probable EN_REVISION" pero P4′ confirma.
 *  - Ausencia de estado (texto vacío/indefinido — la cohorte 2022-2024 del
 *    libro no registra "estado" en absoluto): R9, sin evidencia de cierre.
 *
 * REGLA DURA aplicada por el planificador (`planificar-importacion-consecutivo.ts`):
 * mientras el estado operativo de un registro esté en CUARENTENA, el
 * registro ENTERO va a cuarentena del plan — nunca se importa un
 * expediente sin un estado jurídico honesto, aunque su CÓDIGO de subtipo sí
 * hubiera resuelto. Consecuencia esperada, verificada por el test de
 * reconciliación contra el snapshot real: HOY el dry-run planifica **0
 * importables** y ~202 en cuarentena. Es el resultado CORRECTO del diseño,
 * no un bug: el reporte (`generarReporteDryRun`) le muestra al propietario
 * y al ingeniero, con conteos exactos, qué preguntas (P1′ y P4′) desbloquean
 * cuántos registros. El día que P4′ (y P1′) respondan, llenar esta tabla
 * (y la de `equivalencia-migracion.ts`) con filas `estado: 'MAPEADO'` hace
 * que el plan pase de 0 a ~190 importables SIN tocar el planificador ni el
 * ejecutor — son datos, no código.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SUPERSEDIDO como puerta de bloqueo (DF-10, decisión del propietario,
 * 11-ago-2026): `planificar-importacion-consecutivo.ts` YA NO llama a
 * `resolverEstadoOperativo` para decidir si un registro se importa —
 * decisión distinta y más simple reemplazó a la de arriba: TODO registro
 * histórico con fecha válida entra como "histórico sin resolver"
 * (`RevisionHistoricaLicencia`, `lib/motor-expedientes/estados-licencia.ts`,
 * DF-10), sin importar lo que diga su campo "estado" — adivinar CUÁL de los
 * 9 hitos jurídicos corresponde a "terminado"/"revisado" seguía siendo
 * exactamente lo que este módulo existía para evitar, y esperar P4′
 * indefinidamente bloqueaba el libro completo que el propietario pidió
 * importar. El texto crudo del campo "estado" SÍ se conserva (verbatim, ver
 * `ExpedienteLicenciaDoc.estadoOriginalHistorico`), solo que ya no pasa por
 * ESTA tabla para decidir nada.
 *
 * Este archivo NO se elimina: `resolverEstadoOperativo`/`validarTablaEstadosOperativos`
 * siguen siendo lógica PURA y correcta, reutilizable el día que exista un
 * mecanismo real (interactivo, no de migración masiva) para que un
 * funcionario resuelva un estado operativo puntual contra un hito jurídico
 * — ese es un problema distinto al de "importar 202 registros sin inventar
 * un desenlace", que es el que resolvió DF-10.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { normalizarTextoHistorico } from '@/lib/motor-expedientes/equivalencia-migracion';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

/**
 * Una fila de la tabla: un texto histórico de "estado" (exacto, antes de
 * normalizar) → el hito jurídico al que equivale, o CUARENTENA si aún no
 * hay evidencia suficiente para decidirlo (P4′).
 */
export interface EquivalenciaEstadoOperativo {
  /** Texto tal como aparece en el libro de consecutivo, ANTES de normalizar (se conserva verbatim para trazabilidad). */
  textoHistorico: string;
  /** Solo presente si `estado === 'MAPEADO'`. */
  estadoJuridico?: EstadoJuridicoLicencia;
  estado: 'MAPEADO' | 'CUARENTENA';
  /** Sustento de la equivalencia (obligatorio en la práctica para `estado: 'MAPEADO'`). */
  fundamento?: string;
  /** Motivo de la cuarentena (obligatorio en la práctica para `estado: 'CUARENTENA'`). */
  nota?: string;
}

const NOTA_TERMINADO = 'Probable cierre del trámite, pero P4′ (ADR-0029) decide el estado jurídico exacto '
  + '(¿CONCEDIDA/NEGADA/EN_FIRME?) — no se adivina un desenlace jurídico sin evidencia documental del acto.';
const NOTA_REVISADO = 'Probable EN_REVISION (o CON_ACTA_DE_OBSERVACIONES/EN_VIABILIDAD — el texto operativo no distingue '
  + 'entre esos hitos), pero P4′ confirma exactamente cuál.';

/**
 * Semilla PROVISIONAL (DF-5/DF-9, ADR-0029) — ver el bloque grande de JSDoc
 * al inicio del archivo para el porqué de que TODA fila hoy sea CUARENTENA.
 * `textoHistorico` se declara ya en mayúsculas (forma normalizada) porque
 * `resolverEstadoOperativo` normaliza ambos lados antes de comparar — así
 * una sola fila cubre "TERMINADO"/"terminado"/"Terminado" sin variantes
 * redundantes; SOLO el género (terminadO/terminadA) exige una fila aparte,
 * porque `normalizarTextoHistorico` no interpreta morfología, solo
 * mayúsculas/espacios (mismo límite, documentado, que su par de DF-4).
 */
export const EQUIVALENCIAS_ESTADOS_OPERATIVOS_SEMILLA: readonly EquivalenciaEstadoOperativo[] = [
  { textoHistorico: 'TERMINADO', estado: 'CUARENTENA', nota: NOTA_TERMINADO },
  { textoHistorico: 'TERMINADA', estado: 'CUARENTENA', nota: NOTA_TERMINADO },
  { textoHistorico: 'REVISADO', estado: 'CUARENTENA', nota: NOTA_REVISADO },
  { textoHistorico: 'REVISADA', estado: 'CUARENTENA', nota: NOTA_REVISADO },
] as const satisfies readonly EquivalenciaEstadoOperativo[];

export type ResultadoResolucionEstadoOperativo =
  | { resultado: 'MAPEADO'; estadoJuridico: EstadoJuridicoLicencia; fundamento: string }
  | { resultado: 'CUARENTENA'; motivo: string };

/**
 * Resuelve el texto histórico de "estado" contra la tabla de equivalencias.
 * Tres casos posibles, TODOS `CUARENTENA` hoy (ver cabecera del archivo):
 *  1. Texto ausente/vacío → CUARENTENA "sin evidencia de cierre" (R9) — la
 *     cohorte 2022-2024 del libro no registra estado en absoluto.
 *  2. Texto presente pero SIN fila en la tabla (normalizado) → CUARENTENA
 *     genérica, cita el texto crudo para que quien la lea sepa qué texto
 *     faltó clasificar.
 *  3. Texto presente CON fila, pero la fila misma es `estado: 'CUARENTENA'`
 *     → se usa la nota de esa fila (motivo específico, con su fundamento
 *     provisional de por qué NO se mapea todavía).
 *
 * Igual que `resolverEquivalencia` (DF-4): NUNCA se adivina por parecido —
 * o hay una fila `MAPEADO` que calza exacto (normalizado), o es cuarentena.
 */
export function resolverEstadoOperativo(
  textoHistorico: string | null | undefined,
  tabla: readonly EquivalenciaEstadoOperativo[],
): ResultadoResolucionEstadoOperativo {
  if (!textoHistorico || textoHistorico.trim().length === 0) {
    return { resultado: 'CUARENTENA', motivo: 'Sin estado registrado en el histórico (R9: sin evidencia de cierre del trámite).' };
  }
  const buscado = normalizarTextoHistorico(textoHistorico);
  const fila = tabla.find((f) => normalizarTextoHistorico(f.textoHistorico) === buscado);
  if (!fila) {
    return { resultado: 'CUARENTENA', motivo: `Estado histórico "${textoHistorico}" no está en la tabla de equivalencias (P4′ pendiente).` };
  }
  if (fila.estado === 'CUARENTENA') {
    return { resultado: 'CUARENTENA', motivo: fila.nota ?? `Estado histórico "${textoHistorico}" está deliberadamente sin mapear (P4′ pendiente).` };
  }
  // fila.estado === 'MAPEADO': por construcción de la tabla (ver validarTablaEstadosOperativos), estadoJuridico/fundamento existen.
  return { resultado: 'MAPEADO', estadoJuridico: fila.estadoJuridico as EstadoJuridicoLicencia, fundamento: fila.fundamento ?? '' };
}

export type CodigoErrorEquivalenciaEstadoOperativo =
  | 'TEXTO_HISTORICO_VACIO'
  | 'TEXTO_HISTORICO_DUPLICADO'
  | 'MAPEADO_SIN_ESTADO_JURIDICO'
  | 'MAPEADO_SIN_FUNDAMENTO'
  | 'CUARENTENA_CON_ESTADO_JURIDICO'
  | 'CUARENTENA_SIN_NOTA';

export interface ErrorEquivalenciaEstadoOperativo {
  codigo: CodigoErrorEquivalenciaEstadoOperativo;
  mensaje: string;
}

/**
 * Valida la ESTRUCTURA de la tabla (no su contenido semántico — no sabe si
 * un mapeo es "correcto" jurídicamente, eso es P4′/Jurídica). Mismo patrón
 * que `validarTablaEquivalencias` (DF-4): dos filas no pueden normalizar al
 * mismo texto (ambigüedad silenciosa, fail-closed), y cada fila debe traer
 * los campos que su `estado` exige.
 */
export function validarTablaEstadosOperativos(
  tabla: readonly EquivalenciaEstadoOperativo[],
): { valida: boolean; errores: ErrorEquivalenciaEstadoOperativo[] } {
  const errores: ErrorEquivalenciaEstadoOperativo[] = [];
  const vistos = new Set<string>();
  const duplicados = new Set<string>();

  for (const fila of tabla) {
    if (!fila.textoHistorico || fila.textoHistorico.trim().length === 0) {
      errores.push({ codigo: 'TEXTO_HISTORICO_VACIO', mensaje: 'Una fila de la tabla de estados operativos tiene "textoHistorico" vacío.' });
      continue;
    }
    const normalizado = normalizarTextoHistorico(fila.textoHistorico);
    if (vistos.has(normalizado)) duplicados.add(normalizado);
    vistos.add(normalizado);

    if (fila.estado === 'CUARENTENA') {
      if (fila.estadoJuridico) {
        errores.push({ codigo: 'CUARENTENA_CON_ESTADO_JURIDICO', mensaje: `La fila "${fila.textoHistorico}" está en CUARENTENA pero declara "estadoJuridico" (${fila.estadoJuridico}); contradictorio.` });
      }
      if (!fila.nota || fila.nota.trim().length === 0) {
        errores.push({ codigo: 'CUARENTENA_SIN_NOTA', mensaje: `La fila "${fila.textoHistorico}" está en CUARENTENA pero no explica el motivo ("nota").` });
      }
      continue;
    }
    if (!fila.estadoJuridico) {
      errores.push({ codigo: 'MAPEADO_SIN_ESTADO_JURIDICO', mensaje: `La fila "${fila.textoHistorico}" está MAPEADO pero no declara "estadoJuridico".` });
    }
    if (!fila.fundamento || fila.fundamento.trim().length === 0) {
      errores.push({ codigo: 'MAPEADO_SIN_FUNDAMENTO', mensaje: `La fila "${fila.textoHistorico}" está MAPEADO pero no cita "fundamento".` });
    }
  }

  for (const normalizado of duplicados) {
    errores.push({ codigo: 'TEXTO_HISTORICO_DUPLICADO', mensaje: `El texto histórico "${normalizado}" (normalizado) aparece en más de una fila; cada texto debe resolver a una única equivalencia.` });
  }

  return { valida: errores.length === 0, errores };
}
