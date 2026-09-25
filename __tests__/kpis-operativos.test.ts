import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  calcularKpisOperativos,
  fechaResolucion,
  fechaYmdColombia,
} from '@/lib/kpis-operativos/calcular-kpis-operativos';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 2 — calculadora de KPIs operativos.

   Todos los tests inyectan `ahora` como fecha fija para evitar
   fragilidad respecto al reloj real del sistema.
══════════════════════════════════════════════════════════════ */

// Referencia: 2 jul 2026 15:00 UTC → 2 jul 2026 10:00 Colombia (UTC-5).
const AHORA = new Date('2026-07-02T15:00:00.000Z');

function daysAgoIso(dias: number, hora = 'T09:00:00.000Z'): string {
  const d = new Date(AHORA);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10) + hora;
}

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-OFICIO-2026-00000042',
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
      radicadoId:     '1-OFICIO-2026-00000042',
      consecutivo:    42,
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

const archivoPdf = (path: string, sellado: boolean = false) => ({
  nombre:    path,
  path,
  tipo:      'application/pdf',
  tamanioKB: 100,
  orden:     1,
  ...(sellado ? {
    sellado: {
      path: `sellados/x/${path}`, nombre: path, tamanioKB: 100,
      fecha: AHORA.toISOString(), actorUid: 'u',
      hashOriginal: 'h1', hashSellado: 'h2', paginasEstampadas: 1,
    },
  } : {}),
});

