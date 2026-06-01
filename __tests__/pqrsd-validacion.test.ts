import { describe, expect, it } from 'vitest';
import {
  TIPOS_PQRSD_CIUDADANO,
  TIPOS_SOLICITUD,
  calcularFechaVencimiento,
  type TipoSolicitudId,
} from '@/lib/tiempos-radicado';

const TIPOS_REQUERIDOS: TipoSolicitudId[] = [
  'PETICION_INFORMACION',
  'PETICION_AUTORIDADES',
  'QUEJA',
  'RECLAMO',
  'SUGERENCIA',
  'FELICITACION',
  'DENUNCIA',
  'HABEAS_DATA',
];

describe('Validación PQRSD — catálogo público y términos legales', () => {
  it('expone todos los tipos PQRSD requeridos para el ciudadano', () => {
    for (const tipo of TIPOS_REQUERIDOS) {
      expect(TIPOS_PQRSD_CIUDADANO).toContain(tipo);
    }
  });

  it('mantiene los términos legales esperados por tipo', () => {
    expect(TIPOS_SOLICITUD.PETICION.diasRespuesta).toBe(15);
    expect(TIPOS_SOLICITUD.PETICION.unidad).toBe('HABILES');

    expect(TIPOS_SOLICITUD.PETICION_INFORMACION.diasRespuesta).toBe(10);
    expect(TIPOS_SOLICITUD.PETICION_INFORMACION.unidad).toBe('HABILES');

    expect(TIPOS_SOLICITUD.PETICION_AUTORIDADES.diasRespuesta).toBe(30);
    expect(TIPOS_SOLICITUD.PETICION_AUTORIDADES.unidad).toBe('HABILES');

    expect(TIPOS_SOLICITUD.QUEJA.diasRespuesta).toBe(15);
    expect(TIPOS_SOLICITUD.RECLAMO.diasRespuesta).toBe(15);
    expect(TIPOS_SOLICITUD.DENUNCIA.diasRespuesta).toBe(15);
    expect(TIPOS_SOLICITUD.HABEAS_DATA.diasRespuesta).toBe(10);
  });

  it('calcula vencimiento en días hábiles descontando fin de semana', () => {
    const resultado = calcularFechaVencimiento('2026-01-02T10:00:00.000Z', 'HABEAS_DATA');
    const fecha = new Date(resultado.fechaVencimiento);

    expect(resultado.diasRespuesta).toBe(10);
    expect(resultado.unidad).toBe('HABILES');
    expect(fecha.getDay()).not.toBe(0);
    expect(fecha.getDay()).not.toBe(6);
  });
});
