/**
 * Validar si una fuente normativa puede citarse como fundamento directo.
 */

import type { NormativeDocumentStatus } from '@/src/types/simi-normograma';
import type { NormativeValidation } from '@/src/types/simi-rag';

const ESTADOS_CITABLES = new Set<NormativeDocumentStatus>([
  'vigente',
  'parcialmente_vigente',
  'interna_validada',
]);

const ESTADOS_NO_CITABLES = new Set<NormativeDocumentStatus>([
  'derogada',
  'interna_no_validada',
]);

export function validateNormativeSource(estado: NormativeDocumentStatus): NormativeValidation {
  if (ESTADOS_CITABLES.has(estado)) {
    return {
      canCite: true,
      reason:  `Fuente con estado "${estado}" — puede citarse como fundamento directo.`,
      warning: estado === 'parcialmente_vigente'
        ? 'Norma parcialmente vigente. Verificar artículos vigentes antes de citar.'
        : undefined,
    };
  }

  if (estado === 'pendiente_verificacion') {
    return {
      canCite:  false,
      reason:   'Fuente pendiente de verificación. No puede citarse como fundamento definitivo.',
      warning:  'Validar con el asesor jurídico o administrador antes de usar en respuesta oficial.',
    };
  }

  if (ESTADOS_NO_CITABLES.has(estado)) {
    return {
      canCite:  false,
      reason:   `Fuente con estado "${estado}". No puede usarse como fundamento jurídico vigente.`,
      warning:  estado === 'derogada'
        ? 'Norma derogada. Solo puede usarse como referencia histórica con advertencia explícita.'
        : 'Fuente interna no validada. Requiere validación del administrador jurídico.',
    };
  }

  return {
    canCite:  false,
    reason:   `Estado desconocido: "${estado}". No se puede determinar si es citable.`,
    warning:  'Consultar con el administrador del sistema.',
  };
}

/**
 * Clasifica una fuente según su citabilidad para el sistema RAG.
 */
export function classifySource(
  estado: NormativeDocumentStatus,
): 'fundamento_directo' | 'referencia_sujeta_validacion' | 'no_citable' {
  if (ESTADOS_CITABLES.has(estado)) return 'fundamento_directo';
  if (estado === 'pendiente_verificacion') return 'referencia_sujeta_validacion';
  return 'no_citable';
}
