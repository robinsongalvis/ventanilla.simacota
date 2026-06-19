import { describe, expect, it } from 'vitest';
import {
  calcularCargaDependencias,
  evaluarRiesgoMasivo,
  evaluarRiesgoRadicado,
  nivelDesdePuntaje,
  resumirNiveles,
} from '@/lib/control-interno/riesgos';
import { generarAlertas, resumirAlertasPorNivel } from '@/lib/control-interno/alertas';
import {
  puedeAccederControlInterno,
  puedeCrearHallazgo,
  puedeReportarAvancePlan,
} from '@/lib/control-interno/permisos';
import { describirNivelRiesgo, generarRecomendacionesDia } from '@/lib/control-interno/recomendaciones';
import { generarReporteExcelControlInterno } from '@/lib/control-interno/server/reporte-excel';
import ExcelJS from 'exceljs';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

const HOY = new Date('2026-06-18T10:00:00Z');

function radicado(overrides: Partial<VentanillaRadicado> & {
  id?: string;
  estado?: VentanillaRadicado['estadoActual'];
  vencimiento?: string;
  tenant?: VentanillaRadicado['clasificacion']['oficinaDestino'];
  tipo?: string;
  responsableUid?: string | null;
  notifFallida?: boolean;
  cumplio?: boolean | null;
  prorrogas?: number;
} = {}): VentanillaRadicado {
  const id = overrides.id ?? `2026-${Math.random().toString().slice(2, 8)}`;
  return {
    radicadoId: id,
    estadoActual: overrides.estado ?? 'EN_PROCESO',
    ultimaActualizacion: HOY.toISOString(),
    prioridad: 'AMARILLO',
    cumplioTermino: overrides.cumplio ?? null,
    alertaNotificacionFallida: overrides.notifFallida ?? false,
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '123',
      nombreCompleto: 'Ciudadano',
      email: null, telefono: null, direccion: null,
      ubicacion: { pais: 'CO', departamento: 'SAN', municipio: 'SIM' },
    },
    control: {
      radicadoId: id,
      consecutivo: 1,
      fechaRadicado: '2026-06-01T08:00:00Z',
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: (overrides.tipo ?? 'PETICION_GENERAL') as VentanillaRadicado['termino']['tipoSolicitudId'],
      tipoSolicitudNombre: 'Petición',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: overrides.vencimiento ?? '2026-07-01T00:00:00Z',
      prorrogasAplicadas: overrides.prorrogas ?? 0,
    },
    clasificacion: {
      oficinaDestino: overrides.tenant ?? 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: overrides.responsableUid === null ? undefined : (overrides.responsableUid ?? 'uid-x'),
      funcionarioResponsableNombre: overrides.responsableUid === null ? undefined : 'Funcionario X',
    },
    detalle: { asunto: 'Asunto', descripcion: 'Descripción', numeroFolios: 0, anexosDescripcion: null },
    archivos: [],
    ...overrides,
  } as VentanillaRadicado;
}

describe('Motor de riesgos Control Interno', () => {
  /* 1 */
  it('puntaje 0 → BAJO', () => {
    expect(nivelDesdePuntaje(0)).toBe('BAJO');
  });

  /* 2 */
  it('puntaje 7+ → CRITICO', () => {
    expect(nivelDesdePuntaje(7)).toBe('CRITICO');
    expect(nivelDesdePuntaje(12)).toBe('CRITICO');
  });

  /* 3 */
  it('un radicado vencido genera riesgo alto o crítico', () => {
    const r = radicado({ vencimiento: '2026-06-01T00:00:00Z' });
    const ev = evaluarRiesgoRadicado(r, {}, HOY);
    expect(['ALTO', 'CRITICO']).toContain(ev.nivel);
    expect(ev.motivos).toContain('VENCIDO');
  });

  /* 4 */
  it('un radicado sin responsable acumula motivo SIN_RESPONSABLE', () => {
    const r = radicado({ responsableUid: null });
    const ev = evaluarRiesgoRadicado(r, {}, HOY);
    expect(ev.motivos).toContain('SIN_RESPONSABLE');
  });

  /* 5 */
  it('una dependencia con varios vencidos eleva el riesgo de sus radicados', () => {
    const vencidos = Array.from({ length: 6 }, () =>
      radicado({ vencimiento: '2026-06-01T00:00:00Z', tenant: 'SEC_PLANEACION' }),
    );
    const eval0 = evaluarRiesgoRadicado(vencidos[0], { cargaDependencias: calcularCargaDependencias(vencidos) }, HOY);
    expect(eval0.motivos).toContain('DEPENDENCIA_CONGESTIONADA');
  });

  /* 6 */
  it('resumirNiveles suma totales por nivel', () => {
    const radicados = [
      radicado({ vencimiento: '2026-06-01T00:00:00Z' }),               // crítico/alto
      radicado({}),                                                    // bajo
      radicado({ responsableUid: null, vencimiento: '2026-06-01T00:00:00Z' }), // crítico
    ];
    const ev = evaluarRiesgoMasivo(radicados, HOY);
    const resumen = resumirNiveles(ev);
    expect(resumen.BAJO + resumen.MEDIO + resumen.ALTO + resumen.CRITICO).toBe(3);
  });

  /* 7 */
  it('respondido fuera de término eleva riesgo aunque no esté activo', () => {
    const r = radicado({ estado: 'RESUELTO', cumplio: false });
    const ev = evaluarRiesgoRadicado(r, {}, HOY);
    expect(ev.motivos).toContain('RESUELTO_FUERA_TERMINO');
  });
});

