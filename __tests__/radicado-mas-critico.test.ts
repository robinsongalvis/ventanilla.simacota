import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { radicadoMasCriticoPorFiltro } from '@/lib/kpis-mipg/radicado-mas-critico';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 3B — radicado más crítico por KPI grande.

   Un test por criterio (VENCIDAS, POR_VENCER, RADICADAS, ASIGNADAS)
   + grupo vacío + no exposición de identidad.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function venceEnDias(dias: number): string {
  // Vencimiento aproximado en calendario; el helper cuenta hábiles,
  // pero el orden relativo entre radicados se preserva.
  const d = new Date(AHORA);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

function fechaRadicadoHaceDias(dias: number): string {
  const d = new Date(AHORA);
  d.setDate(d.getDate() - dias);
  return d.toISOString();
}

function radicado(
  overrides: Partial<VentanillaRadicado> & { radicadoId: string },
): VentanillaRadicado {
  const { radicadoId, ...rest } = overrides;
  return {
    radicadoId,
    estadoActual:        'EN_PROCESO',
    ultimaActualizacion: AHORA.toISOString(),
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1098765432',
      nombreCompleto:  'NOMBRE NO DEBE APARECER',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId,
      consecutivo:    1,
      fechaRadicado:  AHORA.toISOString(),
      horaRadicado:   '10:00',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    venceEnDias(10),
      prorrogasAplicadas:  0,
    },
    clasificacion: { oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Asunto', descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
    ...rest,
  };
}

describe('Panel Op Nivel 3B — radicadoMasCriticoPorFiltro', () => {
  /* 1 · VENCIDAS: el que lleva más tiempo vencido */
  it('VENCIDAS destaca el más atrasado (menor días restantes)', () => {
    const dataset = [
      radicado({ radicadoId: 'V1', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(-2) } }),
      radicado({ radicadoId: 'V2', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(-10) } }),
      radicado({ radicadoId: 'ACTIVO', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(5) } }),
    ];
    const c = radicadoMasCriticoPorFiltro(dataset, 'VENCIDAS', AHORA);
    expect(c?.radicadoId).toBe('V2');
    expect(c?.razon).toMatch(/venció hace/i);
    expect(c?.diasRestantes).toBeLessThan(0);
  });

  /* 2 · POR_VENCER: el que vence primero */
  it('POR_VENCER destaca el que vence primero (0-2 días)', () => {
    const dataset = [
      radicado({ radicadoId: 'PV2', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(2) } }),
      radicado({ radicadoId: 'PV0', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(0) } }),
      radicado({ radicadoId: 'LEJOS', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(10) } }),
    ];
    const c = radicadoMasCriticoPorFiltro(dataset, 'POR_VENCER', AHORA);
    expect(c?.radicadoId).toBe('PV0');
  });

  /* 3 · RADICADAS: el más antiguo sin asignar */
  it('RADICADAS destaca el PENDIENTE más antiguo', () => {
    const dataset = [
      radicado({ radicadoId: 'R_NUEVO', estadoActual: 'PENDIENTE',
        control: { ...radicado({ radicadoId: 'x' }).control, fechaRadicado: fechaRadicadoHaceDias(1) } }),
      radicado({ radicadoId: 'R_VIEJO', estadoActual: 'PENDIENTE',
        control: { ...radicado({ radicadoId: 'x' }).control, fechaRadicado: fechaRadicadoHaceDias(5) } }),
      radicado({ radicadoId: 'ASIGNADO', estadoActual: 'ASIGNADO' }),
    ];
    const c = radicadoMasCriticoPorFiltro(dataset, 'RADICADAS', AHORA);
    expect(c?.radicadoId).toBe('R_VIEJO');
    expect(c?.razon).toMatch(/hace 5 d/i);
  });

  /* 4 · ASIGNADAS: el más próximo a vencer */
  it('ASIGNADAS destaca el más próximo a vencer', () => {
    const dataset = [
      radicado({ radicadoId: 'A_LEJOS', estadoActual: 'ASIGNADO', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(8) } }),
      radicado({ radicadoId: 'A_CERCA', estadoActual: 'EN_REVISION', termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(3) } }),
      radicado({ radicadoId: 'PENDIENTE', estadoActual: 'PENDIENTE' }),
    ];
    const c = radicadoMasCriticoPorFiltro(dataset, 'ASIGNADAS', AHORA);
    expect(c?.radicadoId).toBe('A_CERCA');
  });

  /* 5 · Grupo vacío → null */
  it('devuelve null cuando el grupo está vacío', () => {
    const dataset = [radicado({ radicadoId: 'X', estadoActual: 'RESUELTO' })];
    expect(radicadoMasCriticoPorFiltro(dataset, 'VENCIDAS', AHORA)).toBeNull();
    expect(radicadoMasCriticoPorFiltro([], 'RADICADAS', AHORA)).toBeNull();
  });

  /* 6 · NUNCA expone nombre del solicitante (identidad protegida) */
  it('el resultado no incluye el nombre del solicitante', () => {
    const dataset = [radicado({ radicadoId: 'V1', identidadReservada: true,
      termino: { ...radicado({ radicadoId: 'x' }).termino, fechaVencimiento: venceEnDias(-1) } })];
    const c = radicadoMasCriticoPorFiltro(dataset, 'VENCIDAS', AHORA);
    expect(JSON.stringify(c)).not.toContain('NOMBRE NO DEBE APARECER');
    expect(c).toHaveProperty('oficinaDestino');
  });
});
