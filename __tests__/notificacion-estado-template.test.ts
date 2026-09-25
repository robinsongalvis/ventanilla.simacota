/**
 * Tests del template genérico de notificación de estado al ciudadano.
 *
 * Verifica que cada evento renderice los datos clave y que el subject
 * sea reconocible. No validamos el HTML completo (frágil) sino la
 * presencia de los datos críticos para el ciudadano.
 */
import { describe, it, expect } from 'vitest';
import {
  buildNotificacionEstadoHtml,
  buildNotificacionEstadoSubject,
} from '@/lib/email/templates/notificacion-estado';

const RADICADO_ID = '1-WEB-2026-00000042';
const NOMBRE = 'María Pérez';
const FECHA_ISO = '2026-06-14T10:00:00.000Z';

describe('buildNotificacionEstadoHtml — evento ASIGNADO', () => {
  const html = buildNotificacionEstadoHtml({
    radicadoId: RADICADO_ID,
    ciudadanoNombre: NOMBRE,
    evento: 'ASIGNADO',
    dependenciaNombre: 'Secretaría de Gobierno',
    dependenciaEmail: 'gobierno@simacota-santander.gov.co',
    fechaEvento: FECHA_ISO,
  });

  it('incluye el número de radicado', () => {
    expect(html).toContain(RADICADO_ID);
  });

  it('incluye el nombre del ciudadano', () => {
    expect(html).toContain('María Pérez');
  });

  it('menciona la dependencia destino', () => {
    expect(html).toContain('Secretaría de Gobierno');
  });

  it('incluye el email institucional de la dependencia', () => {
    expect(html).toContain('gobierno@simacota-santander.gov.co');
  });

  it('renderiza el badge ASIGNADO', () => {
    expect(html).toContain('ASIGNADO');
  });

  it('incluye el enlace de consulta con el radicado codificado', () => {
    expect(html).toContain(`radicadoId=${encodeURIComponent(RADICADO_ID)}`);
  });
});

describe('buildNotificacionEstadoHtml — evento PRORROGA', () => {
  const NUEVA_FECHA = '2026-07-20T17:00:00.000Z';
  const html = buildNotificacionEstadoHtml({
    radicadoId: RADICADO_ID,
    ciudadanoNombre: NOMBRE,
    evento: 'PRORROGA',
    nuevaFechaLimite: NUEVA_FECHA,
    diasProrroga: 10,
    motivo: 'Se requiere consulta especializada con jurídico.',
    fechaEvento: FECHA_ISO,
  });

  it('incluye la nueva fecha formateada en español', () => {
    // El template usa toLocaleDateString('es-CO') — verificamos componentes.
    expect(html).toContain('2026');
    expect(html.toLowerCase()).toMatch(/julio/);
  });

  it('menciona los días aplicados', () => {
    expect(html).toContain('10');
  });

  it('incluye el motivo capturado por el funcionario', () => {
    expect(html).toContain('consulta especializada');
  });

  it('renderiza el badge PRÓRROGA', () => {
    expect(html).toContain('PRÓRROGA');
  });

  it('escapa entidades HTML peligrosas en el motivo', () => {
    const htmlInyectado = buildNotificacionEstadoHtml({
      radicadoId: RADICADO_ID,
      ciudadanoNombre: NOMBRE,
      evento: 'PRORROGA',
      nuevaFechaLimite: NUEVA_FECHA,
      diasProrroga: 5,
      motivo: '<script>alert("x")</script>',
      fechaEvento: FECHA_ISO,
    });
    expect(htmlInyectado).not.toContain('<script>alert');
    expect(htmlInyectado).toContain('&lt;script&gt;');
  });
});

describe('buildNotificacionEstadoSubject', () => {
  it('genera subject reconocible para ASIGNADO', () => {
    const subject = buildNotificacionEstadoSubject(RADICADO_ID, 'ASIGNADO');
    expect(subject).toContain(RADICADO_ID);
    expect(subject.toLowerCase()).toContain('asignado');
  });

  it('genera subject reconocible para PRORROGA', () => {
    const subject = buildNotificacionEstadoSubject(RADICADO_ID, 'PRORROGA');
    expect(subject).toContain(RADICADO_ID);
    expect(subject.toLowerCase()).toContain('plazo');
  });
});
