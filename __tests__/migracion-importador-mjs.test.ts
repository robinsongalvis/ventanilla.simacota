/**
 * Ejecutor "tonto" del importador de históricos — contrato del script
 * `.mjs` (no importa TS; se prueba importando sus funciones puras
 * exportadas, mismo patrón que `presupuesto-rendimiento.mjs`/
 * `detectar-consecutivos-fantasma.mjs`).
 */
import { describe, it, expect } from 'vitest';
import {
  assertPathSeguro,
  tabularPorMotivo,
  construirActuacionRadicacion,
} from '@/scripts/migracion/importar-consecutivo-licencias.mjs';

describe('assertPathSeguro — DF-9, jamás toca counters/ ni unicidad_expedientes/', () => {
  it('lanza para cualquier path bajo counters/', () => {
    expect(() => assertPathSeguro('counters/expedientes-2026')).toThrow(/BLOQUEADO/);
  });
  it('lanza para cualquier path bajo unicidad_expedientes/', () => {
    expect(() => assertPathSeguro('unicidad_expedientes/68745-0-26-0001')).toThrow(/BLOQUEADO/);
  });
  it('permite expedientes/... y sus subcolecciones', () => {
    expect(() => assertPathSeguro('expedientes/hist-2026-2')).not.toThrow();
    expect(() => assertPathSeguro('expedientes/hist-2026-2/actuaciones/x')).not.toThrow();
  });
});

describe('tabularPorMotivo — tabulación trivial (no decide, solo cuenta)', () => {
  it('cuenta cada motivo across varios registros, un registro con varios motivos cuenta en cada uno', () => {
    const conteos = tabularPorMotivo([
      { motivos: ['ESTADO_PENDIENTE_P4', 'IDENTIDAD_INCOMPLETA'] },
      { motivos: ['ESTADO_PENDIENTE_P4'] },
      { motivos: ['CODIGO_PENDIENTE_P1'] },
    ]);
    expect(conteos.get('ESTADO_PENDIENTE_P4')).toBe(2);
    expect(conteos.get('IDENTIDAD_INCOMPLETA')).toBe(1);
    expect(conteos.get('CODIGO_PENDIENTE_P1')).toBe(1);
  });
});

describe('construirActuacionRadicacion — actuación RECONSTRUIDA, campos triviales copiados del expediente', () => {
  it('tipo/etapa/origen fijos; fecha = creadoEn del expediente (no "ahora")', () => {
    const expediente = {
      id: 'hist-2026-2', tenantId: 'SEC_PLANEACION', creadoEn: '2026-01-06T17:00:00.000Z',
      provenance: { hoja: '2026', fila: 2 },
    };
    const act = construirActuacionRadicacion(expediente, '2026-08-09T20:00:00.000Z');
    expect(act.tipo).toBe('radicacion-debida-forma');
    expect(act.etapa).toBe('radicacion');
    expect(act.origen).toBe('RECONSTRUIDO');
    expect(act.fecha).toBe('2026-01-06T17:00:00.000Z');
    expect(act.expedienteId).toBe('hist-2026-2');
    expect(act.tenantId).toBe('SEC_PLANEACION');
    expect(act.detalle).toContain('hoja 2026, fila 2');
  });
});
