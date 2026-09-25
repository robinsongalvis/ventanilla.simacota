import { describe, expect, it } from 'vitest';
import {
  CATALOGO_TIPOS_SOLICITUD,
  TIPO_SOLICITUD_FALLBACK_ID,
  esTipoSolicitudInterno,
  getLabelTipoSolicitud,
  getTerminoTipoSolicitud,
  getTipoSolicitudById,
  getTiposSolicitudActivos,
  getTiposSolicitudCiudadano,
  getTiposSolicitudInternos,
  requiereValidacionJuridica,
} from '@/lib/catalogos/tipos-solicitud';
import {
  TIPOS_PQRSD_CIUDADANO,
  TIPOS_SOLICITUD,
  calcularFechaVencimiento,
  resolverTipoSolicitud,
} from '@/lib/tiempos-radicado';

describe('Catálogo institucional de tipos de solicitud', () => {
  /* 1 */
  it('todos los tipos tienen ID único', () => {
    const ids = CATALOGO_TIPOS_SOLICITUD.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* 2 */
  it('todos los tipos tienen término mayor a 0', () => {
    for (const tipo of CATALOGO_TIPOS_SOLICITUD) {
      expect(tipo.terminoDias).toBeGreaterThan(0);
    }
  });

  /* 3 */
  it('los tipos ciudadanos solo exponen visibleCiudadano = true', () => {
    for (const tipo of getTiposSolicitudCiudadano()) {
      expect(tipo.visibleCiudadano).toBe(true);
      expect(tipo.activo).toBe(true);
    }
  });

  /* 4 */
  it('los tipos internos no aparecen en /radicacion (formulario ciudadano)', () => {
    const internos = ['DECLARACION_RETENCION_ICA', 'INFORMATIVO', 'LICENCIA_CONSTRUCCION', 'URGENTE', 'QUERELLA'];
    for (const id of internos) {
      expect(TIPOS_PQRSD_CIUDADANO).not.toContain(id);
      expect(esTipoSolicitudInterno(id)).toBe(true);
    }
  });

  /* 5 */
  it('Petición de documentos tiene 10 días hábiles', () => {
    const tipo = getTipoSolicitudById('PETICION_DOCUMENTOS')!;
    expect(tipo.terminoDias).toBe(10);
    expect(tipo.tipoDias).toBe('HABILES');
  });

  /* 6 */
  it('Informativo tiene 10 días calendario', () => {
    const tipo = getTipoSolicitudById('INFORMATIVO')!;
    expect(tipo.terminoDias).toBe(10);
    expect(tipo.tipoDias).toBe('CALENDARIO');
  });

  /* 7 */
  it('Invitación tiene 15 días calendario', () => {
    const tipo = getTipoSolicitudById('INVITACION')!;
    expect(tipo.terminoDias).toBe(15);
    expect(tipo.tipoDias).toBe('CALENDARIO');
  });

  /* 8 */
  it('Urgente tiene 2 días hábiles', () => {
    const tipo = getTipoSolicitudById('URGENTE')!;
    expect(tipo.terminoDias).toBe(2);
    expect(tipo.tipoDias).toBe('HABILES');
  });

  /* 9 */
  it('Licencia de construcción tiene 45 días hábiles', () => {
    const tipo = getTipoSolicitudById('LICENCIA_CONSTRUCCION')!;
    expect(tipo.terminoDias).toBe(45);
    expect(tipo.tipoDias).toBe('HABILES');
  });

  /* 10 */
  it('Querella tiene 5 días hábiles', () => {
    const tipo = getTipoSolicitudById('QUERELLA')!;
    expect(tipo.terminoDias).toBe(5);
    expect(tipo.tipoDias).toBe('HABILES');
  });

  /* 11 */
  it('tipos heredados quedan marcados con heredadoSistemaActual', () => {
    const heredados = [
      'DECLARACION_RETENCION_ICA',
      'INFORMATIVO',
      'INVITACION',
      'LICENCIA_CONSTRUCCION',
      'PERMISO_ESTABLECIMIENTO_PUBLICO',
      'PETICION_INFORMACION_CORTA',
      'PETICION_ENTES_CONTROL',
      'PETICION_ENTRE_AUTORIDADES',
      'QUERELLA',
      'RESPUESTA_A_SOLICITUD',
      'SOLICITUD_SUBDIVISION',
      'SOLICITUD_SAC',
      'URGENTE',
    ];
    for (const id of heredados) {
      const tipo = getTipoSolicitudById(id);
      expect(tipo?.heredadoSistemaActual).toBe(true);
    }
  });

  /* 12 */
  it('tipos que requieren validación jurídica quedan marcados', () => {
    const requierenValidacion = [
      'DECLARACION_RETENCION_ICA',
      'LICENCIA_CONSTRUCCION',
      'PETICION_INFORMACION_CORTA',
      'PETICION_ENTES_CONTROL',
      'QUERELLA',
      'SOLICITUD_SUBDIVISION',
      'URGENTE',
    ];
    for (const id of requierenValidacion) {
      expect(requiereValidacionJuridica(id)).toBe(true);
    }
  });

  /* 13 */
  it('fallback a PETICION_GENERAL cuando el tipo no existe', () => {
    expect(TIPO_SOLICITUD_FALLBACK_ID).toBe('PETICION_GENERAL');
    const resuelto = resolverTipoSolicitud('TIPO_INEXISTENTE');
    expect(resuelto.id).toBe('PETICION_GENERAL');
    expect(resuelto.diasRespuesta).toBe(15);
    expect(resuelto.unidad).toBe('HABILES');

    const termino = getTerminoTipoSolicitud('NO_EXISTE_TAMPOCO');
    expect(termino.dias).toBe(15);
    expect(termino.unidad).toBe('HABILES');
  });

  it('helpers complementarios funcionan correctamente', () => {
    expect(getTiposSolicitudActivos().length).toBe(CATALOGO_TIPOS_SOLICITUD.length);
    expect(getTiposSolicitudInternos().every((t) => t.visibleInterno)).toBe(true);
    expect(getLabelTipoSolicitud('PETICION_GENERAL')).toContain('15');
    expect(getLabelTipoSolicitud('TIPO_INEXISTENTE')).toBe('Tipo no registrado');
  });

  it('TIPOS_SOLICITUD legacy se mantiene como mapa cargado desde el catálogo', () => {
    expect(Object.keys(TIPOS_SOLICITUD).length).toBe(CATALOGO_TIPOS_SOLICITUD.length);
    expect(TIPOS_SOLICITUD.PETICION_GENERAL.diasRespuesta).toBe(15);
  });

  it('calcularFechaVencimiento honra unidad calendario en INFORMATIVO (10 días corridos)', () => {
    const inicio = new Date('2026-06-01T12:00:00');
    const calculo = calcularFechaVencimiento(inicio, 'INFORMATIVO');
    expect(calculo.unidad).toBe('CALENDARIO');
    expect(calculo.diasRespuesta).toBe(10);
    const vencimiento = new Date(calculo.fechaVencimiento);
    const diff = Math.round((vencimiento.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(10);
  });

  it('alias legacy PETICION sigue resolviendo a PETICION_GENERAL', () => {
    expect(resolverTipoSolicitud('PETICION').id).toBe('PETICION_GENERAL');
    expect(resolverTipoSolicitud('PETICION_AUTORIDADES').id).toBe('CONSULTA');
    expect(resolverTipoSolicitud('ENTES_CONTROL_URGENTE').id).toBe('PETICION_ENTES_CONTROL');
  });
});
