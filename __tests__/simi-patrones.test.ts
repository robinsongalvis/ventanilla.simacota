import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import { generarAlertas } from '@/lib/control-interno/alertas';

/* ══════════════════════════════════════════════════════════════
   SIMI patrones — señales transversales del generador de alertas:
   reincidencia ciudadana y devoluciones acumuladas por dependencia.
   Reloj inyectado siempre.
══════════════════════════════════════════════════════════════ */

const AHORA = new Date('2026-07-10T14:00:00.000Z');

let seq = 0;
function radicadoBase(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  seq += 1;
  const id = `1-110-2026-${String(seq).padStart(8, '0')}`;
  return {
    radicadoId:          id,
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
      radicadoId:     id,
      consecutivo:    seq,
      fechaRadicado:  AHORA.toISOString(),
      horaRadicado:   '09:00',
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
      funcionarioResponsableUid: 'uid-x',
    },
    detalle: { asunto: 'Asunto', descripcion: 'Desc', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  } as VentanillaRadicado;
}

function deTipo(alertas: ReturnType<typeof generarAlertas>, tipo: string) {
  return alertas.filter((a) => a.tipo === tipo);
}

describe('CIUDADANO_REINCIDENTE', () => {
  it('3 radicados activos del mismo documento generan UNA alerta con los ids', () => {
    const radicados = [radicadoBase(), radicadoBase(), radicadoBase()];
    const alertas = deTipo(generarAlertas(radicados, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE');
    expect(alertas).toHaveLength(1);
    expect(alertas[0].nivel).toBe('ALTO');
    expect(alertas[0].motivo).toContain('Juan Pérez');
    expect(alertas[0].motivo).toContain('3 radicados activos');
    expect((alertas[0].metadata as { radicados: string[] }).radicados).toHaveLength(3);
  });

  it('con 2 activos no hay alerta; los resueltos no cuentan', () => {
    const radicados = [
      radicadoBase(),
      radicadoBase(),
      radicadoBase({ estadoActual: 'RESUELTO' }),
    ];
    expect(deTipo(generarAlertas(radicados, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE'))
      .toHaveLength(0);
  });

  it('un DESISTIDO no cuenta como activo (BM-B33): 2 vivos + 1 desistido ≠ reincidencia', () => {
    // La rama original del PR #86 es anterior a los estados de BM-B33 y su
    // lista privada de cierres solo conocía RESUELTO/RECHAZADO: un
    // desistimiento confirmado por acto motivado habría contado como caso
    // vivo e inflado la reincidencia hacia una alerta ALTA falsa. Ahora el
    // criterio viene de la fuente única (esEstadoCerrado).
    const radicados = [
      radicadoBase(),
      radicadoBase(),
      radicadoBase({ estadoActual: 'DESISTIDO' }),
    ];
    expect(deTipo(generarAlertas(radicados, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE'))
      .toHaveLength(0);
  });

  it('un EN_SUBSANACION SÍ cuenta: suspende el término, no cierra el caso', () => {
    // Decisión deliberada, no descuido: un ciudadano con 3 casos abiertos
    // sigue siendo reincidente aunque uno esté esperando subsanación — el
    // problema de fondo que la alerta busca no desaparece por la suspensión.
    const radicados = [
      radicadoBase(),
      radicadoBase(),
      radicadoBase({ estadoActual: 'EN_SUBSANACION' }),
    ];
    const alertas = deTipo(generarAlertas(radicados, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE');
    expect(alertas).toHaveLength(1);
    expect((alertas[0].metadata as { radicados: string[] }).radicados).toHaveLength(3);
  });

  it('anónimos, reservados y sin documento jamás se correlacionan', () => {
    const anonimos = [
      radicadoBase({ esAnonimo: true }),
      radicadoBase({ esAnonimo: true }),
      radicadoBase({ esAnonimo: true }),
      radicadoBase({ tipoPresentacion: 'RESERVADA' }),
      radicadoBase({ tipoPresentacion: 'RESERVADA' }),
      radicadoBase({ tipoPresentacion: 'RESERVADA' }),
    ];
    expect(deTipo(generarAlertas(anonimos, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE'))
      .toHaveLength(0);
  });

  it('documentos distintos no se mezclan', () => {
    const base = radicadoBase().solicitante;
    const radicados = [
      radicadoBase(),
      radicadoBase(),
      radicadoBase({ solicitante: { ...base, numeroDocumento: '222', nombreCompleto: 'Otra Persona' } }),
    ];
    expect(deTipo(generarAlertas(radicados, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE'))
      .toHaveLength(0);
  });
});

describe('DEVOLUCIONES_ACUMULADAS', () => {
  it('2 devueltos en la misma dependencia generan alerta MEDIA; 4 la suben a ALTA', () => {
    const dos = [
      radicadoBase({ estadoActual: 'DEVUELTO' }),
      radicadoBase({ estadoActual: 'DEVUELTO' }),
    ];
    const a2 = deTipo(generarAlertas(dos, { ahora: AHORA }), 'DEVOLUCIONES_ACUMULADAS');
    expect(a2).toHaveLength(1);
    expect(a2[0].nivel).toBe('MEDIO');
    expect(a2[0].tenantId).toBe('SEC_GOBIERNO');

    const cuatro = [...dos,
      radicadoBase({ estadoActual: 'DEVUELTO' }),
      radicadoBase({ estadoActual: 'DEVUELTO' }),
    ];
    const a4 = deTipo(generarAlertas(cuatro, { ahora: AHORA }), 'DEVOLUCIONES_ACUMULADAS');
    expect(a4).toHaveLength(1);
    expect(a4[0].nivel).toBe('ALTO');
  });

  it('devoluciones en dependencias distintas no se suman', () => {
    const radicados = [
      radicadoBase({ estadoActual: 'DEVUELTO' }),
      radicadoBase({
        estadoActual: 'DEVUELTO',
        clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
      }),
    ];
    expect(deTipo(generarAlertas(radicados, { ahora: AHORA }), 'DEVOLUCIONES_ACUMULADAS'))
      .toHaveLength(0);
  });
});

describe('determinismo', () => {
  it('el id de la alerta es estable dentro del mismo día (de-duplicación)', () => {
    const radicados = [radicadoBase(), radicadoBase(), radicadoBase()];
    const a = deTipo(generarAlertas(radicados, { ahora: AHORA }), 'CIUDADANO_REINCIDENTE')[0];
    const b = deTipo(generarAlertas(radicados, { ahora: new Date('2026-07-10T20:00:00.000Z') }), 'CIUDADANO_REINCIDENTE')[0];
    expect(a.id).toBe(b.id);
  });
});
