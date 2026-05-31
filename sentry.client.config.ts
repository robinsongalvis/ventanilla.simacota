/**
 * Sentry — inicialización del SDK en el NAVEGADOR (Client Components).
 *
 * Este archivo se ejecuta automáticamente antes de cualquier código de la app
 * cuando está en el bundle cliente. SENTRY_DSN debe estar disponible como
 * NEXT_PUBLIC_SENTRY_DSN si se necesita en el cliente.
 *
 * Si SENTRY_DSN no está configurado, Sentry queda en modo no-op silencioso.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Entorno de despliegue
    environment: process.env.NODE_ENV ?? 'production',

    // Sample rate: 100% de errores, 10% de performance en producción
    tracesSampleRate:   process.env.NODE_ENV === 'production' ? 0.1  : 1.0,
    replaysSessionSampleRate: 0,      // Sin session replay (costo/privacidad)
    replaysOnErrorSampleRate:  0.5,   // Graba replay solo en errores

    // Correlaciona errores con el commit actual
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // Ignorar errores de red transitoria (no son bugs del sistema)
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /^Network request failed/,
      /^Failed to fetch/,
    ],

    beforeSend(event) {
      // No enviar en desarrollo local
      if (process.env.NODE_ENV === 'development') return null;
      return event;
    },
  });
}
