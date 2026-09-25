/**
 * Sentry — inicialización del SDK en el SERVIDOR (API Routes, Server Components).
 *
 * Usamos SENTRY_DSN (sin NEXT_PUBLIC_) porque este archivo solo corre
 * en Node.js y el DSN no se expone al bundle cliente.
 */

import * as Sentry from '@sentry/nextjs';
import { sanitizarEventoSentry } from '@/lib/seguridad/sanitizar-observabilidad';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment:       process.env.NODE_ENV ?? 'production',
    tracesSampleRate:  process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    release:           process.env.VERCEL_GIT_COMMIT_SHA,

    // Contexto extra en cada evento de servidor
    initialScope: {
      tags: {
        runtime:  'nodejs',
        project:  'ventanilla-unica-simacota',
      },
    },

    // H-N03: sanea PII, rutas Storage, URLs firmadas y tokens antes de enviar.
    beforeSend(event) {
      sanitizarEventoSentry(event as unknown as Record<string, unknown>);
      return event;
    },
  });
}
