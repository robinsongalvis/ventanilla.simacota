import { describe, expect, it } from 'vitest';
import {
  buildAcuseReciboExpedienteHtml,
  buildAcuseReciboExpedienteSubject,
} from '@/lib/email/templates/acuse-recibo-expediente-licencia';

/**
 * Este archivo existe para que un correo no vuelva a certificar un hecho que
 * no ha ocurrido.
 *
 * Hasta el 26-ago-2026, abrir un expediente en el mostrador disparaba una
 * «Constancia de radicación en legal y debida forma» fechada ese mismo día.
 * Desde el ADR-0033 el expediente nace en PRESENTADA: ese hito es POSTERIOR.
 * La constancia afirmaba por escrito algo falso, y solo el candado R10 —que
 * corta los números DEMO— impedía que saliera. Es decir: habría salido el
 * primer día de operación real.
 *
 * Las pruebas de PROHIBICIÓN de abajo valen más que las de contenido.
 */

const BASE = {
  numeroExpediente: 'DEMO-26-abc12345',
  solicitanteNombre: 'María Fernanda Ríos',
  solicitanteDocumento: '1098765432',
  tipoDocumento: 'CC',
  descripcionTramite: 'licencia de construcción — obra nueva',
  fechaRecepcion: '2026-08-26T12:00:00.000Z',
  requisitosAplicables: 19,
  radicadoVentanillaId: '1-110-202608-00000042',
};

const INCOMPLETO = {
  ...BASE,
  documentosEntregados: ['Certificado de Tradición y Libertad', 'Paz y salvo municipal'],
  documentosFaltantes: [
    { nombre: 'Proyecto arquitectónico firmado', motivo: 'SIN_APORTE' },
    { nombre: 'Valla de citación a vecinos colindantes', motivo: 'SIN_APORTE' },
  ],
};

const COMPLETO = { ...BASE, documentosEntregados: ['Todo lo exigido'], documentosFaltantes: [] };

describe('acuse de recibo — lo que tiene PROHIBIDO afirmar', () => {
  it('el asunto NO dice "constancia" ni "debida forma"', () => {
    const asunto = buildAcuseReciboExpedienteSubject('DEMO-26-abc12345');
    expect(asunto.toLowerCase()).not.toContain('constancia');
    expect(asunto.toLowerCase()).not.toContain('debida forma');
    expect(asunto).toContain('Acuse de recibo');
  });

  it.each([
    ['incompleto', INCOMPLETO],
    ['completo', COMPLETO],
  ])('en el caso %s, NO afirma que el trámite esté radicado en debida forma', (_caso, params) => {
    const html = buildAcuseReciboExpedienteHtml(params);
    /* La frase solo puede aparecer NEGADA o como explicación de lo que
       todavía falta — nunca como afirmación sobre este trámite. Se comprueba
       exigiendo que toda aparición venga acompañada de la negación. */
    expect(html).toContain('no es una constancia de radicación en legal y debida forma');
    expect(html).not.toMatch(/su solicitud (quedó|está|fue) radicada/i);
    expect(html).not.toMatch(/fecha de radicación/i);
  });

  it.each([
    ['incompleto', INCOMPLETO],
    ['completo', COMPLETO],
  ])('en el caso %s, NO menciona el silencio administrativo positivo', (_caso, params) => {
    expect(buildAcuseReciboExpedienteHtml(params).toLowerCase()).not.toContain('silencio administrativo');
  });

  it('NO imprime ninguna fecha de vencimiento ni cuenta de días hábiles del término', () => {
    const html = buildAcuseReciboExpedienteHtml(INCOMPLETO);
    expect(html).not.toMatch(/vencimiento/i);
    expect(html).not.toMatch(/45 días/i);
  });

  /* La consulta pública resuelve radicados de ventanilla, no expedientes de
     licencias. Prometer el enlace sería el mismo defecto con otro disfraz. */
  it('NO enlaza la consulta pública mientras no resuelva licencias', () => {
    expect(buildAcuseReciboExpedienteHtml(INCOMPLETO)).not.toContain('/consulta');
  });
});

describe('acuse de recibo — lo que SÍ tiene que decir', () => {
  it('dice expresamente que el plazo legal aún no ha empezado a correr', () => {
    const html = buildAcuseReciboExpedienteHtml(INCOMPLETO);
    expect(html).toContain('El plazo legal aún no ha empezado a correr');
    // Y qué lo hace arrancar: no basta con la negación.
    expect(html).toContain('radicada en legal y debida forma');
    expect(html).toContain('2.2.6.1.2.1.1');
  });

  it('enumera lo entregado y lo pendiente, con nombres legibles', () => {
    const html = buildAcuseReciboExpedienteHtml(INCOMPLETO);
    expect(html).toContain('Certificado de Tradición y Libertad');
    expect(html).toContain('Proyecto arquitectónico firmado');
    expect(html).toContain('Documentos pendientes (2)');
    expect(html).toContain('Documentos recibidos (2 de 19)');
  });

  it('con la documentación completa, no inventa un bloque de pendientes', () => {
    const html = buildAcuseReciboExpedienteHtml(COMPLETO);
    expect(html).not.toContain('Documentos pendientes');
    expect(html).toContain('entregó todos los documentos');
    // Sigue sin afirmar la radicación: la verificación la hace una persona.
    expect(html).toContain('El plazo legal aún no ha empezado a correr');
  });

  it('escapa el HTML de los datos del solicitante', () => {
    const html = buildAcuseReciboExpedienteHtml({
      ...INCOMPLETO,
      solicitanteNombre: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
