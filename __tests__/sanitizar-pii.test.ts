import { describe, expect, it } from 'vitest';
import { sanitizarPiiTextoSimi } from '@/lib/seguridad/sanitizar-pii';

describe('sanitizarPiiTextoSimi (H-11.2)', () => {
  it('reemplaza correos comunes por [CORREO]', () => {
    expect(sanitizarPiiTextoSimi('contactar a juan@example.com'))
      .toBe('contactar a [CORREO]');
    expect(sanitizarPiiTextoSimi('mi.correo+tag@sub.dominio.co'))
      .toBe('[CORREO]');
  });

  it('no toca strings con @ que no son correos', () => {
    expect(sanitizarPiiTextoSimi('mención @usuario sin dominio'))
      .toBe('mención @usuario sin dominio');
  });

  it('reemplaza móvil colombiano de 10 dígitos por [TELEFONO]', () => {
    expect(sanitizarPiiTextoSimi('llamen al 3001234567'))
      .toBe('llamen al [TELEFONO]');
    expect(sanitizarPiiTextoSimi('teléfono 300 123 4567'))
      .toBe('teléfono [TELEFONO]');
    expect(sanitizarPiiTextoSimi('cel +57 3001234567'))
      .toBe('cel [TELEFONO]');
  });

  it('NO toca códigos de radicado tipo 1-WEB-2026-00000001', () => {
    expect(sanitizarPiiTextoSimi('radicado 1-WEB-2026-00000001 pendiente'))
      .toBe('radicado 1-WEB-2026-00000001 pendiente');
  });

  it('NO toca años ni montos sin contexto', () => {
    expect(sanitizarPiiTextoSimi('en 2026 pagué 1500000 pesos'))
      .toBe('en 2026 pagué 1500000 pesos');
  });

  it('reemplaza documento sólo con prefijo, preservando el prefijo', () => {
    expect(sanitizarPiiTextoSimi('CC 12345678 expedida en Bogotá'))
      .toBe('CC [DOCUMENTO] expedida en Bogotá');
    expect(sanitizarPiiTextoSimi('cédula 1.000.000'))
      .toBe('cédula [DOCUMENTO]');
    expect(sanitizarPiiTextoSimi('NIT 900.123.456'))
      .toBe('NIT [DOCUMENTO]');
  });

  it('NO toca números bare sin prefijo de documento', () => {
    expect(sanitizarPiiTextoSimi('factura 12345678'))
      .toBe('factura 12345678');
  });

  it('combinaciones múltiples en una sola línea', () => {
    const entrada = 'Contactar a juan@example.com o al 3001234567, mi CC 12345678.';
    const salida  = 'Contactar a [CORREO] o al [TELEFONO], mi CC [DOCUMENTO].';
    expect(sanitizarPiiTextoSimi(entrada)).toBe(salida);
  });

  it('idempotente: aplicar dos veces da el mismo resultado', () => {
    const entrada = 'mi correo es x@y.com y mi móvil +57 3009876543';
    const primera = sanitizarPiiTextoSimi(entrada);
    expect(sanitizarPiiTextoSimi(primera)).toBe(primera);
  });

  it('acepta null/undefined/vacío sin error', () => {
    expect(sanitizarPiiTextoSimi(null)).toBe('');
    expect(sanitizarPiiTextoSimi(undefined)).toBe('');
    expect(sanitizarPiiTextoSimi('')).toBe('');
  });
});
