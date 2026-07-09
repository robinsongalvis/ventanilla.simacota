import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import type { PlanillaReparto } from '@/src/types/planilla';
import {
  construirPlanilla,
  esPendienteDeReparto,
  filaDesdeRadicado,
  formatearPlanillaId,
  idsEnPlanillasAbiertas,
  nombreParaPlanilla,
  radicadosPendientesDeReparto,
} from '@/lib/planillas/construir-planilla';
import {
  anularPlanilla,
  aplicarEntregas,
  errorDeEntrega,
  puedeAnular,
  resumenPlanilla,
} from '@/lib/planillas/entregas';

/* ══════════════════════════════════════════════════════════════
   Sprint Planilla de reparto — capa pura.

   Reloj inyectado siempre: 10 jul 2026, 09:00 Colombia (UTC-5).
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-10T14:00:00.000Z');
const ACTOR = { uid: 'uid-recepcion', nombre: 'Funcionaria Ventanilla' };

function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-FIS-2026-00000010',
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
      radicadoId:     '1-FIS-2026-00000010',
      consecutivo:    10,
      fechaRadicado:  '2026-07-10T13:00:00.000Z',
      horaRadicado:   '08:00',
      medioRecepcion: 'PRESENCIAL',
      origen:         'FISICO_ESCANER',
    },
    termino: {
      tipoSolicitudId:     'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta:       15,
      unidad:              'HABILES',
      fechaVencimiento:    '2026-07-31T14:00:00.000Z',
      prorrogasAplicadas:  0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: {
      asunto:       'Solicitud de certificado',
      descripcion:  'Descripción',
      numeroFolios: 2,
      anexosDescripcion: 'CD con planos',
    },
    archivos: [],
    ...overrides,
  } as VentanillaRadicado;
}

function planillaDePrueba(radicados: VentanillaRadicado[]): PlanillaReparto {
  return construirPlanilla(radicados, 7, ACTOR, AHORA);
}

describe('formatearPlanillaId', () => {
  it('genera la serie anual legible en papel', () => {
    expect(formatearPlanillaId(7, AHORA)).toBe('PL-2026-0007');
    expect(formatearPlanillaId(1234, AHORA)).toBe('PL-2026-1234');
  });
});

describe('pendientes de reparto', () => {
  it('solo entran radicados nacidos en papel', () => {
    const web = radicadoBase({
      radicadoId: '1-WEB-2026-00000011',
      control: { ...radicadoBase().control, origen: 'WEB' },
    });
    expect(esPendienteDeReparto(web, new Set())).toBe(false);
    expect(esPendienteDeReparto(radicadoBase(), new Set())).toBe(true);
  });

  it('excluye los ya entregados y los que viajan en planilla abierta', () => {
    const entregado = radicadoBase({
      radicadoId: '1-FIS-2026-00000012',
      entregaFisica: { planillaId: 'PL-2026-0001', fecha: AHORA.toISOString(), recibidoPor: 'Ana' },
    });
    expect(esPendienteDeReparto(entregado, new Set())).toBe(false);
    expect(esPendienteDeReparto(radicadoBase(), new Set(['1-FIS-2026-00000010']))).toBe(false);
  });

  it('idsEnPlanillasAbiertas ignora cerradas y filas ya gestionadas', () => {
    const abierta = planillaDePrueba([radicadoBase()]);
    const cerrada: PlanillaReparto = {
      ...planillaDePrueba([radicadoBase({ radicadoId: '1-FIS-2026-00000099' })]),
      estado: 'CERRADA',
    };
    const ids = idsEnPlanillasAbiertas([abierta, cerrada]);
    expect(ids.has('1-FIS-2026-00000010')).toBe(true);
    expect(ids.has('1-FIS-2026-00000099')).toBe(false);
  });

  it('radicadosPendientesDeReparto combina los tres criterios', () => {
    const pendiente = radicadoBase({ radicadoId: '1-FIS-2026-00000020' });
    const web = radicadoBase({
      radicadoId: '1-WEB-2026-00000021',
      control: { ...radicadoBase().control, origen: 'WEB' },
    });
    const enPlanilla = radicadoBase({ radicadoId: '1-FIS-2026-00000010' });
    const resultado = radicadosPendientesDeReparto(
      [pendiente, web, enPlanilla],
      [planillaDePrueba([enPlanilla])],
    );
    expect(resultado.map((r) => r.radicadoId)).toEqual(['1-FIS-2026-00000020']);
  });
});

describe('privacidad en el papel', () => {
  it('anónimos y reservados nunca imprimen nombre', () => {
    expect(nombreParaPlanilla(radicadoBase({ esAnonimo: true }))).toBe('Identidad reservada');
    expect(nombreParaPlanilla(radicadoBase({ tipoPresentacion: 'RESERVADA' })))
      .toBe('Identidad reservada');
    expect(nombreParaPlanilla(radicadoBase({ identidadReservada: true })))
      .toBe('Identidad reservada');
    expect(nombreParaPlanilla(radicadoBase())).toBe('Juan Pérez');
  });
});

describe('construirPlanilla', () => {
  it('agrupa por dependencia y ordena por fecha dentro del grupo', () => {
    const gobTarde = radicadoBase({
      radicadoId: 'B',
      control: { ...radicadoBase().control, fechaRadicado: '2026-07-10T15:00:00.000Z' },
    });
    const gobTemprano = radicadoBase({ radicadoId: 'A' });
    const planeacion = radicadoBase({
      radicadoId: 'C',
      clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
    });
    const planilla = construirPlanilla([gobTarde, planeacion, gobTemprano], 7, ACTOR, AHORA);
    expect(planilla.filas.map((f) => f.radicadoId)).toEqual(['A', 'B', 'C']);
    expect(planilla.planillaId).toBe('PL-2026-0007');
    expect(planilla.estado).toBe('POR_ENTREGAR');
  });

  it('la fila captura folios, anexos y hora para el papel', () => {
    const fila = filaDesdeRadicado(radicadoBase());
    expect(fila).toMatchObject({
      radicadoId: '1-FIS-2026-00000010',
      dependenciaDestino: 'SEC_GOBIERNO',
      areaAsignada: null,
      asunto: 'Solicitud de certificado',
      numeroFolios: 2,
      anexosDescripcion: 'CD con planos',
      horaRadicado: '08:00',
      estado: 'PENDIENTE',
      entrega: null,
    });
  });

  it('la fila conserva el área asignada cuando existe (columna del formato GSC)', () => {
    const conArea = radicadoBase({
      clasificacion: {
        oficinaDestino: 'SEC_GOBIERNO',
        zonaGeografica: 'CASCO_URBANO',
        areaResponsable: 'JURIDICA',
      },
    });
    expect(filaDesdeRadicado(conArea).areaAsignada).toBe('JURIDICA');
  });
});

describe('aplicarEntregas', () => {
  it('registra quién recibió, cuándo y la nota de lugar', () => {
    const planilla = planillaDePrueba([radicadoBase()]);
    const { planilla: actualizada, entregadas } = aplicarEntregas(
      planilla,
      [{ radicadoId: '1-FIS-2026-00000010', recibidoPor: '  Ana Rueda ', nota: ' En la casa del secretario ' }],
      { cerrar: false, ahora: AHORA, actor: ACTOR },
    );
    expect(entregadas).toHaveLength(1);
    expect(actualizada.filas[0].entrega).toEqual({
      fecha: AHORA.toISOString(),
      recibidoPor: 'Ana Rueda',
      nota: 'En la casa del secretario',
    });
    // Se entregó todo → la planilla queda cerrada sola.
    expect(actualizada.estado).toBe('CERRADA');
  });

  it('cerrar libera lo pendiente para la planilla del día siguiente', () => {
    const planilla = planillaDePrueba([
      radicadoBase({ radicadoId: 'A' }),
      radicadoBase({ radicadoId: 'B' }),
    ]);
    const { planilla: cerrada, liberadas } = aplicarEntregas(
      planilla,
      [{ radicadoId: 'A', recibidoPor: 'Ana' }],
      { cerrar: true, ahora: AHORA, actor: ACTOR },
    );
    expect(cerrada.estado).toBe('CERRADA');
    expect(liberadas.map((f) => f.radicadoId)).toEqual(['B']);
    expect(cerrada.filas.find((f) => f.radicadoId === 'B')?.estado).toBe('LIBERADA');
    // El liberado vuelve a ser pendiente de reparto.
    expect(idsEnPlanillasAbiertas([cerrada]).size).toBe(0);
  });

  it('sin cerrar, lo no entregado sigue pendiente en la planilla', () => {
    const planilla = planillaDePrueba([
      radicadoBase({ radicadoId: 'A' }),
      radicadoBase({ radicadoId: 'B' }),
    ]);
    const { planilla: parcial } = aplicarEntregas(
      planilla,
      [{ radicadoId: 'A', recibidoPor: 'Ana' }],
      { cerrar: false, ahora: AHORA, actor: ACTOR },
    );
    expect(parcial.estado).toBe('POR_ENTREGAR');
    expect(resumenPlanilla(parcial)).toEqual({ total: 2, pendientes: 1, entregadas: 1, liberadas: 0 });
  });

  it('es todo-o-nada: nombre vacío, fila ajena o duplicada rechazan la operación', () => {
    const planilla = planillaDePrueba([radicadoBase()]);
    expect(errorDeEntrega(planilla, { radicadoId: '1-FIS-2026-00000010', recibidoPor: '  ' }))
      .toMatch(/Falta el nombre/);
    expect(errorDeEntrega(planilla, { radicadoId: 'NO-EXISTE', recibidoPor: 'Ana' }))
      .toMatch(/no está en la planilla/);
    expect(() => aplicarEntregas(
      planilla,
      [
        { radicadoId: '1-FIS-2026-00000010', recibidoPor: 'Ana' },
        { radicadoId: '1-FIS-2026-00000010', recibidoPor: 'Luis' },
      ],
      { cerrar: false, ahora: AHORA, actor: ACTOR },
    )).toThrow(/duplicada/);
  });
});

describe('anulación', () => {
  it('solo se anula sin entregas y con motivo', () => {
    const planilla = planillaDePrueba([radicadoBase()]);
    expect(puedeAnular(planilla)).toBe(true);
    const anulada = anularPlanilla(planilla, 'Se generó por error', AHORA, ACTOR);
    expect(anulada.estado).toBe('ANULADA');
    expect(anulada.anulacion?.motivo).toBe('Se generó por error');
    expect(anulada.filas[0].estado).toBe('LIBERADA');
    expect(() => anularPlanilla(planilla, '   ', AHORA, ACTOR)).toThrow(/motivo/);
  });

  it('con una firma registrada ya no hay marcha atrás', () => {
    const planilla = planillaDePrueba([radicadoBase()]);
    const { planilla: conEntrega } = aplicarEntregas(
      planilla,
      [{ radicadoId: '1-FIS-2026-00000010', recibidoPor: 'Ana' }],
      { cerrar: false, ahora: AHORA, actor: ACTOR },
    );
    expect(puedeAnular(conEntrega)).toBe(false);
    expect(() => anularPlanilla(conEntrega, 'motivo', AHORA, ACTOR)).toThrow(/no se puede anular/);
  });
});
