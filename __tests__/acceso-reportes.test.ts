import { describe, expect, it } from 'vitest';
import { puedeVerReportes } from '@/lib/permisos/acceso-reportes';

/* ══════════════════════════════════════════════════════════════
   Sprint 3C · Reportes — acceso al módulo.

   RECEPCIONISTA entra (responde por todo el municipio); FUNCIONARIO
   sigue fuera. Analytics no usa este helper y no cambia.
══════════════════════════════════════════════════════════════ */

describe('3C Reportes — puedeVerReportes', () => {
  /* 1 · roles con acceso, incluida la recepcionista */
  it('permite ADMIN, CONTROL_INTERNO, JEFE_DEPENDENCIA y RECEPCIONISTA', () => {
    expect(puedeVerReportes('ADMIN')).toBe(true);
    expect(puedeVerReportes('CONTROL_INTERNO')).toBe(true);
    expect(puedeVerReportes('JEFE_DEPENDENCIA')).toBe(true);
    expect(puedeVerReportes('RECEPCIONISTA')).toBe(true);
  });

  /* 2 · funcionario de dependencia sigue fuera */
  it('niega FUNCIONARIO', () => {
    expect(puedeVerReportes('FUNCIONARIO')).toBe(false);
  });
});
