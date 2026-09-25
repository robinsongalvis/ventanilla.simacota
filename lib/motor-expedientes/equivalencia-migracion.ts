/**
 * Tabla de equivalencias de migración — Fase 2 (arranque, PASO 7).
 *
 * PROVISIONAL, sujeto a P1/P2 (`docs/planes/GUIA_SESION_PLANEACION_
 * LICENCIAS.md`, Bloque 1): P1 es la validación de Planeación de la tabla
 * real de códigos históricos; P2 es la regla de "combinados" (si un
 * expediente puede tener más de un subtipo simultáneo, y cómo). Este
 * módulo define el TIPO y la lógica de resolución/validación PURA — SIN
 * persistencia (no lee ni escribe Firestore) y SIN datos (no trae ninguna
 * tabla real de Simacota/Planeación sembrada; A3, ADR-0026 §A3: el núcleo
 * del motor no conoce datos de ningún municipio ni Secretaría concretos).
 * Cuando P1/P2 cierren, la tabla REAL de equivalencias es un dato que se
 * carga aparte (Firestore o seed, decisión de Fase 1) — este módulo solo
 * sabe qué HACER con esa tabla una vez exista.
 *
 * Origen del problema que resuelve (`ANALISIS_INSUMO_CONSECUTIVO_
 * LICENCIAS.md` R6): el sistema legado de Planeación registró el subtipo de
 * trámite como texto libre, con variantes de casing/espacios y anomalías
 * reales (`LCR VISR`, `LRC`, combinados). Migrar esos expedientes históricos
 * al catálogo de `SubtipoTramite` (`./tipos.ts`) exige una tabla de
 * equivalencias explícita — texto histórico → uno o más códigos — nunca una
 * heurística que "adivine" el subtipo por parecido de string. Lo no
 * mapeable va a CUARENTENA (se reporta, no se fuerza una equivalencia).
 */

/**
 * Una fila de la tabla: un texto histórico exacto → los códigos de subtipo
 * a los que equivale (soporta combinados).
 *
 * `estado`/`fundamento`/`nota` son OPCIONALES (DF-4, ADR-0029) — ADITIVOS,
 * no rompen fixtures previos que solo declaran `{textoHistorico, codigos}`:
 *  - `estado: 'MAPEADO'`: la equivalencia está CONFIRMADA POR NORMA (o por
 *    composición evidente de códigos ya mapeados); `codigos` debe tener al
 *    menos uno y `fundamento` debe citar la base normativa.
 *  - `estado: 'CUARENTENA'`: el texto histórico NO se mapea — su
 *    significado local está pendiente del ingeniero (P1′). `codigos` DEBE
 *    quedar vacío (una fila en cuarentena que además trajera códigos sería
 *    contradictoria) y `nota` explica el porqué. `resolverEquivalencia`
 *    trata estas filas como NO RESUELTAS (devuelve `null`) aunque existan
 *    en la tabla — existen para dejar constancia de que el texto fue
 *    VISTO y deliberadamente NO mapeado, no para resolverlo.
 *  - Filas SIN `estado` (legado/tests): se resuelven exactamente como
 *    antes de DF-4, sin cambio de comportamiento.
 */
export interface EquivalenciaMigracion {
  /** Texto tal como aparece en el sistema legado, ANTES de normalizar (se conserva verbatim para trazabilidad). */
  textoHistorico: string;
  /** Códigos de `SubtipoTramite.codigo` a los que equivale. `length > 1` = combinado (p. ej. "LCR VISR" → dos códigos). Vacío si `estado === 'CUARENTENA'`. */
  codigos: string[];
  /** DF-4: estado de la fila frente a la migración. Ausente = comportamiento legado (se resuelve igual que 'MAPEADO'). */
  estado?: 'MAPEADO' | 'CUARENTENA';
  /** Cita normativa exacta que sustenta la equivalencia (obligatoria en la práctica para `estado: 'MAPEADO'`). */
  fundamento?: string;
  /** Motivo de la cuarentena (obligatoria en la práctica para `estado: 'CUARENTENA'`). */
  nota?: string;
}

/**
 * Normaliza un texto histórico para buscarlo en la tabla: recorta espacios
 * de los extremos, colapsa espacios internos múltiples a uno solo, y pasa a
 * mayúsculas. Determinista y sin heurística de similitud — dos textos que
 * normalizan igual son tratados como EL MISMO texto histórico; dos que no,
 * como distintos, sin excepción.
 */
