/**
 * Evaluador de completitud del checklist de un trámite (D4, ADR-0026).
 *
 * PURO: sin I/O, sin Firestore, sin fechas de servidor. Recibe la
 * Definición de Trámite, el estado de aportes de un expediente concreto y
 * el contexto de hechos del caso, y decide si el checklist está COMPLETO —
 * con el detalle de qué falta y por qué. El caller (Fase 2, endpoint de
 * intake) es quien persiste el resultado; este módulo no conoce Firestore.
 *
 * Regla de negocio (D4):
 *  - OBLIGATORIO  → siempre exigido.
 *  - OPCIONAL     → nunca bloquea completitud (informativo).
 *  - CONDICIONAL  → exigido SOLO si su `condicion` se cumple contra el
 *                    `contexto` del expediente; si no se cumple, se marca
 *                    como no aplicable (no bloquea, y se reporta para
 *                    trazabilidad/UI).
 *
 * FAIL-CLOSED ante contexto incompleto (revisión cruzada del Arquitecto,
 * hallazgo MEDIO #1 sobre la Fase 0): si la condición de un requisito
 * CONDICIONAL referencia una clave que NO existe en el `contexto`, el
 * resultado NO es "no aplica" — es INDETERMINADO. Es un control de
 * completitud legal: declarar en silencio que un requisito "no aplica"
 * porque falta el dato para decidirlo permitiría que un expediente avance
 * sin haber verificado una condición real del checklist. Un expediente con
 * algún requisito indeterminado NUNCA es `completo`. La semántica de tres
 * valores (CUMPLE/NO_CUMPLE/INDETERMINADO) se propaga por los combinadores
 * `Y`/`O`/`NO` con lógica de Kleene fuerte — p. ej. `O` con una rama CUMPLE
 * y otra INDETERMINADA sigue siendo CUMPLE (ya está decidido por la rama
 * conocida; no hay nada de qué "fallar cerrado"), pero `O` con NO_CUMPLE +
 * INDETERMINADO sí es INDETERMINADO (no se puede descartar el requisito sin
 * el dato que falta).
 */

import type {
  AporteRequisito,
  CondicionRequisito,
  ContextoEvaluacionRequisito,
  DefinicionTramite,
  RequisitoDefinicion,
} from './tipos';

/** ¿La clave existe realmente en el contexto (no solo `!== undefined`)? Evita falsos "ausente" si algún día se permite `null`/`undefined` explícito. */
function claveDefinida(contexto: ContextoEvaluacionRequisito, clave: string): boolean {
  return Object.prototype.hasOwnProperty.call(contexto, clave);
}

/** Recolecta, recursivamente, todas las claves de contexto que referencia un árbol de condición. */
function clavesReferenciadas(condicion: CondicionRequisito): string[] {
  switch (condicion.operador) {
    case 'IGUAL':
    case 'DISTINTO':
    case 'EN':
      return [condicion.clave];
    case 'Y':
    case 'O':
      return condicion.condiciones.flatMap(clavesReferenciadas);
    case 'NO':
      return clavesReferenciadas(condicion.condicion);
  }
}

/** De las claves que referencia la condición, cuáles NO están presentes en el contexto (sin duplicados). */
function clavesFaltantesDe(condicion: CondicionRequisito, contexto: ContextoEvaluacionRequisito): string[] {
  const claves = new Set(clavesReferenciadas(condicion));
  return [...claves].filter((clave) => !claveDefinida(contexto, clave));
}

/**
 * Resultado de evaluar una condición: tres valores (lógica de Kleene
 * fuerte), no booleano — `INDETERMINADO` es un valor de primera clase, no
 * un caso de error.
 */
export type ResultadoCondicion = 'CUMPLE' | 'NO_CUMPLE' | 'INDETERMINADO';

/**
 * Evalúa recursivamente un árbol de `CondicionRequisito` contra un contexto
 * de hechos del caso. Devuelve `INDETERMINADO` (no `NO_CUMPLE`) cuando la
 * clave referenciada por una hoja no existe en `contexto` — ver nota
 * FAIL-CLOSED de la cabecera del archivo.
 */
export function evaluarCondicion(
  condicion: CondicionRequisito,
  contexto: ContextoEvaluacionRequisito,
): ResultadoCondicion {
  switch (condicion.operador) {
    case 'IGUAL': {
      if (!claveDefinida(contexto, condicion.clave)) return 'INDETERMINADO';
      return contexto[condicion.clave] === condicion.valor ? 'CUMPLE' : 'NO_CUMPLE';
    }
    case 'DISTINTO': {
      if (!claveDefinida(contexto, condicion.clave)) return 'INDETERMINADO';
      return contexto[condicion.clave] !== condicion.valor ? 'CUMPLE' : 'NO_CUMPLE';
    }
    case 'EN': {
      if (!claveDefinida(contexto, condicion.clave)) return 'INDETERMINADO';
      return condicion.valores.includes(contexto[condicion.clave]) ? 'CUMPLE' : 'NO_CUMPLE';
    }
    case 'Y': {
      const resultados = condicion.condiciones.map((c) => evaluarCondicion(c, contexto));
      if (resultados.some((r) => r === 'NO_CUMPLE')) return 'NO_CUMPLE';
      if (resultados.some((r) => r === 'INDETERMINADO')) return 'INDETERMINADO';
      return 'CUMPLE';
    }
    case 'O': {
      const resultados = condicion.condiciones.map((c) => evaluarCondicion(c, contexto));
      if (resultados.some((r) => r === 'CUMPLE')) return 'CUMPLE';
      if (resultados.some((r) => r === 'INDETERMINADO')) return 'INDETERMINADO';
      return 'NO_CUMPLE';
    }
    case 'NO': {
      const r = evaluarCondicion(condicion.condicion, contexto);
      if (r === 'INDETERMINADO') return 'INDETERMINADO';
      return r === 'CUMPLE' ? 'NO_CUMPLE' : 'CUMPLE';
    }
  }
}

