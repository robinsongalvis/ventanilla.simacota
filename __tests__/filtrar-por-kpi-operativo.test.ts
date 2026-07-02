import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { filtrarPorKpiOperativo } from '@/lib/kpis-operativos/filtrar-por-kpi-operativo';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 2 — filtro operativo aplicado a la bandeja.
   Un test por cada filtro + caso NINGUNO.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function daysAgoIso(dias: number, hora = 'T09:00:00.000Z'): string {
  const d = new Date(AHORA);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10) + hora;
}

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          'A',
    estadoActual:        'PENDIENTE',
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
      nombreCompleto:  'Juan Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     'A',
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
      fechaVencimiento:    daysAgoIso(-10),
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino: 'VENTANILLA_UNICA',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: {
      asunto:       'Solicitud',
      descripcion:  'Descripción',
      numeroFolios: 1,
    },
    archivos: [],
    ...overrides,
  };
}

const archivoPdfSinSellar = {
  nombre: 'a.pdf', path: 'radicados/x/a.pdf',
  tipo: 'application/pdf', tamanioKB: 100, orden: 1,
};

describe('Panel Op Fase 2 — filtrarPorKpiOperativo', () => {
  /* 1 · NINGUNO devuelve la lista original */
  it('devuelve la misma lista cuando el filtro es NINGUNO', () => {
    const dataset = [radicadoBase({ radicadoId: 'A' }), radicadoBase({ radicadoId: 'B' })];
    const r = filtrarPorKpiOperativo(dataset, 'NINGUNO', AHORA);
    expect(r).toHaveLength(2);
  });

  /* 2 · HOY: filtra por día colombiano */
  it('HOY: deja solo los del día colombiano', () => {
    const dataset = [
      radicadoBase({ radicadoId: 'HOY' }),
      radicadoBase({
        radicadoId: 'AYER',
        control: { ...radicadoBase().control, fechaRadicado: daysAgoIso(1) },
      }),
    ];
    const r = filtrarPorKpiOperativo(dataset, 'HOY', AHORA);
    expect(r.map((x) => x.radicadoId)).toEqual(['HOY']);
  });

  /* 3 · SIN_ASIGNAR: PENDIENTE sin uid */
  it('SIN_ASIGNAR: deja PENDIENTE sin funcionarioResponsableUid', () => {
    const dataset = [
      radicadoBase({ radicadoId: 'X', estadoActual: 'PENDIENTE' }),
      radicadoBase({ radicadoId: 'Y', estadoActual: 'PENDIENTE',
        clasificacion: {
          oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO',
          funcionarioResponsableUid: 'uid',
        }}),
    ];
    const r = filtrarPorKpiOperativo(dataset, 'SIN_ASIGNAR', AHORA);
    expect(r.map((x) => x.radicadoId)).toEqual(['X']);
  });

  /* 4 · SIN_SELLAR: activos con PDF sin sellar en últimos 30 días */
  it('SIN_SELLAR: activos con PDF sin sellar en ventana de 30 días', () => {
    const dataset = [
      radicadoBase({ radicadoId: 'A', estadoActual: 'EN_PROCESO', archivos: [archivoPdfSinSellar] }),
      radicadoBase({ radicadoId: 'B', estadoActual: 'RESUELTO', archivos: [archivoPdfSinSellar] }),
      radicadoBase({
        radicadoId: 'C', estadoActual: 'EN_PROCESO',
        control: { ...radicadoBase().control, fechaRadicado: daysAgoIso(40) },
        archivos: [archivoPdfSinSellar],
      }),
    ];
    const r = filtrarPorKpiOperativo(dataset, 'SIN_SELLAR', AHORA);
    expect(r.map((x) => x.radicadoId)).toEqual(['A']);
  });

  /* 5 · CORREO_FALLIDO: alertaNotificacionFallida === true */
  it('CORREO_FALLIDO: deja solo los que tienen la bandera activa', () => {
    const dataset = [
      radicadoBase({ radicadoId: 'A', alertaNotificacionFallida: true }),
      radicadoBase({ radicadoId: 'B', alertaNotificacionFallida: false }),
    ];
    const r = filtrarPorKpiOperativo(dataset, 'CORREO_FALLIDO', AHORA);
    expect(r.map((x) => x.radicadoId)).toEqual(['A']);
  });

  /* 6 · RESUELTOS_HOY: usa respuestaOficial.fecha con fallback */
  it('RESUELTOS_HOY: usa respuestaOficial.fecha y fallback ultimaActualizacion', () => {
    const dataset = [
      radicadoBase({
        radicadoId: 'A', estadoActual: 'RESUELTO',
        respuestaOficial: {
          archivoPath: null, archivoNombre: null, nota: '',
          fecha: AHORA.toISOString(),
          actorUid: 'u', actorNombre: 'F',
        },
      }),
      radicadoBase({
        radicadoId: 'B', estadoActual: 'RESUELTO',
        ultimaActualizacion: AHORA.toISOString(),
        respuestaOficial: null,
      }),
      radicadoBase({
        radicadoId: 'C', estadoActual: 'RESUELTO',
        respuestaOficial: {
          archivoPath: null, archivoNombre: null, nota: '',
          fecha: daysAgoIso(1),
          actorUid: 'u', actorNombre: 'F',
        },
      }),
    ];
    const r = filtrarPorKpiOperativo(dataset, 'RESUELTOS_HOY', AHORA);
    expect(r.map((x) => x.radicadoId).sort()).toEqual(['A', 'B']);
  });
});
