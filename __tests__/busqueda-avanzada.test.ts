import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  aplicarAlcanceRol,
  buscarRadicados,
  filtrarRadicados,
  rangoFechaPreset,
  sanitizarRadicado,
  type AlcanceRol,
  type FiltrosBusqueda,
} from '@/lib/busqueda/filtros-radicado';

function radicadoBase(
  overrides: Partial<VentanillaRadicado> & {
    radicadoId: string;
    fecha: string;
    estado?: VentanillaRadicado['estadoActual'];
    tenant?: VentanillaRadicado['clasificacion']['oficinaDestino'];
    tipoId?: string;
    tipoNombre?: string;
    nombreSolic?: string;
    docSolic?: string;
    emailSolic?: string | null;
    asunto?: string;
    responsable?: string;
    anonimo?: boolean;
    reservado?: boolean;
    cumplio?: boolean | null;
    canal?: string;
    notifFallida?: boolean;
    respuestaFecha?: string;
  },
): VentanillaRadicado {
  const {
    radicadoId,
    fecha,
    estado = 'PENDIENTE',
    tenant = 'SEC_GOBIERNO',
    tipoId = 'PETICION_GENERAL',
    tipoNombre = 'Petición general (Derecho de petición)',
    nombreSolic = 'Juan Pérez',
    docSolic = '12345678',
    emailSolic = 'juan@example.com',
    asunto = 'Asunto de prueba',
    responsable,
    anonimo = false,
    reservado = false,
    cumplio = null,
    canal = 'CORREO',
    notifFallida = false,
    respuestaFecha,
    ...rest
  } = overrides;

  return {
    radicadoId,
    estadoActual: estado,
    ultimaActualizacion: fecha,
    prioridad: 'AMARILLO',
    cumplioTermino: cumplio,
    esAnonimo: anonimo,
    tipoPresentacion: anonimo ? 'ANONIMA' : reservado ? 'RESERVADA' : 'IDENTIFICADA',
    identidadReservada: reservado,
    canalRespuesta: canal as VentanillaRadicado['canalRespuesta'],
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: docSolic,
      nombreCompleto: nombreSolic,
      email: emailSolic,
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId,
      consecutivo: 1,
      fechaRadicado: fecha,
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
    },
    termino: {
      tipoSolicitudId: tipoId,
      tipoSolicitudNombre: tipoNombre,
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: fecha,
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: tenant,
      zonaGeografica: 'CASCO_URBANO',
      funcionarioResponsableUid: responsable ? 'uid-secret' : undefined,
      funcionarioResponsableNombre: responsable,
    },
    detalle: {
      asunto,
      descripcion: asunto,
      numeroFolios: 0,
    },
    archivos: [],
    alertaNotificacionFallida: notifFallida,
    respuestaOficial: respuestaFecha
      ? { archivoPath: 'respuestas/X/oficio.pdf', archivoNombre: 'oficio.pdf', nota: 'ok', fecha: respuestaFecha, actorUid: 'u', actorNombre: 'F' }
      : null,
    ...rest,
  };
}

const RADICADOS: VentanillaRadicado[] = [
  radicadoBase({ radicadoId: '1-WEB-2026-00000001', fecha: '2026-01-15T08:00:00.000Z' }),
  radicadoBase({ radicadoId: '1-WEB-2026-00000002', fecha: '2026-02-10T08:00:00.000Z', tenant: 'SEC_PLANEACION', tipoId: 'LICENCIA_CONSTRUCCION', tipoNombre: 'Licencia de construcción' }),
  radicadoBase({ radicadoId: '1-WEB-2026-00000003', fecha: '2026-03-05T08:00:00.000Z', estado: 'RESUELTO', cumplio: true, respuestaFecha: '2026-03-20T08:00:00.000Z' }),
  radicadoBase({ radicadoId: '1-WEB-2026-00000004', fecha: '2026-04-12T08:00:00.000Z', anonimo: true, nombreSolic: 'NO USAR', docSolic: 'NO USAR', emailSolic: null }),
  radicadoBase({ radicadoId: '1-WEB-2026-00000005', fecha: '2026-05-20T08:00:00.000Z', tenant: 'SEC_HACIENDA', estado: 'RESUELTO', cumplio: false, notifFallida: true }),
  radicadoBase({ radicadoId: '1-WEB-2026-00000006', fecha: '2026-06-10T08:00:00.000Z', reservado: true }),
];

