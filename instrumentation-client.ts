/**
 * Arranque de observabilidad del NAVEGADOR (convención
 * `instrumentation-client.ts` de Next: efectos directos, sin export).
 *
 * Mismas decisiones de privacidad que el servidor (ver instrumentation.ts).
 * Además, deliberadamente SIN Session Replay: grabaría las pantallas del
 * funcionario con datos reales de ciudadanos — un riesgo de Ley 1581 que
 * ninguna comodidad de depuración justifica. Si algún día se evalúa,
 * exige ADR propio con enmascaramiento total.
 *
 * Sin `NEXT_PUBLIC_SENTRY_DSN`, no se inicializa: no-op.
 */
import * as Sentry from '@sentry/nextjs';
import { sanitizarEventoSentry } from '@/lib/seguridad/sanitizar-observabilidad';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      // El depurador es genérico sobre registros planos y muta en sitio;
      // ErrorEvent no tiene firma de índice, así que se adapta el tipo y se
      // devuelve el MISMO objeto ya saneado (contrato documentado en H-N03).
      sanitizarEventoSentry(event as unknown as Record<string, unknown>);
      return event;
    },
  });
}
