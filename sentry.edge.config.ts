/**
 * Sentry — inicialización del SDK en el EDGE RUNTIME (Middleware, Edge API Routes).
 *
 * Configuración mínima: el Edge runtime tiene un subconjunto de las APIs de Node.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn:              SENTRY_DSN,
    environment:      process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  });
}
