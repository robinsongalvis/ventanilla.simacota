import { describe, expect, it } from 'vitest';
import { esCandidatoMigracion } from '../scripts/migrar-telefono-legacy';

/* ══════════════════════════════════════════════════════════════
   Sprint 1.5 — script scripts/migrar-telefono-legacy.ts

   Tests puros sobre el filtro `esCandidatoMigracion`. No tocan
   Firestore ni ejecutan el script; solo verifican la única pieza
   de lógica de negocio del script (la que decide si un documento
   debe migrarse).
══════════════════════════════════════════════════════════════ */

describe('migrar-telefono-legacy · esCandidatoMigracion', () => {
  /* 1 */
  it('es candidato si tiene telefono y telefonoMovil está ausente', () => {
    expect(esCandidatoMigracion({ telefono: '3001234567' })).toBe(true);
  });

  /* 2 */
  it('es candidato si tiene telefono y telefonoMovil es null', () => {
    expect(esCandidatoMigracion({ telefono: '3001234567', telefonoMovil: null })).toBe(true);
  });

  /* 3 */
  it('es candidato si tiene telefono y telefonoMovil es cadena vacía o espacios', () => {
    expect(esCandidatoMigracion({ telefono: '3001234567', telefonoMovil: '' })).toBe(true);
    expect(esCandidatoMigracion({ telefono: '3001234567', telefonoMovil: '   ' })).toBe(true);
  });

  /* 4 */
  it('NO es candidato si telefonoMovil ya tiene valor', () => {
    expect(esCandidatoMigracion({ telefono: '3001234567', telefonoMovil: '3009999999' })).toBe(false);
    expect(esCandidatoMigracion({ telefono: '3001234567', telefonoMovil: ' 3007777777 ' })).toBe(false);
  });

  /* 5 */
  it('NO es candidato si telefono está ausente, null o vacío', () => {
    expect(esCandidatoMigracion({})).toBe(false);
    expect(esCandidatoMigracion({ telefono: null })).toBe(false);
    expect(esCandidatoMigracion({ telefono: '' })).toBe(false);
    expect(esCandidatoMigracion({ telefono: '   ' })).toBe(false);
    expect(esCandidatoMigracion({ telefono: null, telefonoMovil: null })).toBe(false);
  });
});