export function normalizarTextoHistorico(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Resuelve un texto histórico contra la tabla de equivalencias. `null`
 * (CUARENTENA) si no hay ninguna fila cuyo `textoHistorico` normalizado
 * coincida — NUNCA se adivina una equivalencia por parecido; lo no mapeable
 * se reporta para revisión manual (Planeación, P1), no se fuerza.
 */
export function resolverEquivalencia(
  textoHistorico: string,
  tabla: EquivalenciaMigracion[],
): string[] | null {
  const buscado = normalizarTextoHistorico(textoHistorico);
  const fila = tabla.find((f) => normalizarTextoHistorico(f.textoHistorico) === buscado);
  if (!fila) return null;
  // DF-4: una fila en CUARENTENA está en la tabla para dejar constancia de
  // que el texto fue visto y NO se mapeó — JAMÁS se resuelve, aunque exista.
  if (fila.estado === 'CUARENTENA') return null;
  return fila.codigos;
}

export type CodigoErrorEquivalenciaMigracion =
  | 'TEXTO_HISTORICO_VACIO'
  | 'TEXTO_HISTORICO_DUPLICADO'
  | 'SIN_CODIGOS'
  | 'CUARENTENA_CON_CODIGOS'
  | 'MAPEADO_SIN_FUNDAMENTO'
  | 'CUARENTENA_SIN_NOTA';

export interface ErrorEquivalenciaMigracion {
  codigo: CodigoErrorEquivalenciaMigracion;
  mensaje: string;
}

export interface ResultadoValidacionEquivalencias {
  valida: boolean;
  errores: ErrorEquivalenciaMigracion[];
}

/**
 * Valida la tabla en sí (estructura, no contenido semántico — no sabe qué
 * códigos son "correctos", eso es P1/Planeación):
 *  - `textoHistorico` no puede ser vacío.
 *  - Dos filas NO pueden normalizar al mismo `textoHistorico` (ambigüedad
 *    silenciosa: ¿cuál de las dos gana? Fail-closed, se rechaza en vez de
 *    decidir).
 *  - `codigos` no puede estar vacío — SALVO en filas `estado: 'CUARENTENA'`,
 *    donde vacío es lo esperado (DF-4): ahí el error simétrico es que SÍ
 *    traiga códigos (`CUARENTENA_CON_CODIGOS`) o que le falte `nota`
 *    (`CUARENTENA_SIN_NOTA`).
 *  - `estado: 'MAPEADO'` sin `fundamento` → `MAPEADO_SIN_FUNDAMENTO`: una
 *    equivalencia marcada como confirmada por norma debe citar su base.
 */
export function validarTablaEquivalencias(tabla: EquivalenciaMigracion[]): ResultadoValidacionEquivalencias {
  const errores: ErrorEquivalenciaMigracion[] = [];
  const normalizadosVistos = new Set<string>();
  const normalizadosDuplicados = new Set<string>();

  for (const fila of tabla) {
    if (!fila.textoHistorico || fila.textoHistorico.trim().length === 0) {
      errores.push({ codigo: 'TEXTO_HISTORICO_VACIO', mensaje: 'Una fila de la tabla de equivalencias tiene "textoHistorico" vacío.' });
      continue;
    }
    const normalizado = normalizarTextoHistorico(fila.textoHistorico);
    if (normalizadosVistos.has(normalizado)) normalizadosDuplicados.add(normalizado);
    normalizadosVistos.add(normalizado);

    if (fila.estado === 'CUARENTENA') {
      if (fila.codigos.length > 0) {
        errores.push({
          codigo: 'CUARENTENA_CON_CODIGOS',
          mensaje: `La fila "${fila.textoHistorico}" está en CUARENTENA pero declara códigos (${fila.codigos.join(', ')}); una fila en cuarentena no debe tener códigos — es contradictorio.`,
        });
      }
      if (!fila.nota || fila.nota.trim().length === 0) {
        errores.push({
          codigo: 'CUARENTENA_SIN_NOTA',
          mensaje: `La fila "${fila.textoHistorico}" está en CUARENTENA pero no explica el motivo ("nota").`,
        });
      }
      continue; // una fila en cuarentena no se valida por las reglas de las filas mapeadas
    }

    if (fila.codigos.length === 0) {
      errores.push({
        codigo: 'SIN_CODIGOS',
        mensaje: `La fila "${fila.textoHistorico}" no tiene ningún código de subtipo asociado.`,
      });
    }
    if (fila.estado === 'MAPEADO' && (!fila.fundamento || fila.fundamento.trim().length === 0)) {
      errores.push({
        codigo: 'MAPEADO_SIN_FUNDAMENTO',
        mensaje: `La fila "${fila.textoHistorico}" está marcada MAPEADO pero no cita "fundamento" normativo.`,
      });
    }
  }

  for (const normalizado of normalizadosDuplicados) {
    errores.push({
      codigo: 'TEXTO_HISTORICO_DUPLICADO',
      mensaje: `El texto histórico "${normalizado}" (normalizado) aparece en más de una fila de la tabla; cada texto histórico debe resolver a una única equivalencia.`,
    });
  }

  return { valida: errores.length === 0, errores };
}
