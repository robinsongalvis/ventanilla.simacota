import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ACTIVOS,
  ESTADOS_CERRADOS,
  esEstadoActivo,
  esEstadoCerrado,
} from '@/lib/radicado-estados';

/* OAT-05 — fuente única de la máquina de estados del radicado. */
describe('radicado-estados (OAT-05)', () => {
  it('los estados activos son los del trámite en curso', () => {
    for (const e of ['PENDIENTE', 'ASIGNADO', 'EN_REVISION', 'EN_PROCESO', 'DEVUELTO', 'PRORROGA']) {
      expect(esEstadoActivo(e)).toBe(true);
    }
  });

  it('los estados cerrados no son activos y viceversa', () => {
    for (const e of ['RESUELTO', 'RECHAZADO']) {
      expect(esEstadoCerrado(e)).toBe(true);
      expect(esEstadoActivo(e)).toBe(false);
    }
  });

  it('activos y cerrados son conjuntos disjuntos', () => {
    for (const e of ESTADOS_ACTIVOS) expect(ESTADOS_CERRADOS.has(e)).toBe(false);
  });

  it('un estado desconocido no es ni activo ni cerrado', () => {
    expect(esEstadoActivo('INEXISTENTE')).toBe(false);
    expect(esEstadoCerrado('INEXISTENTE')).toBe(false);
  });
});
