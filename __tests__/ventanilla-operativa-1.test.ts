import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  buscarRadicados,
  type AlcanceRol,
  type FiltrosBusqueda,
} from '@/lib/busqueda/filtros-radicado';
import { aRadicadoPublico } from '@/lib/seguridad/consulta-publica-radicado';
import {
  validarReglaCorreoNoAportado,
  RadicacionValidacionError,
} from '@/lib/actions/radicarVentanilla';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 1
   Cobertura de los campos operativos añadidos al modelo:
   origenIngreso, tipoEntrada, datosNoAportados, telefonoMovil/Fijo,
   barrio y numeroAnexos / observacionesAnexos.

   Los tests son 100% puros: no tocan Firestore ni Storage — validan
   forma de datos, reglas de negocio, filtros de búsqueda y mapper
   de consulta pública.
══════════════════════════════════════════════════════════════ */

const ALCANCE_ADMIN: AlcanceRol = { rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA' };
const PAG = { page: 1, pageSize: 25 } as const;

function radicadoOp(
  overrides: Partial<VentanillaRadicado> & { radicadoId: string; fecha: string },
): VentanillaRadicado {
  const {
    radicadoId,
    fecha,
    ...rest
  } = overrides;
  return {
    radicadoId,
    estadoActual: 'PENDIENTE',
    ultimaActualizacion: fecha,
    prioridad: 'AMARILLO',
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1098765432',
      nombreCompleto: 'Ciudadano Ejemplo',
      email: 'ciudadano@ejemplo.com',
      telefonoMovil: '3001112233',
      telefonoFijo: '6087654321',
      direccion: 'Calle 1 # 2-3',
      ubicacion: {
        pais: 'Colombia',
        departamento: 'Santander',
        municipio: 'Simacota',
        barrio: 'Centro',
      },
    },
    control: {
      radicadoId,
      consecutivo: 1,
      fechaRadicado: fecha,
      horaRadicado: '08:00',
      medioRecepcion: 'WEB',
      origen: 'WEB',
      origenIngreso: 'PQRSD_WEB_OFICIAL',
      tipoEntrada: 'PQRSD',
    },
    termino: {
      tipoSolicitudId: 'PETICION_GENERAL',
      tipoSolicitudNombre: 'Petición general',
      diasRespuesta: 15,
      unidad: 'HABILES',
      fechaVencimiento: fecha,
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino: 'VENTANILLA_UNICA',
      zonaGeografica: 'CASCO_URBANO',
    },
    detalle: {
      asunto: 'Solicitud operativa',
      descripcion: 'Detalle operativo',
      numeroFolios: 2,
      numeroAnexos: 3,
      observacionesAnexos: '3 folios de historia clínica',
    },
    archivos: [],
    ...rest,
  };
}

/* ══════════════════════════════════════════════════════════════
   1 · Forma del documento
══════════════════════════════════════════════════════════════ */

describe('Sprint Ventanilla Operativa 1 — forma del documento', () => {
  /* 1 */
  it('persiste origenIngreso y tipoEntrada en el control', () => {
    const r = radicadoOp({
      radicadoId: '1-OFICIO-2026-00000010',
      fecha: '2026-06-01T08:00:00.000Z',
      control: {
        radicadoId: '1-OFICIO-2026-00000010',
        consecutivo: 10,
        fechaRadicado: '2026-06-01T08:00:00.000Z',
        horaRadicado: '08:00',
        medioRecepcion: 'OFICIO_FISICO',
        origen: 'FISICO_ESCANER',
        origenIngreso: 'OFICIO_EXTERNO',
        tipoEntrada: 'OFICIO_INSTITUCIONAL',
      },
    });
    expect(r.control.origenIngreso).toBe('OFICIO_EXTERNO');
    expect(r.control.tipoEntrada).toBe('OFICIO_INSTITUCIONAL');
  });

  /* 2 */
  it('acepta tipoPersona ENTIDAD_PUBLICA con razonSocial', () => {
    const r = radicadoOp({
      radicadoId: '1-OFICIO-2026-00000011',
      fecha: '2026-06-02T08:00:00.000Z',
      solicitante: {
        tipoPersona: 'ENTIDAD_PUBLICA',
        tipoDocumento: 'NIT',
        numeroDocumento: '900123456-7',
        nombreCompleto: 'Gobernación de Santander',
        razonSocial: 'Gobernación de Santander',
        email: 'contactenos@santander.gov.co',
        telefonoFijo: '6076302222',
        ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Bucaramanga' },
      },
    });
    expect(r.solicitante.tipoPersona).toBe('ENTIDAD_PUBLICA');
    expect(r.solicitante.razonSocial).toBe('Gobernación de Santander');
  });

  /* 3 */
  it('registra datosNoAportados con las marcas exactas del solicitante', () => {
    const r = radicadoOp({
      radicadoId: '1-PRESENCIAL-2026-00000012',
      fecha: '2026-06-03T08:00:00.000Z',
      solicitante: {
        tipoPersona: 'NO_IDENTIFICADO',
        tipoDocumento: 'OTRO',
        numeroDocumento: 'NO_APORTADO',
        nombreCompleto: 'Sin identificación aportada',
        ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
        datosNoAportados: {
          documento: true,
          correo: true,
          telefono: false,
          direccion: true,
        },
      },
    });
    expect(r.solicitante.datosNoAportados).toEqual({
      documento: true,
      correo: true,
      telefono: false,
      direccion: true,
    });
  });

  /* 4 */
  it('separa telefonoMovil y telefonoFijo en el solicitante', () => {
    const r = radicadoOp({
      radicadoId: '1-WEB-2026-00000013',
      fecha: '2026-06-04T08:00:00.000Z',
    });
    expect(r.solicitante.telefonoMovil).toBe('3001112233');
    expect(r.solicitante.telefonoFijo).toBe('6087654321');
  });

  /* 5 */
  it('persiste barrio en la ubicación del solicitante', () => {
    const r = radicadoOp({
      radicadoId: '1-WEB-2026-00000014',
      fecha: '2026-06-05T08:00:00.000Z',
    });
    expect(r.solicitante.ubicacion.barrio).toBe('Centro');
  });

  /* 6 */
  it('persiste numeroAnexos y observacionesAnexos en el detalle', () => {
    const r = radicadoOp({
      radicadoId: '1-WEB-2026-00000015',
      fecha: '2026-06-06T08:00:00.000Z',
    });
    expect(r.detalle.numeroAnexos).toBe(3);
    expect(r.detalle.observacionesAnexos).toBe('3 folios de historia clínica');
  });
});