describe('Generador de alertas Control Interno', () => {
  /* 8 */
  it('genera alerta CRITICA para radicado vencido', () => {
    const radicados = [radicado({ vencimiento: '2026-06-01T00:00:00Z' })];
    const alertas = generarAlertas(radicados, { ahora: HOY });
    expect(alertas.find((a) => a.tipo === 'RADICADO_VENCIDO')).toBeTruthy();
    expect(alertas[0]?.nivel).toBe('CRITICO');
  });

  /* 9 */
  it('genera alerta SIN_RESPONSABLE cuando falta asignar', () => {
    const radicados = [radicado({ responsableUid: null })];
    const alertas = generarAlertas(radicados, { ahora: HOY });
    expect(alertas.some((a) => a.tipo === 'SIN_RESPONSABLE')).toBe(true);
  });

  /* 10 */
  it('detecta dependencia congestionada con ≥5 vencidos', () => {
    const radicados = Array.from({ length: 6 }, () =>
      radicado({ vencimiento: '2026-06-01T00:00:00Z', tenant: 'SEC_GOBIERNO' }),
    );
    const alertas = generarAlertas(radicados, { ahora: HOY });
    expect(alertas.some((a) => a.tipo === 'DEPENDENCIA_CONGESTIONADA')).toBe(true);
  });

  /* 11 */
  it('resumirAlertasPorNivel ignora alertas no abiertas', () => {
    const radicados = [radicado({ vencimiento: '2026-06-01T00:00:00Z' })];
    const alertas = generarAlertas(radicados, { ahora: HOY }).map((a) => ({ ...a, estado: 'GESTIONADA' as const }));
    const resumen = resumirAlertasPorNivel(alertas);
    expect(resumen.CRITICO + resumen.ALTO + resumen.MEDIO + resumen.BAJO).toBe(0);
  });
});

describe('Permisos Control Interno', () => {
  /* 12 */
  it('CONTROL_INTERNO y ADMIN pueden acceder y crear hallazgos', () => {
    expect(puedeAccederControlInterno('CONTROL_INTERNO')).toBe(true);
    expect(puedeAccederControlInterno('ADMIN')).toBe(true);
    expect(puedeAccederControlInterno('FUNCIONARIO')).toBe(false);
    expect(puedeCrearHallazgo('FUNCIONARIO')).toBe(false);
  });

  /* 13 */
  it('los funcionarios y jefes pueden reportar avances de plan', () => {
    expect(puedeReportarAvancePlan('FUNCIONARIO')).toBe(true);
    expect(puedeReportarAvancePlan('JEFE_DEPENDENCIA')).toBe(true);
    expect(puedeReportarAvancePlan('CONTROL_INTERNO')).toBe(false);
  });
});

describe('Experiencia humana de Control Interno', () => {
  it('muestra un mensaje positivo cuando no hay asuntos pendientes', () => {
    const recomendaciones = generarRecomendacionesDia({
      alertas: [],
      hallazgos: [],
      planes: [],
      dependencias: [],
      ahora: HOY,
    });

    expect(recomendaciones).toHaveLength(1);
    expect(recomendaciones[0]).toMatchObject({
      severidad: 'POSITIVO',
      titulo: 'No hay alertas críticas para hoy.',
    });
  });

  it('prioriza radicados vencidos y limita la agenda diaria a cinco acciones', () => {
    const alertas = generarAlertas([
      radicado({ vencimiento: '2026-06-01T00:00:00Z', responsableUid: null }),
      radicado({ vencimiento: '2026-06-19T00:00:00Z' }),
    ], { ahora: HOY });

    const recomendaciones = generarRecomendacionesDia({
      alertas,
      hallazgos: [
        { estado: 'ABIERTO', nivel: 'CRITICO' },
        { estado: 'ABIERTO', nivel: 'MEDIO' },
      ] as Parameters<typeof generarRecomendacionesDia>[0]['hallazgos'],
      planes: [
        { estado: 'VENCIDO', fechaCompromiso: '2026-06-01' },
        { estado: 'PENDIENTE', fechaCompromiso: '2026-06-30' },
      ] as Parameters<typeof generarRecomendacionesDia>[0]['planes'],
      dependencias: [
        { nombre: 'Secretaría de Gobierno', nivelRiesgo: 'ALTO', total: 10, cumplimientoPct: 60, vencidos: 2, hallazgosAbiertos: 1 },
      ] as Parameters<typeof generarRecomendacionesDia>[0]['dependencias'],
      ahora: HOY,
    });

    expect(recomendaciones.length).toBeLessThanOrEqual(5);
    expect(recomendaciones[0]?.severidad).toBe('URGENTE');
    expect(recomendaciones.some((item) => item.titulo.includes('vencido'))).toBe(true);
  });

  it('explica los cuatro niveles de riesgo sin lenguaje técnico', () => {
    expect(describirNivelRiesgo('BAJO')).toContain('Sin señales');
    expect(describirNivelRiesgo('MEDIO')).toContain('preventivo');
    expect(describirNivelRiesgo('ALTO')).toContain('prioritaria');
    expect(describirNivelRiesgo('CRITICO')).toContain('inmediata');
  });

  it('genera el informe con nombres de hojas comprensibles', async () => {
    const buffer = await generarReporteExcelControlInterno({
      periodo: { desde: '2026-06-01', hasta: '2026-06-18' },
      kpis: [], alertas: [], evaluaciones: [], hallazgos: [], planes: [], dependencias: [],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Resumen', 'Alertas', 'Radicados revisados', 'Hallazgos',
      'Planes de mejora', 'Dependencias', 'Diccionario',
    ]);
  });
});
