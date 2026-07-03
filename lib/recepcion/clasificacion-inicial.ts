import type { TenantId } from '@/src/types/radicado';

/**
 * Sprint Radicación dirigida — clasificación con la que NACE el radicado
 * institucional.
 *
 * Regla aprobada de responsable:
 *  - destino VENTANILLA_UNICA → el actor que radica (recepción) queda
 *    como funcionario responsable, como hasta ahora;
 *  - destino en cualquier otra dependencia → nace SIN funcionario
 *    responsable, para que aparezca "sin asignar" dentro de esa
 *    dependencia y su jefe lo asigne internamente.
 *
 * "Laura radica y direcciona. La dependencia recibe y asigna."
 *
 * Función pura: sin Firestore, sin React.
 */

export interface ClasificacionInicial {
  oficinaDestino: TenantId;
  zonaGeografica: 'CASCO_URBANO';
  /** Ausente (no undefined) cuando el destino es otra dependencia. */
  funcionarioResponsableUid?: string;
}

export function construirClasificacionInicial(
  oficinaDestino: TenantId,
  actorUid: string,
): ClasificacionInicial {
  if (oficinaDestino === 'VENTANILLA_UNICA') {
    return {
      oficinaDestino,
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: actorUid,
    };
  }
  return {
    oficinaDestino,
    zonaGeografica: 'CASCO_URBANO',
  };
}
