import type { RolInterno } from '@/lib/hooks/useAuth';

/**
 * Panel Operativo Nivel 1 — punto único de verdad sobre qué roles ven
 * radicados de TODOS los tenants en el dashboard en vivo.
 *
 * Alineación de políticas: `firestore.rules` (ventanilla_radicados) y
 * la búsqueda avanzada (`aplicarAlcanceRol` en lib/busqueda) ya
 * trataban a RECEPCIONISTA como "ve todo" — la Ventanilla Única es la
 * cara del municipio ante el ciudadano y debe poder responder sobre
 * radicados de cualquier dependencia. El hook del dashboard era la
 * única capa que la recortaba a su propio tenant; esta función
 * resuelve esa inconsistencia y deja la decisión en un solo lugar.
 *
 * FUNCIONARIO y JEFE_DEPENDENCIA siguen limitados a su dependencia
 * (multi-tenancy operativa intacta).
 */
export function puedeVerTodosLosTenants(rol: RolInterno): boolean {
  return rol === 'ADMIN' || rol === 'CONTROL_INTERNO' || rol === 'RECEPCIONISTA';
}
