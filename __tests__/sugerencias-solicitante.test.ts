import { describe, expect, it } from 'vitest';
import type { VentanillaRadicado } from '@/src/types/ventanilla';
import {
  buscarSolicitantes,
  construirDirectorio,
  enmascararDocumento,
} from '@/lib/recepcion/sugerencias-solicitante';

/* ══════════════════════════════════════════════════════════════
   Sprint Solicitante frecuente — directorio y búsqueda.

   Parámetros aprobados: exclusión de anónimos/reservados en la
   construcción, dedupe por documento con más-reciente-manda, sin
   documento fuera (limitación v1), 3+ caracteres, máximo 5,
   documento enmascarado, sin copiar datosNoAportados.
══════════════════════════════════════════════════════════════ */

function radicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  return {
    radicadoId:          '1-WEB-2026-00000010',
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: '2026-07-02T15:00:00.000Z',
    prioridad:           'AMARILLO',
    esAnonimo:           false,
    tipoPresentacion:    'IDENTIFICADA',
    identidadReservada:  false,
    canalRespuesta:      'CORREO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1101321226',
      nombreCompleto:  'Robinson David Galvis',
      email:           'robinson@example.com',
      telefonoMovil:   '3203452716',
      direccion:       'Carrera 4 620',
      ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId:     '1-WEB-2026-00000010',
      consecutivo:    10,
      fechaRadicado:  '2026-07-02T15:00:00.000Z',
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
    clasificacion: { oficinaDestino: 'VENTANILLA_UNICA', zonaGeografica: 'CASCO_URBANO' },
    detalle: { asunto: 'Solicitud', descripcion: 'Descripción', numeroFolios: 1 },
    archivos: [],
    ...overrides,
  };
}

describe('Solicitante frecuente — construirDirectorio', () => {
  /* 1 · anónimos, reservados y presentación no identificada quedan fuera */
  it('excluye anónimos, identidad reservada y presentación no identificada', () => {
    const dir = construirDirectorio([
      radicado({ esAnonimo: true }),
      radicado({ identidadReservada: true }),
      radicado({ tipoPresentacion: 'RESERVADA' }),
    ]);
    expect(dir).toHaveLength(0);
  });

  /* 2 · limitación v1: sin documento no hay entrada */
  it('excluye solicitantes sin número de documento', () => {
    const sinDoc = radicado();
    sinDoc.solicitante.numeroDocumento = '   ';
    expect(construirDirectorio([sinDoc])).toHaveLength(0);
  });

  /* 3 · dedupe por documento: el radicado más reciente manda */
  it('con dos radicados del mismo documento ganan los datos más recientes', () => {
    const viejo = radicado();
    viejo.solicitante.email = 'viejo@example.com';
    const nuevo = radicado({
      radicadoId: '1-WEB-2026-00000020',
      control: { ...radicado().control, fechaRadicado: '2026-07-03T10:00:00.000Z' },
    });
    nuevo.solicitante.email = 'nuevo@example.com';

    const dir = construirDirectorio([nuevo, viejo]);
    expect(dir).toHaveLength(1);
    expect(dir[0].email).toBe('nuevo@example.com');
  });

  /* 4 · el teléfono legacy alimenta el móvil como fallback */
  it('usa telefono legacy cuando no hay telefonoMovil', () => {
    const legacy = radicado();
    legacy.solicitante.telefonoMovil = null;
    legacy.solicitante.telefono = '6076543';
    expect(construirDirectorio([legacy])[0].telefonoMovil).toBe('6076543');
  });

  /* 5 · las marcas por-radicación no viajan al directorio */
  it('no copia datosNoAportados a la salida', () => {
    const conMarcas = radicado();
    conMarcas.solicitante.datosNoAportados = { telefono: true };
    const dir = construirDirectorio([conMarcas]);
    expect(JSON.stringify(dir)).not.toContain('datosNoAportados');
  });
});

describe('Solicitante frecuente — buscarSolicitantes', () => {
  const directorio = construirDirectorio([
    radicado(),
    radicado({
      radicadoId: '1-WEB-2026-00000011',
      solicitante: {
        ...radicado().solicitante,
        numeroDocumento: '52468913',
        nombreCompleto:  'María Pérez Niño',
      },
      control: { ...radicado().control, radicadoId: '1-WEB-2026-00000011' },
    }),
  ]);

  /* 6 · por nombre, insensible a tildes */
  it("'perez' sin tilde encuentra a 'Pérez'", () => {
    const r = buscarSolicitantes(directorio, 'perez');
    expect(r).toHaveLength(1);
    expect(r[0].nombreCompleto).toBe('María Pérez Niño');
  });

  /* 7 · por prefijo de documento */
  it("'1101' encuentra por prefijo de documento", () => {
    const r = buscarSolicitantes(directorio, '1101');
    expect(r).toHaveLength(1);
    expect(r[0].numeroDocumento).toBe('1101321226');
  });

  /* 8 · bajo 3 caracteres no sugiere (privacidad de pantalla) */
  it('con menos de 3 caracteres devuelve vacío', () => {
    expect(buscarSolicitantes(directorio, 'ro')).toHaveLength(0);
  });

  /* 9 · máximo 5 resultados */
  it('corta en 5 coincidencias', () => {
    const muchos = Array.from({ length: 9 }, (_, i) => {
      const r = radicado({ radicadoId: `1-WEB-2026-0000010${i}` });
      r.solicitante.numeroDocumento = `900000${i}`;
      r.solicitante.nombreCompleto = `Carlos Prueba ${i}`;
      return r;
    });
    expect(buscarSolicitantes(construirDirectorio(muchos), 'carlos')).toHaveLength(5);
  });

  /* 10 · el documento sale enmascarado para el dropdown */
  it('enmascara el documento con los últimos 4 dígitos', () => {
    expect(enmascararDocumento('CC', '1101321226')).toBe('CC ····1226');
    expect(directorio[0].documentoEnmascarado).toBe('CC ····1226');
  });
});
