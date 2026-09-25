/**
 * Tests del sanitizador del payload público de respuesta oficial.
 *
 * Cubren los 4 casos exigidos por el sprint:
 *   1. Radicado RESUELTO con nota → expone respuesta sanitizada.
 *   2. Radicado NO resuelto → NO expone respuesta.
 *   3. No expone datos internos (actorUid, actorNombre, archivoPath, metadata).
 *   4. Solicitudes anónimas/reservadas → la identidad permanece protegida.
 */
import { describe, it, expect } from 'vitest';
import { buildRespuestaPublicaCiudadano } from '@/lib/server/respuesta-publica';
import type { VentanillaRadicado, RespuestaOficial } from '@/src/types/ventanilla';

const DEPENDENCIA = 'Secretaría de Gobierno';

const RESPUESTA_VALIDA: RespuestaOficial = {
  archivoPath:   'respuestas/SIM-001/oficio.pdf',
  archivoNombre: 'oficio-firmado.pdf',
  nota:          'Respuesta oficial al ciudadano detallando la resolución del caso.',
  fecha:         '2026-06-14T15:30:00.000Z',
  actorUid:      'usr_FUNC_internal_uid_secret',
  actorNombre:   'Juan Funcionario Privado',
};

function makeRadicado(overrides: Partial<VentanillaRadicado> = {}): VentanillaRadicado {
  const base: VentanillaRadicado = {
    radicadoId: '1-WEB-2026-00000001',
    estadoActual: 'RESUELTO',
    ultimaActualizacion: '2026-06-14T15:30:00.000Z',
    prioridad: 'AMARILLO',
    cumplioTermino: true,
    esAnonimo: false,
    tipoPresentacion: 'IDENTIFICADA',
    identidadReservada: false,
    canalRespuesta: 'CORREO',
    solicitante: {
      tipoPersona: 'NATURAL',
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      nombreCompleto: 'María Pérez',
      email: 'maria@example.com',
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
    },
    detalle: {
      asunto: 'Prueba UAT',
      descripcion: 'Descripción de la solicitud',
      numeroFolios: 0,
    },
    archivos: [],
    respuestaOficial: RESPUESTA_VALIDA,
  };
  return { ...base, ...overrides };
}

describe('buildRespuestaPublicaCiudadano — caso 1: expone respuesta cuando RESUELTO + nota válida', () => {
  it('retorna la respuesta sanitizada', () => {
    const radicado = makeRadicado();
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(out).not.toBeNull();
    expect(out?.nota).toBe(RESPUESTA_VALIDA.nota);
    expect(out?.dependenciaNombre).toBe(DEPENDENCIA);
    expect(out?.tieneArchivo).toBe(true);
  });

  it('reporta tieneArchivo=false cuando la respuesta no incluye PDF', () => {
    const radicado = makeRadicado({
      respuestaOficial: { ...RESPUESTA_VALIDA, archivoPath: null, archivoNombre: null },
    });
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(out?.tieneArchivo).toBe(false);
    expect(out?.nota).toBe(RESPUESTA_VALIDA.nota);
  });
});

describe('buildRespuestaPublicaCiudadano — caso 2: NO expone si no está resuelto', () => {
  it('retorna null cuando estadoActual no es RESUELTO', () => {
    const estadosNoResueltos = ['PENDIENTE', 'EN_REVISION', 'ASIGNADO', 'EN_PROCESO', 'PRORROGA', 'DEVUELTO'] as const;
    for (const estado of estadosNoResueltos) {
      const radicado = makeRadicado({ estadoActual: estado });
      expect(buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA)).toBeNull();
    }
  });

  it('retorna null cuando RESUELTO pero sin respuestaOficial persistida', () => {
    const radicado = makeRadicado({ respuestaOficial: null });
    expect(buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA)).toBeNull();
  });

  it('retorna null cuando RESUELTO pero nota vacía o solo espacios', () => {
    const r1 = makeRadicado({ respuestaOficial: { ...RESPUESTA_VALIDA, nota: '' } });
    const r2 = makeRadicado({ respuestaOficial: { ...RESPUESTA_VALIDA, nota: '   ' } });
    expect(buildRespuestaPublicaCiudadano(r1, DEPENDENCIA)).toBeNull();
    expect(buildRespuestaPublicaCiudadano(r2, DEPENDENCIA)).toBeNull();
  });
});

describe('buildRespuestaPublicaCiudadano — caso 3: NO expone datos internos', () => {
  const radicado = makeRadicado();
  const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);

  it('el payload tiene exactamente 4 claves y ninguna interna', () => {
    expect(out).not.toBeNull();
    if (!out) return;
    const claves = Object.keys(out).sort();
    expect(claves).toEqual(['dependenciaNombre', 'fecha', 'nota', 'tieneArchivo']);
  });

  it('no contiene actorUid', () => {
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(JSON.stringify(out)).not.toContain('usr_FUNC_internal_uid_secret');
    expect((out as unknown as Record<string, unknown>).actorUid).toBeUndefined();
  });

  it('no contiene actorNombre del funcionario', () => {
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(JSON.stringify(out)).not.toContain('Juan Funcionario Privado');
    expect((out as unknown as Record<string, unknown>).actorNombre).toBeUndefined();
  });

  it('no contiene archivoPath ni archivoNombre crudos', () => {
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(JSON.stringify(out)).not.toContain('respuestas/SIM-001/oficio.pdf');
    expect(JSON.stringify(out)).not.toContain('oficio-firmado.pdf');
    expect((out as unknown as Record<string, unknown>).archivoPath).toBeUndefined();
    expect((out as unknown as Record<string, unknown>).archivoNombre).toBeUndefined();
  });
});

describe('buildRespuestaPublicaCiudadano — caso 4: anonimato y reserva', () => {
  it('expone la respuesta institucional aunque el radicado sea anónimo', () => {
    // La respuesta es un acto administrativo público; lo que se protege
    // es la IDENTIDAD del solicitante, no la respuesta de la Alcaldía.
    const radicado = makeRadicado({
      esAnonimo: true,
      tipoPresentacion: 'ANONIMA',
      solicitante: {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'OTRO',
        numeroDocumento: '',
        nombreCompleto: 'Anónimo / Reservado',
        email: null,
        ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
      },
    });
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(out).not.toBeNull();
    expect(out?.nota).toBe(RESPUESTA_VALIDA.nota);
  });

  it('no incluye el nombre del solicitante ni siquiera cuando es identificado', () => {
    const radicado = makeRadicado();
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(JSON.stringify(out)).not.toContain('María Pérez');
    expect(JSON.stringify(out)).not.toContain('maria@example.com');
    expect(JSON.stringify(out)).not.toContain('1234567890');
  });

  it('para radicado RESERVADO, no filtra identidad por la respuesta', () => {
    const radicado = makeRadicado({
      tipoPresentacion: 'RESERVADA',
      identidadReservada: true,
    });
    const out = buildRespuestaPublicaCiudadano(radicado, DEPENDENCIA);
    expect(out).not.toBeNull();
    expect(JSON.stringify(out)).not.toContain('María Pérez');
    expect(JSON.stringify(out)).not.toContain('1234567890');
  });
});
