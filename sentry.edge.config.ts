/**
 * Sentry — inicialización del SDK en el EDGE RUNTIME (Middleware, Edge API Routes).
 *
 * Configuración mínima: el Edge runtime tiene un subconjunto de las APIs de Node.
 */

import * as Sentry from '@sentry/nextjs';
import { sanitizarEventoSentry } from '@/lib/seguridad/sanitizar-observabilidad';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn:              SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,

    // H-N03: sanea PII, rutas Storage, URLs firmadas y tokens antes de enviar.
    beforeSend(event) {
      sanitizarEventoSentry(event as unknown as Record<string, unknown>);
      return event;
    },
  });
}
