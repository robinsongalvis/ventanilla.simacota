import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  filtrarTrabajoHoy,
  trabajoDeHoy,
} from '@/lib/mostrador/trabajo-de-hoy';

/* ══════════════════════════════════════════════════════════════
   Ventanilla · módulo de mostrador — helper trabajoDeHoy.

   Todos los tests inyectan `ahora` fija para evitar fragilidad
   respecto al reloj real. Referencia: 2 jul 2026 15:00 UTC →
   2 jul 2026 10:00 Colombia (UTC-5).
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000042',
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
      radicadoId:     '1-WEB-2026-00000042',
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
      fechaVencimiento:    '2026-07-20T09:00:00.000Z',
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

const pdfSinSellar = {
  nombre:    'oficio.pdf',
  path:      'radicados/x/oficio.pdf',
  tipo:      'application/pdf',
  tamanioKB: 100,
  orden:     1,
};

function conControl(fechaIso: string, hora: string, id = '1-WEB-2026-00000042') {
  return {
    radicadoId:     id,
    consecutivo:    42,
    fechaRadicado:  fechaIso,
    horaRadicado:   hora,
    medioRecepcion: 'PRESENCIAL' as const,
    origen:         'FISICO_ESCANER' as const,
  };
}

describe('Mostrador — trabajoDeHoy', () => {
  /* 1 · solo entra el día calendario colombiano de hoy */
  it('incluye solo radicados de hoy en día Colombia (no UTC)', () => {
    const hoy    = radicadoBase();
    const ayer   = radicadoBase({
      radicadoId: '1-WEB-2026-00000001',
      control:    conControl('2026-07-01T14:00:00.000Z', '09:00', '1-WEB-2026-00000001'),
    });
    // 02:00 UTC del 2 jul = 21:00 Colombia del 1 jul → NO es hoy.
    const madrugadaUtc = radicadoBase({
      radicadoId: '1-WEB-2026-00000002',
      control:    conControl('2026-07-02T02:00:00.000Z', '21:00', '1-WEB-2026-00000002'),
    });

    const { filas } = trabajoDeHoy([hoy, ayer, madrugadaUtc], AHORA);
    expect(filas.map((f) => f.radicadoId)).toEqual(['1-WEB-2026-00000042']);
  });

  /* 2 · detecta cada tipo de pendiente con la misma semántica de los KPIs */
  it('marca SELLAR_PDF, DATOS_INCOMPLETOS y CORREO_FALLIDO', () => {
    const sinSellar = radicadoBase({ archivos: [pdfSinSellar] });
    const sinDatos  = radicadoBase({
      radicadoId:  '1-WEB-2026-00000043',
      control:     conControl(AHORA.toISOString(), '10:05', '1-WEB-2026-00000043'),
      solicitante: { ...radicadoBase().solicitante, datosNoAportados: { telefono: true } },
    });
    const correo = radicadoBase({
      radicadoId: '1-WEB-2026-00000044',
      control:    conControl(AHORA.toISOString(), '10:10', '1-WEB-2026-00000044'),
      alertaNotificacionFallida: true,
    });

    const { filas, conteos } = trabajoDeHoy([sinSellar, sinDatos, correo], AHORA);
    expect(filas[0].pendientes).toEqual(['SELLAR_PDF']);
    expect(filas[1].pendientes).toEqual(['DATOS_INCOMPLETOS']);
    expect(filas[2].pendientes).toEqual(['CORREO_FALLIDO']);
    expect(conteos).toEqual({ sellarPdf: 1, datosIncompletos: 1, correoFallido: 1 });
  });

  /* 3 · una fila puede acumular varios pendientes */
  it('combina varios pendientes en una misma fila', () => {
    const combinado = radicadoBase({
      archivos:    [pdfSinSellar],
      solicitante: { ...radicadoBase().solicitante, datosNoAportados: { correo: true } },
    });

    const { filas, conteos } = trabajoDeHoy([combinado], AHORA);
    expect(filas[0].pendientes).toEqual(['SELLAR_PDF', 'DATOS_INCOMPLETOS']);
    expect(conteos).toEqual({ sellarPdf: 1, datosIncompletos: 1, correoFallido: 0 });
  });

  /* 4 · sin pendientes = al día; resueltos no piden sello */
  it('fila sin pendientes queda vacía y un RESUELTO no pide sello', () => {
    const alDia = radicadoBase();
    const resueltoConPdf = radicadoBase({
      radicadoId:   '1-WEB-2026-00000045',
      estadoActual: 'RESUELTO',
      control:      conControl(AHORA.toISOString(), '11:00', '1-WEB-2026-00000045'),
      archivos:     [pdfSinSellar],
    });

    const { filas } = trabajoDeHoy([alDia, resueltoConPdf], AHORA);
    expect(filas[0].pendientes).toEqual([]);
    expect(filas[1].pendientes).toEqual([]);
  });

  /* 5 · orden cronológico por hora de radicación */
  it('ordena las filas por fechaRadicado ascendente', () => {
    const tarde = radicadoBase({
      radicadoId: '1-WEB-2026-00000047',
      control:    conControl('2026-07-02T16:30:00.000Z', '11:30', '1-WEB-2026-00000047'),
    });
    const temprano = radicadoBase({
      radicadoId: '1-WEB-2026-00000046',
      control:    conControl('2026-07-02T13:15:00.000Z', '08:15', '1-WEB-2026-00000046'),
    });

    const { filas } = trabajoDeHoy([tarde, temprano], AHORA);
    expect(filas.map((f) => f.radicadoId))
      .toEqual(['1-WEB-2026-00000046', '1-WEB-2026-00000047']);
  });

  /* 6 · protección de identidad: nunca sale el nombre del solicitante */
  it('no expone el nombre y marca identidad reservada o anónima', () => {
    const reservado = radicadoBase({ identidadReservada: true });
    const anonimo   = radicadoBase({
      radicadoId: '1-WEB-2026-00000048',
      control:    conControl(AHORA.toISOString(), '10:20', '1-WEB-2026-00000048'),
      esAnonimo:  true,
    });

    const resultado = trabajoDeHoy([reservado, anonimo], AHORA);
    expect(JSON.stringify(resultado)).not.toContain('Juan Pérez');
    expect(resultado.filas[0].identidadReservada).toBe(true);
    expect(resultado.filas[1].identidadReservada).toBe(true);
  });

  /* 7 · filtro de chips */
  it('filtrarTrabajoHoy respeta TODOS y filtra por pendiente', () => {
    const { filas } = trabajoDeHoy([
      radicadoBase({ archivos: [pdfSinSellar] }),
      radicadoBase({
        radicadoId: '1-WEB-2026-00000049',
        control:    conControl(AHORA.toISOString(), '10:30', '1-WEB-2026-00000049'),
        alertaNotificacionFallida: true,
      }),
    ], AHORA);

    expect(filtrarTrabajoHoy(filas, 'TODOS')).toHaveLength(2);
    expect(filtrarTrabajoHoy(filas, 'SELLAR_PDF').map((f) => f.radicadoId))
      .toEqual(['1-WEB-2026-00000042']);
    expect(filtrarTrabajoHoy(filas, 'CORREO_FALLIDO').map((f) => f.radicadoId))
      .toEqual(['1-WEB-2026-00000049']);
  });
});
