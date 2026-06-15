/**
 * Tests del exportador Excel MIPG.
 *
 * Cubren:
 *  - Sanitizador: enmascara anónimos/reservados, sin UID ni archivoPath.
 *  - Filtro por rol: FUNCIONARIO solo ve su dependencia.
 *  - Indicadores: tasa de resolución y cumplimiento de términos.
 *  - Agrupación por dependencia.
 *  - Extracción de notificaciones desde trazabilidad.
 *  - generarReporteExcelMipg produce un .xlsx válido con las 8 hojas
 *    esperadas y respeta privacidad / scope por rol.
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  debeOcultarIdentidad,
  radicadosVisiblesParaRol,
  responsableVisible,
  solicitanteVisible,
  type UsuarioReporte,
} from '@/lib/reportes-mipg/sanitizar';
import {
  calcularIndicadoresMipg,
  calcularCumplimientoPorDependencia,
  extraerNotificaciones,
} from '@/lib/reportes-mipg/indicadores';
import { generarReporteExcelMipg } from '@/lib/reportes-mipg/excel';
import type { TrazabilidadRadicado, VentanillaRadicado } from '@/src/types/ventanilla';

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  const base: VentanillaRadicado = {
    radicadoId: '1-WEB-2026-00000001',
    estadoActual: 'RESUELTO',
    ultimaActualizacion: '2026-06-14T15:00:00.000Z',
    prioridad: 'AMARILLO',
    cumplioTermino: true,
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1101321226',
      nombreCompleto: 'María Pérez',
      email: 'maria@example.com',
      direccion: 'Calle 1 # 2-3',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId: '1-WEB-2026-00000001',
      consecutivo: 1,
      fechaRadicado: '2026-06-01T10:00:00.000Z',
      horaRadicado: '10:00:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: 'PETICION_INFORMACION',
      tipoSolicitudNombre: 'Petición de información',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: '2026-06-22T17:00:00.000Z',
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'SEC_GOBIERNO',
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: 'usr_uid_SECRET',
      funcionarioResponsableNombre: 'Juan Funcionario',
      funcionarioResponsableEmail: 'juan@simacota.gov.co',
      funcionarioResponsableRol: 'FUNCIONARIO',
    },
    detalle: {
      asunto: 'Prueba',
      descripcion: 'Descripción',
      numeroFolios: 0,
    },
    archivos: [],
    respuestaOficial: {
      archivoPath:   'respuestas/SECRET/oficio.pdf',
      archivoNombre: 'oficio-firmado.pdf',
      nota:          'Respuesta oficial completa al ciudadano.',
      fecha:         '2026-06-15T10:00:00.000Z',
      actorUid:      'usr_internal',
      actorNombre:   'Juan',
    },
  };
  return { ...base, ...overrides };
}

const USUARIO_ADMIN: UsuarioReporte = {
  uid: 'admin-uid', nombre: 'Admin UAT', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA',
};
const USUARIO_FUNC_GOBIERNO: UsuarioReporte = {
  uid: 'func-uid', nombre: 'Func Gobierno', rol: 'FUNCIONARIO', tenantId: 'SEC_GOBIERNO',
};

describe('sanitizar — anonimato y reserva', () => {
  it('enmascara nombre, documento, correo y dirección cuando esAnonimo', () => {
    const r = radicado({ esAnonimo: true, tipoPresentacion: 'ANONIMA' });
    const sv = solicitanteVisible(r);
    expect(sv.nombre).toBe('Anónimo / Reservado');
    expect(sv.documento).toBe('No disponible');
    expect(sv.correo).toBe('No disponible');
    expect(sv.direccion).toBe('No disponible');
    expect(debeOcultarIdentidad(r)).toBe(true);
  });

  it('enmascara cuando tipoPresentacion es RESERVADA', () => {
    const r = radicado({ tipoPresentacion: 'RESERVADA', identidadReservada: true });
    const sv = solicitanteVisible(r);
    expect(sv.nombre).toBe('Anónimo / Reservado');
  });

  it('muestra datos cuando es identificado', () => {
    const sv = solicitanteVisible(radicado());
    expect(sv.nombre).toBe('María Pérez');
    expect(sv.documento).toBe('1101321226');
  });

  it('responsableVisible nunca incluye UID', () => {
    const rv = responsableVisible(radicado());
    expect(rv.nombre).toBe('Juan Funcionario');
    expect(JSON.stringify(rv)).not.toContain('usr_uid_SECRET');
  });
});

describe('sanitizar — filtro por rol', () => {
  const lista = [
    radicado({ radicadoId: 'A', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_GOBIERNO' } }),
    radicado({ radicadoId: 'B', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_PLANEACION' } }),
    radicado({ radicadoId: 'C', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_HACIENDA' } }),
  ];

  it('ADMIN ve todos', () => {
    expect(radicadosVisiblesParaRol(lista, USUARIO_ADMIN)).toHaveLength(3);
  });

  it('FUNCIONARIO solo ve su tenant', () => {
    const visibles = radicadosVisiblesParaRol(lista, USUARIO_FUNC_GOBIERNO);
    expect(visibles).toHaveLength(1);
    expect(visibles[0].radicadoId).toBe('A');
  });

  it('JEFE_DEPENDENCIA igual que FUNCIONARIO', () => {
    const jefe: UsuarioReporte = { ...USUARIO_FUNC_GOBIERNO, rol: 'JEFE_DEPENDENCIA' };
    const visibles = radicadosVisiblesParaRol(lista, jefe);
    expect(visibles).toHaveLength(1);
  });

  it('CONTROL_INTERNO ve todos', () => {
    const ci: UsuarioReporte = { ...USUARIO_ADMIN, rol: 'CONTROL_INTERNO' };
    expect(radicadosVisiblesParaRol(lista, ci)).toHaveLength(3);
  });
});

describe('indicadores — tasa de resolución y cumplimiento', () => {
  it('calcula tasa de resolución y cumplimiento correctamente', () => {
    const lista = [
      radicado({ radicadoId: 'A', estadoActual: 'RESUELTO',   cumplioTermino: true  }),
      radicado({ radicadoId: 'B', estadoActual: 'RESUELTO',   cumplioTermino: false }),
      radicado({ radicadoId: 'C', estadoActual: 'PENDIENTE',  cumplioTermino: null  }),
      radicado({ radicadoId: 'D', estadoActual: 'ASIGNADO',   cumplioTermino: null  }),
    ];
    const ind = calcularIndicadoresMipg(lista);
    expect(ind.totalRadicados).toBe(4);
    expect(ind.resueltos).toBe(2);
    expect(ind.resueltosEnTermino).toBe(1);
    expect(ind.resueltosFueraDeTermino).toBe(1);
    expect(ind.tasaResolucionPct).toBe(50);
    expect(ind.cumplimientoTerminosPct).toBe(50);
  });

  it('cumplimiento es null si no hay datos', () => {
    const lista = [radicado({ cumplioTermino: null, estadoActual: 'PENDIENTE' })];
    const ind = calcularIndicadoresMipg(lista);
    expect(ind.cumplimientoTerminosPct).toBeNull();
  });

  it('cuenta notificaciones fallidas desde flag raíz', () => {
    const lista = [
      radicado({ radicadoId: 'A', alertaNotificacionFallida: true }),
      radicado({ radicadoId: 'B', alertaNotificacionFallida: false }),
      radicado({ radicadoId: 'C' }),
    ];
    const ind = calcularIndicadoresMipg(lista);
    expect(ind.notificacionesFallidas).toBe(1);
  });

  it('cuenta anónimos y reservados', () => {
    const lista = [
      radicado({ radicadoId: 'A', esAnonimo: true, tipoPresentacion: 'ANONIMA' }),
      radicado({ radicadoId: 'B', tipoPresentacion: 'RESERVADA', identidadReservada: true }),
      radicado({ radicadoId: 'C' }),
    ];
    const ind = calcularIndicadoresMipg(lista);
    expect(ind.anonimosOReservados).toBe(2);
  });
});

describe('indicadores — agrupación por dependencia', () => {
  it('agrupa correctamente y calcula cumplimiento por dependencia', () => {
    const lista = [
      radicado({ radicadoId: 'A', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_GOBIERNO'   }, estadoActual: 'RESUELTO',  cumplioTermino: true }),
      radicado({ radicadoId: 'B', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_GOBIERNO'   }, estadoActual: 'RESUELTO',  cumplioTermino: false }),
      radicado({ radicadoId: 'C', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_PLANEACION' }, estadoActual: 'PENDIENTE', cumplioTermino: null }),
    ];
    const grupos = calcularCumplimientoPorDependencia(lista);
    const gobierno = grupos.find((g) => g.tenantId === 'SEC_GOBIERNO');
    const planeacion = grupos.find((g) => g.tenantId === 'SEC_PLANEACION');
    expect(gobierno?.total).toBe(2);
    expect(gobierno?.resueltos).toBe(2);
    expect(gobierno?.cumplimientoPct).toBe(50);
    expect(planeacion?.total).toBe(1);
    expect(planeacion?.cumplimientoPct).toBeNull();
  });
});

describe('extracción de notificaciones', () => {
  it('extrae eventos NOTIFICACION_* y mapea estado', () => {
    const traza: TrazabilidadRadicado[] = [
      { fecha: '2026-06-14T10:00:00Z', accion: 'RADICACION' as const, actorUid: 's', actorNombre: 'Sistema', nota: '' },
      { fecha: '2026-06-14T10:01:00Z', accion: 'NOTIFICACION_CORREO_ENVIADA' as const, actorUid: 's', actorNombre: 'Sistema', nota: 'ok',
        metadata: { tipoNotificacion: 'RADICACION', destinatario: 'a@b.com' } },
      { fecha: '2026-06-14T11:00:00Z', accion: 'NOTIFICACION_CORREO_FALLIDA' as const, actorUid: 's', actorNombre: 'Sistema', nota: 'fail',
        metadata: { tipoNotificacion: 'ASIGNACION', destinatario: 'a@b.com', error: 'SMTP-535' } },
    ];
    const mapa = new Map<string, TrazabilidadRadicado[]>();
    mapa.set('1-WEB-2026-00000001', traza);
    const notis = extraerNotificaciones(mapa);
    expect(notis).toHaveLength(2);
    expect(notis[0].estado).toBe('ENVIADA');
    expect(notis[1].estado).toBe('FALLIDA');
    expect(notis[1].error).toBe('SMTP-535');
  });
});

describe('generarReporteExcelMipg — libro completo', () => {
  const TIMEOUT = 30000;
  it('produce un .xlsx con las 8 hojas esperadas, formato y privacidad', async () => {
    const radicados = [
      radicado(),
      radicado({ radicadoId: '1-WEB-2026-00000002', esAnonimo: true, tipoPresentacion: 'ANONIMA' }),
      radicado({ radicadoId: '1-WEB-2026-00000003', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_PLANEACION' } }),
    ];
    const buf = await generarReporteExcelMipg({
      usuario: USUARIO_ADMIN,
      radicados,
      trazabilidadPorRadicado: new Map(),
      simiAuditoria: [],
      simiFeedback: [],
    });
    expect(buf).toBeInstanceOf(Buffer);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);

    const hojas = wb.worksheets.map((w) => w.name);
    expect(hojas).toEqual([
      'Resumen Ejecutivo',
      'Indicadores MIPG',
      'Radicados',
      'Trazabilidad',
      'Cumplimiento Dependencia',
      'Notificaciones',
      'SIMI',
      'Diccionario de Datos',
    ]);

    // Hoja Radicados: no incluye respuestaOficial.nota completa ni archivoPath crudo
    const ws = wb.getWorksheet('Radicados')!;
    let textoCompleto = '';
    ws.eachRow((row) => { row.eachCell((c) => { textoCompleto += '\n' + String(c.value ?? ''); }); });
    expect(textoCompleto).not.toContain('Respuesta oficial completa al ciudadano.');
    expect(textoCompleto).not.toContain('respuestas/SECRET/oficio.pdf');
    expect(textoCompleto).not.toContain('usr_uid_SECRET');
    // El anónimo aparece enmascarado, su nombre real no debe aparecer
    expect(textoCompleto).toContain('Anónimo / Reservado');
  }, TIMEOUT);

  it('FUNCIONARIO obtiene solo radicados de su dependencia', async () => {
    const radicados = [
      radicado({ radicadoId: 'A', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_GOBIERNO'   } }),
      radicado({ radicadoId: 'B', clasificacion: { ...radicado().clasificacion, oficinaDestino: 'SEC_PLANEACION' } }),
    ];
    const buf = await generarReporteExcelMipg({
      usuario: USUARIO_FUNC_GOBIERNO,
      radicados,
      trazabilidadPorRadicado: new Map(),
      simiAuditoria: [],
      simiFeedback: [],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet('Radicados')!;
    let textoCompleto = '';
    ws.eachRow((row) => { row.eachCell((c) => { textoCompleto += '\n' + String(c.value ?? ''); }); });
    expect(textoCompleto).toContain('A');
    expect(textoCompleto).not.toContain('\nB\n');
  }, TIMEOUT);

  it('hoja Trazabilidad separa eventos en filas, no rompe la hoja Radicados', async () => {
    const traza: TrazabilidadRadicado[] = [
      { fecha: '2026-06-01T10:00:00Z', accion: 'RADICACION' as const, actorUid: 's', actorNombre: 'Portal', nota: 'Radicado creado' },
      { fecha: '2026-06-02T10:00:00Z', accion: 'ASIGNACION' as const, actorUid: 'u', actorNombre: 'Recepción', nota: 'Asignado a Gobierno' },
    ];
    const mapa = new Map<string, TrazabilidadRadicado[]>();
    mapa.set(radicado().radicadoId, traza);
    const buf = await generarReporteExcelMipg({
      usuario: USUARIO_ADMIN,
      radicados: [radicado()],
      trazabilidadPorRadicado: mapa,
      simiAuditoria: [],
      simiFeedback: [],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const tz = wb.getWorksheet('Trazabilidad')!;
    // 1 encabezado + 2 filas de eventos
    expect(tz.actualRowCount).toBe(3);
  }, TIMEOUT);
});
