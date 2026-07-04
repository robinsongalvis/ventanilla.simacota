import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  filtrarPorPreset,
  indicadoresDeReporte,
  rangoDePreset,
  resumenPorDependencia,
} from '@/lib/reportes/filtrar-por-preset';

/* ══════════════════════════════════════════════════════════════
   Sprint 3C · Reportes — presets de período e indicadores.

   Referencia fija: jueves 2 jul 2026 15:00 UTC → 10:00 Colombia.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function radicado(
  id: string,
  fechaRadicado: string,
  overrides: Partial<VentanillaRadicado> = {},
): VentanillaRadicado {
  return {
    radicadoId:          id,
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: fechaRadicado,
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1098765432',
      nombreCompleto:  'Juan Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     id,
      consecutivo:    1,
      fechaRadicado,
      horaRadicado:   '10:00',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    '2026-07-20T09:00:00.000Z',
      prorrogasAplicadas:  0,
    },
    clasificacion: { oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Solicitud', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

describe('3C Reportes — rangoDePreset', () => {
  /* 1 · los cortes calendario en día colombiano */
  it('calcula los rangos de cada preset', () => {
    expect(rangoDePreset('HOY', AHORA)).toEqual({ desde: '2026-07-02', hasta: '2026-07-02' });
    // 2 jul 2026 es jueves → la semana empezó el lunes 29 jun.
    expect(rangoDePreset('ESTA_SEMANA', AHORA)).toEqual({ desde: '2026-06-29', hasta: '2026-07-02' });
    expect(rangoDePreset('ESTE_MES', AHORA)).toEqual({ desde: '2026-07-01', hasta: '2026-07-02' });
    expect(rangoDePreset('MES_PASADO', AHORA)).toEqual({ desde: '2026-06-01', hasta: '2026-06-30' });
    expect(rangoDePreset('TODO', AHORA)).toBeNull();
  });
});

describe('3C Reportes — filtrarPorPreset', () => {
  const dataset = [
    radicado('HOY-1',        '2026-07-02T14:00:00.000Z'),
    // 02:00 UTC del 2 jul = 21:00 Colombia del 1 jul → cuenta como 1 jul.
    radicado('AYER-UTC',     '2026-07-02T02:00:00.000Z'),
    radicado('MES-PASADO-1', '2026-06-15T14:00:00.000Z'),
    radicado('VIEJO-1',      '2026-01-10T14:00:00.000Z', {
      clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
    }),
  ];

  /* 2 · HOY corta por día colombiano, no UTC */
  it('HOY incluye solo el día calendario colombiano', () => {
    const r = filtrarPorPreset(dataset, 'HOY', 'TODAS', AHORA);
    expect(r.map((x) => x.radicadoId)).toEqual(['HOY-1']);
  });

  /* 3 · ESTE_MES y MES_PASADO respetan los bordes */
  it('ESTE_MES y MES_PASADO cortan por mes calendario', () => {
    expect(filtrarPorPreset(dataset, 'ESTE_MES', 'TODAS', AHORA).map((x) => x.radicadoId))
      .toEqual(['HOY-1', 'AYER-UTC']);
    expect(filtrarPorPreset(dataset, 'MES_PASADO', 'TODAS', AHORA).map((x) => x.radicadoId))
      .toEqual(['MES-PASADO-1']);
  });

  /* 4 · TODO devuelve el histórico completo */
  it('TODO no filtra por fecha', () => {
    expect(filtrarPorPreset(dataset, 'TODO', 'TODAS', AHORA)).toHaveLength(4);
  });

  /* 5 · el filtro de dependencia se combina con el período */
  it('filtra por dependencia destino', () => {
    const r = filtrarPorPreset(dataset, 'TODO', 'SEC_PLANEACION', AHORA);
    expect(r.map((x) => x.radicadoId)).toEqual(['VIEJO-1']);
  });
});

describe('3C Reportes — indicadoresDeReporte', () => {
  /* 6 · cuenta estados, vencidas y cumplimiento */
  it('calcula los indicadores del subconjunto', () => {
    const dataset = [
      radicado('P1', '2026-07-01T14:00:00.000Z'),
      radicado('A1', '2026-07-01T14:00:00.000Z', { estadoActual: 'ASIGNADO' }),
      radicado('V1', '2026-07-01T14:00:00.000Z', {
        estadoActual: 'EN_PROCESO',
        termino: { ...radicado('x', '2026-07-01T14:00:00.000Z').termino, fechaVencimiento: '2026-06-20T09:00:00.000Z' },
      }),
      radicado('R1', '2026-07-01T14:00:00.000Z', { estadoActual: 'RESUELTO', cumplioTermino: true }),
      radicado('R2', '2026-07-01T14:00:00.000Z', { estadoActual: 'RESUELTO', cumplioTermino: false }),
    ];
    const i = indicadoresDeReporte(dataset, AHORA);
    expect(i.total).toBe(5);
    expect(i.radicadas).toBe(1);
    expect(i.asignadas).toBe(2);
    expect(i.vencidas).toBe(1);
    expect(i.resueltos).toBe(2);
    expect(i.pctCumplimiento).toBe(50);
  });

  /* 7 · sin datos de cumplimiento el porcentaje es null */
  it('pctCumplimiento null cuando ningún resuelto trae el dato', () => {
    const i = indicadoresDeReporte([radicado('P1', '2026-07-01T14:00:00.000Z')], AHORA);
    expect(i.pctCumplimiento).toBeNull();
  });
});

describe('3C Reportes — resumenPorDependencia', () => {
  /* 8 · agrupa por oficina y ordena por volumen */
  it('agrupa por dependencia con totales y ordena descendente', () => {
    const dataset = [
      radicado('V1', '2026-07-01T14:00:00.000Z'),
      radicado('V2', '2026-07-01T14:00:00.000Z', { estadoActual: 'RESUELTO' }),
      radicado('PL1', '2026-07-01T14:00:00.000Z', {
        estadoActual: 'ASIGNADO',
        clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
      }),
    ];
    const filas = resumenPorDependencia(dataset, AHORA);
    expect(filas[0].oficina).toBe('VENTANILLA_UNICA');
    expect(filas[0].total).toBe(2);
    expect(filas[0].pendientes).toBe(1);
    expect(filas[0].resueltos).toBe(1);
    expect(filas[1].oficina).toBe('SEC_PLANEACION');
    expect(filas[1].enTramite).toBe(1);
  });
});
