import { describe, expect, it } from 'vitest';
import {
  sanitizarTextoObservabilidad,
  sanitizarEventoSentry,
} from '@/lib/seguridad/sanitizar-observabilidad';

describe('sanitizarTextoObservabilidad — patrones base (H-11 reutilizado)', () => {
  it('reemplaza correos por [CORREO]', () => {
    expect(sanitizarTextoObservabilidad('Auth failed for x@y.com'))
      .toBe('Auth failed for [CORREO]');
  });

  it('reemplaza móviles colombianos por [TELEFONO]', () => {
    expect(sanitizarTextoObservabilidad('Contactar al 3001234567'))
      .toBe('Contactar al [TELEFONO]');
  });

  it('reemplaza documento con prefijo por <prefijo> [DOCUMENTO]', () => {
    expect(sanitizarTextoObservabilidad('reportó CC 12345678'))
      .toBe('reportó CC [DOCUMENTO]');
  });
});

describe('sanitizarTextoObservabilidad — patrones específicos de observabilidad (H-N03)', () => {
  it('reemplaza rutas Storage privadas de radicados', () => {
    expect(sanitizarTextoObservabilidad('File not found: radicados/RAD-2026-001/anexo.pdf en bucket'))
      .toBe('File not found: [RUTA_STORAGE] en bucket');
  });

  it('reemplaza rutas Storage de respuestas', () => {
    expect(sanitizarTextoObservabilidad('save error respuestas/RAD-2026-001/1234_oficio.pdf'))
      .toBe('save error [RUTA_STORAGE]');
  });

  it('reemplaza URL firmada con parámetro key', () => {
    expect(sanitizarTextoObservabilidad(
      'Gemini call failed https://generativelanguage.googleapis.com/v1beta/models:generateContent?key=AIzaSyABC123',
    )).toBe('Gemini call failed [URL_FIRMADA]');
  });

  it('reemplaza URL firmada con X-Goog-Signature', () => {
    const url = 'https://storage.googleapis.com/bucket/obj?X-Goog-Signature=abc123def';
    expect(sanitizarTextoObservabilidad(`redirect a ${url}`))
      .toBe('redirect a [URL_FIRMADA]');
  });

  it('reemplaza Bearer <token> por Bearer [TOKEN]', () => {
    expect(sanitizarTextoObservabilidad('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM'))
      .toBe('Authorization: Bearer [TOKEN]');
  });

  it('NO toca radicadoId (identificador de negocio)', () => {
    expect(sanitizarTextoObservabilidad('radicado 1-WEB-2026-00000001 no encontrado'))
      .toBe('radicado 1-WEB-2026-00000001 no encontrado');
  });

  it('NO toca stack traces sintéticos', () => {
    const stack = 'at handler (/app/api/radicacion/route.ts:210:15)';
    expect(sanitizarTextoObservabilidad(stack)).toBe(stack);
  });

  it('combina múltiples patrones en una línea', () => {
    const entrada = 'SMTP fail user@dom.co on radicados/RAD-1/file.pdf token=Bearer abc';
    const salida  = sanitizarTextoObservabilidad(entrada);
    expect(salida).toContain('[CORREO]');
    expect(salida).toContain('[RUTA_STORAGE]');
    expect(salida).toContain('Bearer [TOKEN]');
    expect(salida).not.toContain('user@dom.co');
    expect(salida).not.toContain('RAD-1');
  });

  it('acepta null/undefined/vacío sin error', () => {
    expect(sanitizarTextoObservabilidad(null)).toBe('');
    expect(sanitizarTextoObservabilidad(undefined)).toBe('');
    expect(sanitizarTextoObservabilidad('')).toBe('');
  });
});

describe('sanitizarEventoSentry — scrubbing profundo', () => {
  it('sanea event.message', () => {
    const ev = sanitizarEventoSentry({ message: 'error para x@y.com' });
    expect(ev.message).toBe('error para [CORREO]');
  });

  it('sanea exception.values[*].value pero NO type ni stacktrace', () => {
    const ev = sanitizarEventoSentry({
      exception: {
        values: [{
          type: 'RadicadoActionError',
          value: 'File not found: respuestas/RAD-1/x.pdf',
          stacktrace: { frames: [{ filename: '/app/api/x.ts', lineno: 42 }] },
        }],
      },
    });
    const values = (ev.exception as { values: Array<Record<string, unknown>> }).values;
    expect(values[0].type).toBe('RadicadoActionError');
    expect(values[0].value).toBe('File not found: [RUTA_STORAGE]');
    expect(values[0].stacktrace).toEqual({ frames: [{ filename: '/app/api/x.ts', lineno: 42 }] });
  });

  it('sanea breadcrumbs message y data.url', () => {
    const ev = sanitizarEventoSentry({
      breadcrumbs: [
        { message: 'click en formulario x@y.com' },
        { data: { url: 'https://api?key=SECRET123' } },
      ],
    });
    const bcs = ev.breadcrumbs as Array<{ message?: string; data?: { url?: string } }>;
    expect(bcs[0].message).toBe('click en formulario [CORREO]');
    expect(bcs[1].data?.url).toBe('[URL_FIRMADA]');
  });

  it('sanea request.url', () => {
    const ev = sanitizarEventoSentry({
      request: { url: 'https://app/api?token=abc123' },
    });
    expect((ev.request as { url: string }).url).toBe('[URL_FIRMADA]');
  });

  it('sanea extra pero NO toca tags controlados', () => {
    const ev = sanitizarEventoSentry({
      extra: { detalle: 'Correo x@y.com falló' },
      tags: { modulo: 'resolver-radicado/trazabilidad', radicadoId: '1-WEB-2026-00000001' },
    });
    expect((ev.extra as { detalle: string }).detalle).toBe('Correo [CORREO] falló');
    // Tags NO se tocan
    const tags = ev.tags as Record<string, string>;
    expect(tags.modulo).toBe('resolver-radicado/trazabilidad');
    expect(tags.radicadoId).toBe('1-WEB-2026-00000001');
  });

  it('acepta evento vacío sin lanzar', () => {
    expect(() => sanitizarEventoSentry({})).not.toThrow();
  });
});