/** ¿Este requisito exige aporte, no aplica, o no se puede saber (contexto incompleto) para ESTE caso concreto? */
export type ResultadoAplicacion = 'APLICA' | 'NO_APLICA' | 'INDETERMINADO';

export function requisitoAplica(
  requisito: RequisitoDefinicion,
  contexto: ContextoEvaluacionRequisito,
): ResultadoAplicacion {
  if (requisito.tipo === 'OBLIGATORIO') return 'APLICA';
  if (requisito.tipo === 'OPCIONAL') return 'NO_APLICA';
  const resultado = evaluarCondicion(requisito.condicion, contexto);
  if (resultado === 'CUMPLE') return 'APLICA';
  if (resultado === 'NO_CUMPLE') return 'NO_APLICA';
  return 'INDETERMINADO';
}

export type MotivoFaltante = 'PENDIENTE_OBLIGATORIO' | 'PENDIENTE_CONDICIONAL_APLICA';

export interface RequisitoFaltante {
  requisitoId: string;
  nombre: string;
  motivo: MotivoFaltante;
}

/**
 * Requisito CONDICIONAL cuya condición no se pudo evaluar por falta de dato
 * en el contexto. Razón distinguible de `RequisitoFaltante` a propósito: un
 * faltante es "sabemos que aplica y no está aportado"; un indeterminado es
 * "no sabemos si aplica" — ambos bloquean completitud, pero requieren
 * acciones distintas (aportar documento vs. completar el contexto/caso).
 */
export interface RequisitoIndeterminado {
  requisitoId: string;
  nombre: string;
  /** Claves de contexto que faltan para poder evaluar la condición de este requisito. */
  clavesFaltantes: string[];
}

export interface ResultadoCompletitud {
  /** `false` si hay al menos un faltante O un indeterminado (fail-closed). */
  completo: boolean;
  /** Requisitos que SÍ aplican al caso y aún no tienen aporte con documento real — bloquean la completitud. */
  faltantes: RequisitoFaltante[];
  /** Ids de requisitos condicionales que NO aplicaron al caso (trazabilidad/UI; no bloquean). */
  noAplicables: string[];
  /** Requisitos condicionales cuya condición no se pudo evaluar por contexto incompleto — bloquean la completitud. */
  indeterminados: RequisitoIndeterminado[];
}

/**
 * Evalúa la completitud de un expediente frente a su Definición de Trámite.
 *
 * @param tramite  Definición de Trámite (checklist + reglas condicionales).
 * @param aportes  Estado actual de cada requisito para ESTE expediente.
 * @param contexto Hechos del caso concreto, usados para resolver condicionales.
 */
export function evaluarCompletitud(
  tramite: DefinicionTramite,
  aportes: AporteRequisito[],
  contexto: ContextoEvaluacionRequisito,
): ResultadoCompletitud {
  const aportePorRequisito = new Map(aportes.map((a) => [a.requisitoId, a] as const));
  const faltantes: RequisitoFaltante[] = [];
  const noAplicables: string[] = [];
  const indeterminados: RequisitoIndeterminado[] = [];

  for (const requisito of tramite.requisitos) {
    const resultado = requisitoAplica(requisito, contexto);

    if (resultado === 'INDETERMINADO') {
      // Solo un CONDICIONAL puede ser INDETERMINADO (OBLIGATORIO/OPCIONAL son
      // siempre APLICA/NO_APLICA); el chequeo de tipo aquí es para que TS
      // permita acceder a `.condicion`, no un caso de negocio distinto.
      indeterminados.push({
        requisitoId: requisito.id,
        nombre: requisito.nombre,
        clavesFaltantes: requisito.tipo === 'CONDICIONAL' ? clavesFaltantesDe(requisito.condicion, contexto) : [],
      });
      continue;
    }

    if (resultado === 'NO_APLICA') {
      if (requisito.tipo === 'CONDICIONAL') noAplicables.push(requisito.id);
      continue;
    }

    // APLICA: exige un aporte con al menos un documento real (defensa en
    // profundidad — hallazgo MEDIO #2: no confiar solo en el flag `estado`,
    // que en Fase 2 debe garantizar el servidor pero que este evaluador
    // puro no puede asumir por sí solo).
    const aporte = aportePorRequisito.get(requisito.id);
    const yaAportado = aporte?.estado === 'APORTADO' && aporte.documentoIds.length > 0;
    if (!yaAportado) {
      faltantes.push({
        requisitoId: requisito.id,
        nombre: requisito.nombre,
        motivo: requisito.tipo === 'CONDICIONAL' ? 'PENDIENTE_CONDICIONAL_APLICA' : 'PENDIENTE_OBLIGATORIO',
      });
    }
  }

  return {
    completo: faltantes.length === 0 && indeterminados.length === 0,
    faltantes,
    noAplicables,
    indeterminados,
  };
}
