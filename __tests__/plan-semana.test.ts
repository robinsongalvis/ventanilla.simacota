import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { planDeSemana } from '@/lib/mi-gestion/plan-semana';

/* ══════════════════════════════════════════════════════════════
   Sprint Semana + badge — distribución de vencimientos de la semana.

   Referencia fija: jueves 2 jul 2026 15:00 UTC → 10:00 Colombia.
   La semana actual va del lunes 29 jun al domingo 5 jul.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');
const UID = 'uid-camila';

let n = 0;
function radicado(fechaVencimiento: string, overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  n += 1;
  const id = `1-WEB-2026-${String(n).padStart(8, '0')}`;
  return {
    radicadoId: id,
    estadoActual: 'ASIGNADO',
    ultimaActualizacion: AHORA.toISOString(),
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL', tipoDocumento: 'CC', numeroDocumento: '1',
      nombreCompleto: 'Juan Pérez',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: id, consecutivo: n, fechaRadicado: '2026-06-20T14:00:00.000Z',
      horaRadicado: '09:00', medioRecepcion: 'PRESENCIAL', origen: 'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL', tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15, unidad: 'HABILES',
      fechaVencimiento, prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: UID,
    },
    detalle: { asunto: 'Solicitud', descripcion: 'D', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

describe('Semana + badge — planDeSemana', () => {
  /* 1 · la semana arranca en lunes colombiano y hoy queda marcado */
  it('arma las 7 celdas de lunes 29 jun a domingo 5 jul con hoy = jueves', () => {
    const plan = planDeSemana([], UID, AHORA);
    expect(plan.dias).toHaveLength(7);
    expect(plan.dias[0]).toMatchObject({ ymd: '2026-06-29', etiqueta: 'Lun 29', esHoy: false });
    expect(plan.dias[3]).toMatchObject({ ymd: '2026-07-02', etiqueta: 'Jue 2', esHoy: true });
    expect(plan.dias[6]).toMatchObject({ ymd: '2026-07-05', etiqueta: 'Dom 5', esHoy: false });
  });

  /* 2 · cada vencimiento cae en su celda */
  it('cuenta los vencimientos por día de hoy en adelante', () => {
    const plan = planDeSemana([
      radicado('2026-07-02T20:00:00.000Z'),  // hoy jueves
      radicado('2026-07-03T09:00:00.000Z'),  // viernes
      radicado('2026-07-03T21:00:00.000Z'),  // viernes
    ], UID, AHORA);
    expect(plan.dias[3].vencen).toBe(1);
    expect(plan.dias[4].vencen).toBe(2);
    expect(plan.totalSemana).toBe(3);
  });

  /* 3 · lo ya vencido es deuda, no agenda — aunque caiga en esta semana */
  it('manda a vencidos lo anterior a hoy, incluso el martes de esta semana', () => {
    const plan = planDeSemana([
      radicado('2026-06-30T09:00:00.000Z'),  // martes de esta semana, ya pasó
      radicado('2026-06-20T09:00:00.000Z'),  // semana anterior
    ], UID, AHORA);
    expect(plan.vencidos).toBe(2);
    expect(plan.dias[1].vencen).toBe(0);
    expect(plan.totalSemana).toBe(0);
  });

  /* 4 · lo que cae después del domingo es un solo número */
  it('agrupa en despues lo que vence pasada la semana', () => {
    const plan = planDeSemana([radicado('2026-07-20T09:00:00.000Z')], UID, AHORA);
    expect(plan.despues).toBe(1);
    expect(plan.totalSemana).toBe(0);
  });

  /* 5 · la medianoche colombiana manda: 8 pm del domingo (01:00Z lunes) es del domingo */
  it('un vencimiento del domingo 5 a las 8 pm Colombia cae en el domingo', () => {
    const plan = planDeSemana([radicado('2026-07-06T01:00:00.000Z')], UID, AHORA);
    expect(plan.dias[6].vencen).toBe(1);
    expect(plan.despues).toBe(0);
  });

  /* 6 · ignora lo de otros, lo resuelto y lo sin término */
  it('solo cuenta activos del uid con fecha de vencimiento', () => {
    const deOtro = radicado('2026-07-03T09:00:00.000Z', {
      clasificacion: { oficinaDestino: 'SEC_GOBIERNO', zonaGeografica: 'CASCO_URBANO', funcionarioResponsableUid: 'uid-otra' },
    });
    const resuelto = radicado('2026-07-03T09:00:00.000Z', { estadoActual: 'RESUELTO' });
    const sinTermino = radicado('', {});
    const plan = planDeSemana([deOtro, resuelto, sinTermino], UID, AHORA);
    expect(plan.totalSemana).toBe(0);
    expect(plan.vencidos).toBe(0);
    expect(plan.despues).toBe(0);
  });
});
