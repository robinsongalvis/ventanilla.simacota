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
 */

import type {
  AporteRequisito,
  CondicionRequisito,
  ContextoEvaluacionRequisito,
  DefinicionTramite,
  RequisitoDefinicion,
} from './tipos';

/** Evalúa recursivamente un árbol de `CondicionRequisito` contra un contexto de hechos del caso. */
export function evaluarCondicion(
  condicion: CondicionRequisito,
  contexto: ContextoEvaluacionRequisito,
): boolean {
  switch (condicion.operador) {
    case 'IGUAL':
      return contexto[condicion.clave] === condicion.valor;
    case 'DISTINTO':
      return contexto[condicion.clave] !== condicion.valor;
    case 'EN':
      return condicion.valores.includes(contexto[condicion.clave]);
    case 'Y':
      return condicion.condiciones.every((c) => evaluarCondicion(c, contexto));
    case 'O':
      return condicion.condiciones.some((c) => evaluarCondicion(c, contexto));
    case 'NO':
      return !evaluarCondicion(condicion.condicion, contexto);
  }
}

/** ¿Este requisito exige aporte para ESTE caso concreto (según su tipo y, si es condicional, su regla)? */
export function requisitoAplica(
  requisito: RequisitoDefinicion,
  contexto: ContextoEvaluacionRequisito,
): boolean {
  if (requisito.tipo === 'OBLIGATORIO') return true;
  if (requisito.tipo === 'OPCIONAL') return false;
  return evaluarCondicion(requisito.condicion, contexto);
}

export type MotivoFaltante = 'PENDIENTE_OBLIGATORIO' | 'PENDIENTE_CONDICIONAL_APLICA';

export interface RequisitoFaltante {
  requisitoId: string;
  nombre: string;
  motivo: MotivoFaltante;
}

export interface ResultadoCompletitud {
  completo: boolean;
  /** Requisitos que SÍ aplican al caso y aún no tienen aporte — bloquean la completitud. */
  faltantes: RequisitoFaltante[];
  /** Ids de requisitos condicionales que NO aplicaron al caso (trazabilidad/UI; no bloquean). */
  noAplicables: string[];
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

  for (const requisito of tramite.requisitos) {
    const aplica = requisitoAplica(requisito, contexto);

    if (!aplica) {
      if (requisito.tipo === 'CONDICIONAL') noAplicables.push(requisito.id);
      continue;
    }

    const aporte = aportePorRequisito.get(requisito.id);
    const yaAportado = aporte?.estado === 'APORTADO';
    if (!yaAportado) {
      faltantes.push({
        requisitoId: requisito.id,
        nombre: requisito.nombre,
        motivo: requisito.tipo === 'CONDICIONAL' ? 'PENDIENTE_CONDICIONAL_APLICA' : 'PENDIENTE_OBLIGATORIO',
      });
    }
  }

  return { completo: faltantes.length === 0, faltantes, noAplicables };
}