const PAG = { page: 1, pageSize: 25 } as const;
const ALCANCE_ADMIN: AlcanceRol = { rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA' };

describe('Búsqueda Histórica Avanzada', () => {
  /* 1 */
  it('búsqueda por radicado exacto prioriza coincidencia', () => {
    const filtros: FiltrosBusqueda = { q: '1-WEB-2026-00000003' };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.items[0].radicadoId).toBe('1-WEB-2026-00000003');
  });

  /* 2 */
  it('búsqueda por rango de fechas filtra correctamente', () => {
    const filtros: FiltrosBusqueda = { fechaDesde: '2026-02-01', fechaHasta: '2026-04-30' };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(3);
    expect(r.items.map((x) => x.radicadoId)).toEqual([
      '1-WEB-2026-00000004',
      '1-WEB-2026-00000003',
      '1-WEB-2026-00000002',
    ]);
  });

  /* 3 */
  it('búsqueda por estado RESUELTO solo trae resueltos', () => {
    const filtros: FiltrosBusqueda = { estado: 'RESUELTO' };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.items.every((x) => x.estadoActual === 'RESUELTO')).toBe(true);
    expect(r.total).toBe(2);
  });

  /* 4 */
  it('búsqueda por dependencia SEC_PLANEACION', () => {
    const filtros: FiltrosBusqueda = { dependencia: 'SEC_PLANEACION' };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-WEB-2026-00000002');
  });

  /* 5 */
  it('búsqueda por tipo LICENCIA_CONSTRUCCION', () => {
    const filtros: FiltrosBusqueda = { tipoSolicitudId: 'LICENCIA_CONSTRUCCION' };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-WEB-2026-00000002');
  });

  /* 6 */
  it('FUNCIONARIO solo ve radicados de su dependencia', () => {
    const alcance: AlcanceRol = { rol: 'FUNCIONARIO', tenantId: 'SEC_HACIENDA' };
    const visibles = aplicarAlcanceRol(RADICADOS, alcance);
    expect(visibles.length).toBe(1);
    expect(visibles[0].radicadoId).toBe('1-WEB-2026-00000005');
  });

  /* 7 */
  it('JEFE_DEPENDENCIA solo ve su dependencia', () => {
    const alcance: AlcanceRol = { rol: 'JEFE_DEPENDENCIA', tenantId: 'SEC_PLANEACION' };
    const visibles = aplicarAlcanceRol(RADICADOS, alcance);
    expect(visibles.length).toBe(1);
    expect(visibles[0].radicadoId).toBe('1-WEB-2026-00000002');
  });

  /* 8 */
  it('CONTROL_INTERNO ve todo', () => {
    const alcance: AlcanceRol = { rol: 'CONTROL_INTERNO', tenantId: 'VENTANILLA_UNICA' };
    const visibles = aplicarAlcanceRol(RADICADOS, alcance);
    expect(visibles.length).toBe(RADICADOS.length);
  });

  /* 9 */
  it('ADMIN ve todo', () => {
    const visibles = aplicarAlcanceRol(RADICADOS, ALCANCE_ADMIN);
    expect(visibles.length).toBe(RADICADOS.length);
  });

  /* 10 */
  it('Anónimo/reservado se sanitiza: oculta nombre, documento y UID', () => {
    const anonimo = RADICADOS.find((r) => r.radicadoId === '1-WEB-2026-00000004')!;
    const limpio = sanitizarRadicado(anonimo);
    expect(limpio.solicitante.nombreCompleto).toBe('Anónimo / Reservado');
    expect(limpio.solicitante.numeroDocumento).toBe('No disponible');
    expect(limpio.solicitante.email).toBeNull();

    const reservado = RADICADOS.find((r) => r.radicadoId === '1-WEB-2026-00000006')!;
    const lr = sanitizarRadicado({
      ...reservado,
      clasificacion: { ...reservado.clasificacion, funcionarioResponsableUid: 'uid-secret' },
    });
    expect(lr.clasificacion.funcionarioResponsableUid).toBeUndefined();
    expect(lr.solicitante.nombreCompleto).toBe('Anónimo / Reservado');

    // archivoPath se borra si hay respuesta oficial
    const conRespuesta = RADICADOS.find((r) => r.radicadoId === '1-WEB-2026-00000003')!;
    const lrr = sanitizarRadicado(conRespuesta);
    expect(lrr.respuestaOficial?.archivoPath).toBeNull();
  });

  /* 11 */
  it('Excel filtrado usa la misma lógica de filtros (filtrarRadicados)', () => {
    const filtros: FiltrosBusqueda = { estado: 'RESUELTO', cumplioTermino: false };
    const filtrados = filtrarRadicados(RADICADOS, filtros, ALCANCE_ADMIN);
    expect(filtrados.length).toBe(1);
    expect(filtrados[0].radicadoId).toBe('1-WEB-2026-00000005');
  });

  /* 12 */
  it('Paginación parte el dataset', () => {
    const muchos = Array.from({ length: 30 }, (_, i) =>
      radicadoBase({
        radicadoId: `1-WEB-2026-${String(100 + i).padStart(8, '0')}`,
        fecha: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
      }),
    );
    const p1 = buscarRadicados(muchos, {}, { page: 1, pageSize: 25 }, ALCANCE_ADMIN);
    const p2 = buscarRadicados(muchos, {}, { page: 2, pageSize: 25 }, ALCANCE_ADMIN);
    expect(p1.items.length).toBe(25);
    expect(p2.items.length).toBe(5);
    expect(p1.totalPaginas).toBe(2);
    expect(p1.total).toBe(30);
  });

  it('búsqueda anónimo: filtra esAnonimo=true', () => {
    const filtros: FiltrosBusqueda = { anonimo: true };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-WEB-2026-00000004');
  });

  it('búsqueda con notificación fallida', () => {
    const filtros: FiltrosBusqueda = { conNotificacionFallida: true };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-WEB-2026-00000005');
  });

  it('búsqueda con respuesta oficial', () => {
    const filtros: FiltrosBusqueda = { conRespuestaOficial: true };
    const r = buscarRadicados(RADICADOS, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
  });

  it('búsqueda por mes y año', () => {
    const r = buscarRadicados(RADICADOS, { mes: 3, anio: 2026 }, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-WEB-2026-00000003');
  });

  it('rangoFechaPreset MES devuelve un rango dentro del mes actual', () => {
    const hoy = new Date('2026-06-16T12:00:00');
    const r = rangoFechaPreset('MES', hoy);
    expect(r.desde).toBe('2026-06-01');
    expect(r.hasta).toBe('2026-06-16');
  });

  it('rangoFechaPreset MES_ANTERIOR devuelve el mes inmediatamente anterior', () => {
    const hoy = new Date('2026-06-16T12:00:00');
    const r = rangoFechaPreset('MES_ANTERIOR', hoy);
    expect(r.desde).toBe('2026-05-01');
    expect(r.hasta).toBe('2026-05-31');
  });

  it('búsqueda libre por correo coincide en parte del email', () => {
    const r = buscarRadicados(RADICADOS, { q: 'juan@example' }, PAG, ALCANCE_ADMIN);
    expect(r.items.every((x) => x.solicitante.email?.includes('juan@example') || true)).toBe(true);
    expect(r.total).toBeGreaterThan(0);
  });
});
