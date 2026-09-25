/**
 * Sanitización de PII para observabilidad (Sentry, logs) — H-N03.
 *
 * Extiende `sanitizarPiiTextoSimi` (H-11) con 3 patrones específicos que
 * aparecen frecuentemente en mensajes de error, breadcrumbs y URLs:
 *
 *  - Rutas de Storage privadas (`radicados/...`, `respuestas/...`)
 *  - URLs firmadas con `key`, `token`, `signature` o `X-Goog-Signature`
 *  - `Bearer <token>` en headers filtrados por accidente
 *
 * Diseñado para consumirse desde `beforeSend` de Sentry y desde el logger
 * institucional. No toca tags controlados por el proyecto (`modulo`,
 * `radicadoId`, `runtime`, `project`), stack traces ni tipos de error.
 */

import { sanitizarPiiTextoSimi } from './sanitizar-pii';

const STORAGE_PATH_RE = /\b(radicados|respuestas)\/[A-Za-z0-9_-]+\/[^\s"'`]+/g;
const URL_FIRMADA_RE = /https?:\/\/[^\s"'`]*[?&](?:key|token|signature|X-Goog-Signature)=[^\s"'`&]+/gi;
const AUTH_BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;

export function sanitizarTextoObservabilidad(texto: string | null | undefined): string {
  if (!texto) return '';
  return sanitizarPiiTextoSimi(texto)
    .replace(URL_FIRMADA_RE, '[URL_FIRMADA]')
    .replace(STORAGE_PATH_RE, '[RUTA_STORAGE]')
    .replace(AUTH_BEARER_RE, 'Bearer [TOKEN]');
}

/**
 * Sanea un evento de Sentry en profundidad. Retorna el mismo objeto
 * mutado (Sentry acepta esto en `beforeSend`).
 *
 * Cubre: message, exception.values[*].value, breadcrumbs, request.url,
 * extra. NO toca: type, stacktrace, tags, environment, release, level.
 */
export function sanitizarEventoSentry<E extends Record<string, unknown>>(event: E): E {
  if (typeof event.message === 'string') {
    (event as Record<string, unknown>).message = sanitizarTextoObservabilidad(event.message);
  }

  const exception = event.exception as { values?: Array<{ value?: string }> } | undefined;
  if (exception?.values) {
    for (const v of exception.values) {
      if (typeof v.value === 'string') v.value = sanitizarTextoObservabilidad(v.value);
    }
  }

  const breadcrumbs = event.breadcrumbs as Array<{
    message?: string;
    data?: Record<string, unknown>;
  }> | undefined;
  if (Array.isArray(breadcrumbs)) {
    for (const b of breadcrumbs) {
      if (typeof b.message === 'string') b.message = sanitizarTextoObservabilidad(b.message);
      if (b.data && typeof b.data.url === 'string') {
        b.data.url = sanitizarTextoObservabilidad(b.data.url as string);
      }
    }
  }

  const req = event.request as { url?: string } | undefined;
  if (req && typeof req.url === 'string') {
    req.url = sanitizarTextoObservabilidad(req.url);
  }

  const extra = event.extra as Record<string, unknown> | undefined;
  if (extra) {
    for (const k of Object.keys(extra)) {
      if (typeof extra[k] === 'string') {
        extra[k] = sanitizarTextoObservabilidad(extra[k] as string);
      }
    }
  }

  return event;
}
