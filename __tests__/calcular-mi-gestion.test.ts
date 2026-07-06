import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { calcularMiGestion } from '@/lib/mi-gestion/calcular-mi-gestion';

/* ══════════════════════════════════════════════════════════════
   Sprint Mi gestión — desempeño personal del funcionario.

   Referencia fija: jueves 2 jul 2026 15:00 UTC → 10:00 Colombia.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-02T15:00:00.000Z');
const UID = 'uid-carlos';

let consecutivo = 0;

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  consecutivo += 1;
  const id = `1-WEB-2026-${String(consecutivo).padStart(8, '0')}`;
  return {
    radicadoId:          id,
    estadoActual:        'ASIGNADO',
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
      radicadoId:     id,
      consecutivo,
      fechaRadicado:  '2026-06-25T14:00:00.000Z',
      horaRadicado:   '09:00',
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
      oficinaDestino: 'SEC_PLANEACION',
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: UID,
    },
    detalle: { asunto: 'Solicitud', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

function resuelto(cumplio: boolean, fechaResp = '2026-06-30T14:00:00.000Z') {
  return radicado({
    estadoActual: 'RESUELTO',
    cumplioTermino: cumplio,
    respuestaOficial: {
      archivoPath: null, archivoNombre: null,
      nota: 'ok', fecha: fechaResp, actorUid: UID, actorNombre: 'Carlos',
    },
  });
}

describe('Mi gestión — calcularMiGestion', () => {
  /* 1 · solo cuenta lo asignado a mí */
  it('filtra por funcionarioResponsableUid', () => {
    const deOtro = radicado({
      clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO', funcionarioResponsableUid: 'uid-otra' },
    });
    const g = calcularMiGestion([radicado(), deOtro], UID, AHORA);
    expect(g.asignados).toBe(1);
  });

  /* 2 · asignados = respondidos + pendientes (como en el boceto: 12 = 9 + 3) */
  it('cuadra asignados, respondidos y pendientes', () => {
    const g = calcularMiGestion([radicado(), radicado(), resuelto(true)], UID, AHORA);
    expect(g.asignados).toBe(3);
    expect(g.respondidos).toBe(1);
    expect(g.pendientes).toBe(2);
  });

  /* 3 · cumplimiento con dato MIPG */
  it('calcula el porcentaje solo con resueltos que traen cumplioTermino', () => {
    const g = calcularMiGestion(
      [resuelto(true), resuelto(true), resuelto(false)], UID, AHORA,
    );
    expect(g.pctCumplimiento).toBe(67);
  });

  /* 4 · tiempo promedio en días con 1 decimal */
  it('promedia el tiempo de respuesta', () => {
    // Radicado 25 jun → resuelto 30 jun = 5 días; y otro de 3 días.
    const g = calcularMiGestion(
      [resuelto(true, '2026-06-30T14:00:00.000Z'), resuelto(true, '2026-06-28T14:00:00.000Z')],
      UID, AHORA,
    );
    expect(g.tiempoPromedioDias).toBe(4);
  });

  /* 5 · semáforo VERDE: sin vencimientos y cumplimiento alto */
  it('queda VERDE con todo al día', () => {
    const g = calcularMiGestion([resuelto(true), radicado()], UID, AHORA);
    expect(g.semaforo).toBe('VERDE');
  });

  /* 6 · semáforo ÁMBAR: algo por vencer manda sobre el buen histórico */
  it('pasa a ÁMBAR con un radicado por vencer aunque el histórico sea perfecto', () => {
    const porVencer = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '2026-07-03T09:00:00.000Z' },
    });
    const g = calcularMiGestion([resuelto(true), porVencer], UID, AHORA);
    expect(g.porVencer).toBeGreaterThan(0);
    expect(g.semaforo).toBe('AMBAR');
  });

  /* 7 · semáforo ROJO: un vencido activo manda sobre todo */
  it('pasa a ROJO con un vencido activo aunque el cumplimiento sea 100%', () => {
    const vencido = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '2026-06-20T09:00:00.000Z' },
    });
    const g = calcularMiGestion([resuelto(true), vencido], UID, AHORA);
    expect(g.vencidos).toBe(1);
    expect(g.semaforo).toBe('ROJO');
  });

  /* 8 · semáforo ROJO por bajo cumplimiento histórico */
  it('pasa a ROJO con cumplimiento < 60% aun sin vencidos', () => {
    const g = calcularMiGestion(
      [resuelto(false), resuelto(false), resuelto(true)], UID, AHORA,
    );
    expect(g.pctCumplimiento).toBe(33);
    expect(g.semaforo).toBe('ROJO');
  });

  /* 9 · atiende primero: etiquetas y orden por urgencia */
  it('ordena lo urgente y arma las etiquetas del boceto', () => {
    const venceMañana = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '2026-07-03T09:00:00.000Z' },
    });
    const vencido = radicado({
      termino: { ...radicado().termino, fechaVencimiento: '2026-06-26T09:00:00.000Z' },
    });
    const g = calcularMiGestion([venceMañana, vencido], UID, AHORA);
    expect(g.atencionPrioritaria[0].radicadoId).toBe(vencido.radicadoId);
    expect(g.atencionPrioritaria[0].etiqueta).toMatch(/venció hace/i);
    expect(g.atencionPrioritaria[0].nivel).toBe('ROJO');
    expect(g.atencionPrioritaria[1].etiqueta).toMatch(/vence (hoy|mañana)/i);
  });

  /* 10 · tendencia: 4 semanas con la actual de última */
  it('cuenta resueltos por semana calendario colombiana', () => {
    const estaSemana = resuelto(true, '2026-07-01T14:00:00.000Z');   // miércoles de esta semana
    const semanaPasada = resuelto(true, '2026-06-24T14:00:00.000Z'); // S-1
    const g = calcularMiGestion([estaSemana, semanaPasada], UID, AHORA);
    expect(g.tendencia.map((s) => s.etiqueta)).toEqual(['S-3', 'S-2', 'S-1', 'Esta']);
    expect(g.tendencia[3].resueltos).toBe(1);
    expect(g.tendencia[2].resueltos).toBe(1);
    expect(g.tendencia[0].resueltos).toBe(0);
  });

  /* 11 · sin datos: nulls limpios, semáforo VERDE */
  it('sin radicados devuelve nulls y VERDE', () => {
    const g = calcularMiGestion([], UID, AHORA);
    expect(g.asignados).toBe(0);
    expect(g.pctCumplimiento).toBeNull();
    expect(g.tiempoPromedioDias).toBeNull();
    expect(g.semaforo).toBe('VERDE');
  });
});
