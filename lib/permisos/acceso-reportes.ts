import type { RolInterno } from '@/lib/hooks/useAuth';

/**
 * Sprint 3C · Reportes — punto único de verdad sobre quién puede abrir
 * el módulo Reportes.
 *
 * RECEPCIONISTA entra: la Ventanilla Única es quien responde "¿qué
 * llegó este mes?" a cualquier dependencia, y los datos del reporte
 * son los mismos que su rol ya ve en el Tablero y en Dependencias —
 * aquí solo se presentan agregados y exportables. Misma lógica del
 * Nivel 1 ([[alcance-tenants]]).
 *
 * Analytics NO cambia: sigue gateado por analítica avanzada
 * (ADMIN, CONTROL_INTERNO, JEFE_DEPENDENCIA).
 */
export function puedeVerReportes(rol: RolInterno): boolean {
  return rol === 'ADMIN'
    || rol === 'CONTROL_INTERNO'
    || rol === 'JEFE_DEPENDENCIA'
    || rol === 'RECEPCIONISTA';
}
