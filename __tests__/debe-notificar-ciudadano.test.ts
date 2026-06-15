/**
 * Tests de la regla central de privacidad/entrega de correos al ciudadano.
 *
 * Esta función es la garantía de que un radicado anónimo NUNCA reciba
 * correo aunque por algún error o versión previa del formulario haya
 * quedado un email persistido en el documento.
 */
import { describe, it, expect } from 'vitest';
import { debeNotificarCiudadano } from '@/lib/email/debe-notificar-ciudadano';

describe('debeNotificarCiudadano', () => {
  it('permite envío a un ciudadano identificado con email válido', () => {
    expect(debeNotificarCiudadano({
      esAnonimo: false,
      tipoPresentacion: 'IDENTIFICADA',
      solicitante: { email: 'juan@example.com' },
    })).toBe(true);
  });

  it('bloquea si esAnonimo === true aunque haya email', () => {
    expect(debeNotificarCiudadano({
      esAnonimo: true,
      tipoPresentacion: 'IDENTIFICADA',
      solicitante: { email: 'juan@example.com' },
    })).toBe(false);
  });

  it('bloquea si tipoPresentacion === ANONIMA aunque haya email', () => {
    expect(debeNotificarCiudadano({
      esAnonimo: false,
      tipoPresentacion: 'ANONIMA',
      solicitante: { email: 'juan@example.com' },
    })).toBe(false);
  });

  it('bloquea cuando no hay email', () => {
    expect(debeNotificarCiudadano({
      esAnonimo: false,
      solicitante: { email: null },
    })).toBe(false);
    expect(debeNotificarCiudadano({
      esAnonimo: false,
      solicitante: { email: '' },
    })).toBe(false);
    expect(debeNotificarCiudadano({
      esAnonimo: false,
      solicitante: {},
    })).toBe(false);
  });

  it('bloquea si el email tiene formato inválido', () => {
    expect(debeNotificarCiudadano({
      solicitante: { email: 'no-es-correo' },
    })).toBe(false);
    expect(debeNotificarCiudadano({
      solicitante: { email: 'sin-arroba.com' },
    })).toBe(false);
    expect(debeNotificarCiudadano({
      solicitante: { email: 'doble@@arroba.com' },
    })).toBe(false);
  });

  it('bloquea direcciones placeholder reservadas', () => {
    const placeholders = [
      'anonimo@simacota.gov.co',
      'noreply@simacota.gov.co',
      'no-reply@simacota.gov.co',
      'sin-correo@simacota.gov.co',
      'reservado@simacota.gov.co',
    ];
    for (const email of placeholders) {
      expect(debeNotificarCiudadano({ solicitante: { email } })).toBe(false);
    }
  });

  it('normaliza espacios y mayúsculas al evaluar placeholders', () => {
    expect(debeNotificarCiudadano({
      solicitante: { email: '  Anonimo@Simacota.gov.co  ' },
    })).toBe(false);
  });

  it('permite envío cuando el solicitante eligió canal PRESENCIAL pero dejó email', () => {
    // El canal de respuesta NO debe bloquear notificaciones de estado.
    expect(debeNotificarCiudadano({
      esAnonimo: false,
      tipoPresentacion: 'IDENTIFICADA',
      solicitante: { email: 'ciudadano@example.com' },
    })).toBe(true);
  });
});