describe('Panel Op Fase 2 — calcularKpisOperativos', () => {
  /* 1 · KPI "Hoy": cuenta radicados con fechaRadicado en día colombiano */
  it('cuenta radicados de hoy (día colombiano)', () => {
    const dataset = [
      radicadoBase({ radicadoId: 'A', control: { ...radicadoBase().control, fechaRadicado: AHORA.toISOString() } }),
      radicadoBase({ radicadoId: 'B', control: { ...radicadoBase().control, fechaRadicado: daysAgoIso(1) } }),
      radicadoBase({ radicadoId: 'C', control: { ...radicadoBase().control, fechaRadicado: daysAgoIso(2) } }),
    ];
    const k = calcularKpisOperativos(dataset, AHORA);
    expect(k.hoy).toBe(1);
  });

  /* 2 · KPI "Sin asignar": PENDIENTE sin funcionarioResponsableUid */
  it('cuenta PENDIENTE sin responsable como sin asignar', () => {
    const dataset = [
      radicadoBase({ estadoActual: 'PENDIENTE' }), // sin uid → cuenta
      radicadoBase({ estadoActual: 'PENDIENTE', clasificacion: {
        oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO',
        funcionarioResponsableUid: 'uid-abc',
      }}),
      radicadoBase({ estadoActual: 'ASIGNADO' }),
    ];
    const k = calcularKpisOperativos(dataset, AHORA);
    expect(k.sinAsignar).toBe(1);
  });

  /* 3 · KPI "Sin sellar": activos con PDF sin sello y en ventana de 30 días */
  it('cuenta radicados activos con PDF sin sellar en los últimos 30 días', () => {
    const dataset = [
      // Activo reciente con PDF sin sellar → cuenta
      radicadoBase({ estadoActual: 'EN_PROCESO', archivos: [archivoPdf('a.pdf')] }),
      // Activo reciente pero PDF ya sellado → no cuenta
      radicadoBase({ estadoActual: 'EN_PROCESO', archivos: [archivoPdf('b.pdf', true)] }),
      // Activo pero fuera de la ventana de 30 días → no cuenta
      radicadoBase({ estadoActual: 'EN_PROCESO',
        control: { ...radicadoBase().control, fechaRadicado: daysAgoIso(45) },
        archivos: [archivoPdf('c.pdf')] }),
      // Resuelto reciente con PDF sin sellar → no cuenta (no está activo)
      radicadoBase({ estadoActual: 'RESUELTO', archivos: [archivoPdf('d.pdf')] }),
    ];
    const k = calcularKpisOperativos(dataset, AHORA);
    expect(k.sinSellar).toBe(1);
  });

  /* 4 · KPI "Correo fallido": bandera raíz alertaNotificacionFallida */
  it('cuenta radicados con alertaNotificacionFallida === true', () => {
    const dataset = [
      radicadoBase({ alertaNotificacionFallida: true }),
      radicadoBase({ alertaNotificacionFallida: false }),
      radicadoBase({}), // undefined también no cuenta
    ];
    const k = calcularKpisOperativos(dataset, AHORA);
    expect(k.correoFallido).toBe(1);
  });

  /* 5 · KPI "Resueltos hoy": usa respuestaOficial.fecha como fuente principal */
  it('cuenta resueltos hoy usando respuestaOficial.fecha', () => {
    const dataset = [
      radicadoBase({
        estadoActual: 'RESUELTO',
        respuestaOficial: {
          archivoPath: null, archivoNombre: null, nota: 'ok',
          fecha: AHORA.toISOString(),
          actorUid: 'u', actorNombre: 'F',
        },
      }),
      // Resuelto ayer
      radicadoBase({
        estadoActual: 'RESUELTO',
        respuestaOficial: {
          archivoPath: null, archivoNombre: null, nota: 'ok',
          fecha: daysAgoIso(1),
          actorUid: 'u', actorNombre: 'F',
        },
      }),
    ];
    const k = calcularKpisOperativos(dataset, AHORA);
    expect(k.resueltosHoy).toBe(1);
  });

  /* 6 · KPI "Resueltos hoy" con fallback a ultimaActualizacion */
  it('usa ultimaActualizacion como fallback para históricos sin respuestaOficial', () => {
    const dataset = [
      // Sin respuestaOficial pero RESUELTO hoy → cuenta por fallback
      radicadoBase({
        estadoActual: 'RESUELTO',
        ultimaActualizacion: AHORA.toISOString(),
        respuestaOficial: null,
      }),
      // Activo (no cuenta como resuelto pese a ultimaActualizacion hoy)
      radicadoBase({
        estadoActual: 'EN_PROCESO',
        ultimaActualizacion: AHORA.toISOString(),
      }),
    ];
    const k = calcularKpisOperativos(dataset, AHORA);
    expect(k.resueltosHoy).toBe(1);
  });

  /* 7 · fechaYmdColombia: convierte a día colombiano correcto respecto de UTC */
  it('fechaYmdColombia respeta zona América/Bogotá', () => {
    // 2026-07-02T02:00:00 UTC = 2026-07-01 21:00 Colombia (día anterior).
    expect(fechaYmdColombia('2026-07-02T02:00:00.000Z')).toBe('2026-07-01');
    // 2026-07-02T15:00:00 UTC = 2026-07-02 10:00 Colombia (mismo día).
    expect(fechaYmdColombia('2026-07-02T15:00:00.000Z')).toBe('2026-07-02');
    // Fecha inválida → string vacío.
    expect(fechaYmdColombia('no-es-fecha')).toBe('');
  });

  /* 8 · fechaResolucion: fuente primaria + fallback + null */
  it('fechaResolucion: primaria respuestaOficial, fallback ultimaActualizacion', () => {
    const conRespuesta = radicadoBase({
      estadoActual: 'RESUELTO',
      respuestaOficial: {
        archivoPath: null, archivoNombre: null, nota: '',
        fecha: '2026-06-30T08:00:00.000Z',
        actorUid: 'u', actorNombre: 'F',
      },
    });
    expect(fechaResolucion(conRespuesta)).toBe('2026-06-30T08:00:00.000Z');

    const soloEstadoResuelto = radicadoBase({
      estadoActual: 'RESUELTO',
      ultimaActualizacion: '2026-06-15T00:00:00.000Z',
      respuestaOficial: null,
    });
    expect(fechaResolucion(soloEstadoResuelto)).toBe('2026-06-15T00:00:00.000Z');

    const activo = radicadoBase({ estadoActual: 'EN_PROCESO', respuestaOficial: null });
    expect(fechaResolucion(activo)).toBe(null);
  });
});
