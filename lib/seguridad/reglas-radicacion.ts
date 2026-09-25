import type { CanalRespuesta } from '@/src/types/ventanilla';

/**
 * Sprint 1.5 — punto único de verdad para las reglas de negocio de
 * radicación que aplican tanto al flujo interno de Ventanilla
 * (`lib/actions/radicarVentanilla.ts`) como al endpoint público
 * `app/api/radicacion/route.ts`.
 *
 * Cada regla individual retorna un mensaje de error o `null`. El
 * orquestador `validarReglasRadicacion` aplica todas y devuelve la
 * primera que falla. Diseñado para crecer agregando reglas al arreglo
 * sin cambiar callers.
 */

export interface EntradaReglasRadicacion {
  noAportaCorreo?:    boolean;
  noAportaTelefono?:  boolean;
  noAportaDireccion?: boolean;
  canalRespuesta?:    CanalRespuesta;
}

export const MENSAJE_CORREO_NO_APORTADO_CORREO =
  'Si el solicitante no aporta correo electrónico, el medio de respuesta no puede ser correo.';

/** Coherencia entre "no aporta correo" y canal de respuesta CORREO. */
export function reglaCorreoNoAportado(e: EntradaReglasRadicacion): string | null {
  if (e.noAportaCorreo === true && e.canalRespuesta === 'CORREO') {
    return MENSAJE_CORREO_NO_APORTADO_CORREO;
  }
  return null;
}

type ReglaRadicacion = (e: EntradaReglasRadicacion) => string | null;

const REGLAS: readonly ReglaRadicacion[] = [
  reglaCorreoNoAportado,
];

/**
 * Aplica todas las reglas de radicación en orden y devuelve la primera
 * que falla, o `null` si todas pasan. Consumida por el flujo interno y
 * por el endpoint público para garantizar mensajes consistentes.
 */
export function validarReglasRadicacion(e: EntradaReglasRadicacion): string | null {
  for (const regla of REGLAS) {
    const err = regla(e);
    if (err) return err;
  }
  return null;
}
