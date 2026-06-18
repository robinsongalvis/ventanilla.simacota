/**
 * Permisos del módulo Control Interno.
 *
 * Regla rectora: Control Interno NO modifica radicados ni respuestas
 * oficiales. Solo observa, audita, documenta y solicita planes de mejora.
 */

import type { RolInterno } from '@/lib/hooks/useAuth';

/** Roles autorizados a entrar al Centro de Control Interno. */
export function puedeAccederControlInterno(rol: RolInterno): boolean {
  return rol === 'CONTROL_INTERNO' || rol === 'ADMIN';
}

/** Puede crear hallazgos y observaciones. */
export function puedeCrearHallazgo(rol: RolInterno): boolean {
  return rol === 'CONTROL_INTERNO' || rol === 'ADMIN';
}

/** Puede solicitar planes de mejora a las dependencias. */
export function puedeSolicitarPlanMejora(rol: RolInterno): boolean {
  return rol === 'CONTROL_INTERNO' || rol === 'ADMIN';
}

/** Puede aportar avances a planes de mejora (dependencias). */
export function puedeReportarAvancePlan(rol: RolInterno): boolean {
  return rol === 'FUNCIONARIO' || rol === 'JEFE_DEPENDENCIA' || rol === 'ADMIN';
}

/** Puede cerrar un hallazgo o un plan de mejora. */
export function puedeCerrarHallazgoOPlan(rol: RolInterno): boolean {
  return rol === 'CONTROL_INTERNO' || rol === 'ADMIN';
}

/** Puede exportar reportes de Control Interno. */
export function puedeExportarReporteControlInterno(rol: RolInterno): boolean {
  return rol === 'CONTROL_INTERNO' || rol === 'ADMIN';
}

/**
 * Acciones operativas vetadas a Control Interno (responder, modificar respuesta,
 * eliminar radicado, etc.). Se valida en backend en cada API operativa.
 */
export function esRolSoloAuditoria(rol: RolInterno): boolean {
  return rol === 'CONTROL_INTERNO';
}