/* ══════════════════════════════════════════════════════════════
   2 · Regla de negocio server-side
══════════════════════════════════════════════════════════════ */

describe('Sprint Ventanilla Operativa 1 — regla de correo no aportado', () => {
  /* 7 */
  it('rechaza canal CORREO cuando el solicitante no aporta correo', () => {
    const mensaje = validarReglaCorreoNoAportado({ noAportaCorreo: true, canalRespuesta: 'CORREO' });
    expect(mensaje).toMatch(/correo/i);

    expect(() => {
      const err = validarReglaCorreoNoAportado({ noAportaCorreo: true, canalRespuesta: 'CORREO' });
      if (err) throw new RadicacionValidacionError(err);
    }).toThrow(RadicacionValidacionError);
  });

  /* 8 */
  it('permite canal PRESENCIAL cuando el solicitante no aporta correo', () => {
    expect(validarReglaCorreoNoAportado({ noAportaCorreo: true, canalRespuesta: 'PRESENCIAL' })).toBeNull();
    expect(validarReglaCorreoNoAportado({ noAportaCorreo: false, canalRespuesta: 'CORREO' })).toBeNull();
    expect(validarReglaCorreoNoAportado({})).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════
   3 · Filtros de búsqueda avanzada
══════════════════════════════════════════════════════════════ */

describe('Sprint Ventanilla Operativa 1 — filtros de búsqueda', () => {
  const dataset: VentanillaRadicado[] = [
    radicadoOp({
      radicadoId: '1-WEB-2026-00000020',
      fecha: '2026-06-10T08:00:00.000Z',
      control: {
        radicadoId: '1-WEB-2026-00000020',
        consecutivo: 20,
        fechaRadicado: '2026-06-10T08:00:00.000Z',
        horaRadicado: '08:00',
        medioRecepcion: 'WEB',
        origen: 'WEB',
        origenIngreso: 'PQRSD_WEB_OFICIAL',
        tipoEntrada: 'PQRSD',
      },
    }),
    radicadoOp({
      radicadoId: '1-OFICIO-2026-00000021',
      fecha: '2026-06-11T08:00:00.000Z',
      control: {
        radicadoId: '1-OFICIO-2026-00000021',
        consecutivo: 21,
        fechaRadicado: '2026-06-11T08:00:00.000Z',
        horaRadicado: '08:00',
        medioRecepcion: 'OFICIO_FISICO',
        origen: 'FISICO_ESCANER',
        origenIngreso: 'OFICIO_EXTERNO',
        tipoEntrada: 'OFICIO_INSTITUCIONAL',
      },
    }),
    radicadoOp({
      radicadoId: '1-PRESENCIAL-2026-00000022',
      fecha: '2026-06-12T08:00:00.000Z',
      control: {
        radicadoId: '1-PRESENCIAL-2026-00000022',
        consecutivo: 22,
        fechaRadicado: '2026-06-12T08:00:00.000Z',
        horaRadicado: '08:00',
        medioRecepcion: 'PRESENCIAL',
        origen: 'FISICO_ESCANER',
        origenIngreso: 'VENTANILLA_FISICA',
        tipoEntrada: 'CORRESPONDENCIA_RECIBIDA',
      },
    }),
  ];

  /* 9 */
  it('filtra por origenIngreso', () => {
    const filtros: FiltrosBusqueda = { origenIngreso: 'OFICIO_EXTERNO' };
    const r = buscarRadicados(dataset, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-OFICIO-2026-00000021');
  });

  /* 10 */
  it('filtra por tipoEntrada', () => {
    const filtros: FiltrosBusqueda = { tipoEntrada: 'CORRESPONDENCIA_RECIBIDA' };
    const r = buscarRadicados(dataset, filtros, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(1);
    expect(r.items[0].radicadoId).toBe('1-PRESENCIAL-2026-00000022');
  });

  /* 11 — compatibilidad histórica: radicado sin origenIngreso/tipoEntrada */
  it('no rompe con radicados históricos sin origenIngreso / tipoEntrada', () => {
    const historico = radicadoOp({
      radicadoId: '1-WEB-2024-00000099',
      fecha: '2024-01-01T08:00:00.000Z',
      control: {
        radicadoId: '1-WEB-2024-00000099',
        consecutivo: 99,
        fechaRadicado: '2024-01-01T08:00:00.000Z',
        horaRadicado: '08:00',
        medioRecepcion: 'WEB',
        origen: 'WEB',
        // sin origenIngreso ni tipoEntrada
      },
    });
    const r = buscarRadicados([...dataset, historico], {}, PAG, ALCANCE_ADMIN);
    expect(r.total).toBe(4);
    // Y el filtro por origenIngreso no lo incluye:
    const rFiltro = buscarRadicados([...dataset, historico], { origenIngreso: 'PQRSD_WEB_OFICIAL' }, PAG, ALCANCE_ADMIN);
    expect(rFiltro.items.some((x) => x.radicadoId === '1-WEB-2024-00000099')).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════
   4 · Protección de consulta pública
══════════════════════════════════════════════════════════════ */

describe('Sprint Ventanilla Operativa 1 — consulta pública no expone campos internos', () => {
  /* 12 */
  it('aRadicadoPublico NO expone origenIngreso, tipoEntrada, datosNoAportados, barrio, teléfonos ni observaciones', () => {
    const rad = radicadoOp({
      radicadoId: '1-WEB-2026-00000030',
      fecha: '2026-06-15T08:00:00.000Z',
      solicitante: {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'CC',
        numeroDocumento: '1098765432',
        nombreCompleto: 'Ciudadano Ejemplo',
        email: 'ciudadano@ejemplo.com',
        telefonoMovil: '3001112233',
        telefonoFijo: '6087654321',
        ubicacion: {
          pais: 'Colombia',
          departamento: 'Santander',
          municipio: 'Simacota',
          barrio: 'Centro',
        },
        datosNoAportados: { correo: false, telefono: false, direccion: false, documento: false },
      },
    });

    const publico = aRadicadoPublico({ radicado: rad });
    const serializado = JSON.stringify(publico);

    // Ninguno de los campos operativos internos debe estar presente.
    expect(serializado).not.toContain('origenIngreso');
    expect(serializado).not.toContain('tipoEntrada');
    expect(serializado).not.toContain('datosNoAportados');
    expect(serializado).not.toContain('telefonoMovil');
    expect(serializado).not.toContain('telefonoFijo');
    expect(serializado).not.toContain('observacionesAnexos');
    expect(serializado).not.toContain('numeroAnexos');
    // El barrio del solicitante tampoco:
    expect(serializado).not.toContain('Centro');
    // Y los teléfonos crudos tampoco viajan:
    expect(serializado).not.toContain('3001112233');
    expect(serializado).not.toContain('6087654321');

    // Los campos públicos esperados sí están:
    expect(publico.numeroRadicado).toBe('1-WEB-2026-00000030');
    expect(publico.estadoPublico).toBeDefined();
  });

  /* 13 — Sprint 1.5: endurecimiento de aRadicadoPublico
     Verifica que el objeto retornado solo contenga claves declaradas en
     RadicadoPublico. Complementa la barrera compile-time (`satisfies`
     + variable tipada) con una barrera runtime. */
  it('aRadicadoPublico solo expone claves declaradas en RadicadoPublico', () => {
    const rad = radicadoOp({
      radicadoId: '1-WEB-2026-00000031',
      fecha: '2026-06-16T08:00:00.000Z',
    });
    const publico = aRadicadoPublico({
      radicado: rad,
      lineaTiempo: [{ fecha: '2026-06-16T08:00:00.000Z', evento: 'Solicitud recibida' }],
    });

    const permitidas = new Set([
      'numeroRadicado',
      'fechaRadicacion',
      'estadoPublico',
      'dependencia',
      'tipoSolicitud',
      'fechaVencimiento',
      'requiereAclaracion',
      'fueRespondido',
      'fechaRespuesta',
      'canalRespuesta',
      'respuestaDisponible',
      'respuestaOficial',
      'lineaTiempo',
    ]);

    for (const key of Object.keys(publico)) {
      expect(permitidas.has(key)).toBe(true);
    }
  });
});
