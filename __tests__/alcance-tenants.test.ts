import { describe, expect, it } from 'vitest';
import { puedeVerTodosLosTenants } from '@/lib/permisos/alcance-tenants';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 1 — alcance de visibilidad por rol.

   Un test por rol. Documenta la política completa del sistema:
   la Ventanilla Única (RECEPCIONISTA) es la cara del municipio y
   ve todos los tenants — igual que ya lo permitían firestore.rules
   y la búsqueda avanzada. Funcionario y Jefe siguen limitados a su
   dependencia.
══════════════════════════════════════════════════════════════ */

describe('Panel Op Nivel 1 — puedeVerTodosLosTenants', () => {
  /* 1 */
  it('ADMIN ve todos los tenants', () => {
    expect(puedeVerTodosLosTenants('ADMIN')).toBe(true);
  });

  /* 2 */
  it('CONTROL_INTERNO ve todos los tenants', () => {
    expect(puedeVerTodosLosTenants('CONTROL_INTERNO')).toBe(true);
  });

  /* 3 — el cambio de este sprint: la Ventanilla ve el municipio entero. */
  it('RECEPCIONISTA ve todos los tenants (alineado con firestore.rules y búsqueda avanzada)', () => {
    expect(puedeVerTodosLosTenants('RECEPCIONISTA')).toBe(true);
  });

  /* 4 */
  it('FUNCIONARIO solo ve su dependencia', () => {
    expect(puedeVerTodosLosTenants('FUNCIONARIO')).toBe(false);
  });

  /* 5 */
  it('JEFE_DEPENDENCIA solo ve su dependencia', () => {
    expect(puedeVerTodosLosTenants('JEFE_DEPENDENCIA')).toBe(false);
  });
});
