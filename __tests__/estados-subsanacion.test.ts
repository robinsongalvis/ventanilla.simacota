import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  esEstadoActivo,
  esEstadoCerrado,
  tieneTerminoSuspendido,
} from '@/lib/radicado-estados';
import { calcularProximaAccion } from '@/lib/proxima-accion/calcular-proxima-accion';
import { mapEstadoCiudadano } from '@/lib/seguridad/consulta-publica-radicado';

/* ══════════════════════════════════════════════════════════════
   BM-B33 pieza (2) — estados EN_SUBSANACION / DESISTIDO.
   Contrato de no-regresión de QA (CPR-8.x) + Seguridad (#7):
   EN_SUBSANACION = activo con reloj DETENIDO; DESISTIDO = cerrado.
══════════════════════════════════════════════════════════════ */

/** Radicado mínimo para próxima-acción. */
function radicado(estado: string, fechaVencimiento: string): VentanillaRadicado {
  return {
    estadoActual: estado,
    termino: { fechaVencimiento },
    clasificacion: { funcionarioResponsableUid: 'u1' },
  } as unknown as VentanillaRadicado;
}

describe('clasificación de los estados nuevos (OAT-05)', () => {
  it('EN_SUBSANACION es activo y con término suspendido', () => {
    expect(esEstadoActivo('EN_SUBSANACION')).toBe(true);
    expect(tieneTerminoSuspendido('EN_SUBSANACION')).toBe(true);
    expect(esEstadoCerrado('EN_SUBSANACION')).toBe(false);
  });

  it('DESISTIDO es cerrado, no activo, no suspendido', () => {
    expect(esEstadoCerrado('DESISTIDO')).toBe(true);
    expect(esEstadoActivo('DESISTIDO')).toBe(false);
    expect(tieneTerminoSuspendido('DESISTIDO')).toBe(false);
  });
});

describe('próxima acción — el reloj no corre en subsanación (CPR-8.2 / Seg. #7)', () => {
  const ayer = new Date(Date.now() - 3 * 86400000).toISOString();

  it('EN_SUBSANACION con vencimiento PASADO NO reporta VENCIDO', () => {
    const pa = calcularProximaAccion(radicado('EN_SUBSANACION', ayer));
    expect(pa.ruleId).toBe('EN_SUBSANACION');
    expect(pa.ruleId).not.toBe('VENCIDO');
  });

  it('un radicado activo normal con vencimiento pasado SÍ reporta VENCIDO (control)', () => {
    const pa = calcularProximaAccion(radicado('EN_PROCESO', ayer));
    expect(pa.ruleId).toBe('VENCIDO');
  });

  it('DESISTIDO no tiene acción pendiente', () => {
    const pa = calcularProximaAccion(radicado('DESISTIDO', ayer));
    expect(pa.ruleId).toBe('DESISTIDO');
    expect(pa.urgencia).toBe('ninguna');
  });
});

describe('mapeo hacia el ciudadano', () => {
  it('EN_SUBSANACION → requiere_aclaracion; DESISTIDO → cerrado', () => {
    expect(mapEstadoCiudadano('EN_SUBSANACION', false)).toBe('requiere_aclaracion');
    expect(mapEstadoCiudadano('DESISTIDO', false)).toBe('cerrado');
  });
});
