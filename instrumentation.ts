/**
 * Arranque de observabilidad del SERVIDOR (convención `instrumentation.ts`
 * de Next: `register()` corre una vez al iniciar cada instancia).
 *
 * POR QUÉ EXISTE. Todo el cableado de Sentry llevaba semanas construido —
 * `withSentryConfig` en next.config, el CSP permite ingest.sentry.io,
 * `logError()` envía a Sentry "si está inicializado", y el depurador de PII
 * (`sanitizarEventoSentry`, H-N03) esperaba un consumidor — pero NADIE
 * inicializaba el SDK, así que todo eso era no-op: si producción fallaba de
 * noche, nadie se enteraba salvo que un ciudadano llamara. Era la medida G7
 * del cierre del SEV-1 (ADR-0025), abierta desde julio.
 *
 * DECISIONES DE PRIVACIDAD (Ley 1581 — esto guarda datos de ciudadanos):
 *  - `sendDefaultPii: false` — jamás IPs, cookies ni headers.
 *  - `beforeSend` pasa TODO evento por `sanitizarEventoSentry`: cédulas,
 *    correos, rutas de Storage y URLs firmadas salen enmascarados.
 *  - `tracesSampleRate: 0` — solo errores; el rendimiento ya lo cubre el
 *    presupuesto 2B y activar trazas multiplicaría eventos con URLs reales.
 *
 * SIN `SENTRY_DSN`, `init` no se llama: no-op total. Este archivo puede
 * mergearse antes de que exista el proyecto en Sentry sin efecto alguno.
 */
import * as Sentry from '@sentry/nextjs';
import { sanitizarEventoSentry } from '@/lib/seguridad/sanitizar-observabilidad';

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
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

/**
 * Errores de servidor que Next captura fuera de nuestros try/catch
 * (Server Components, streaming, rutas). Complementa a `logError()`, que
 * cubre los errores que el código SÍ atrapa.
 */
export const onRequestError = Sentry.captureRequestError;
