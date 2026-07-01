/* ══════════════════════════════════════════════════════════════
   LOGGER ESTRUCTURADO — Ventanilla Única Simacota

   Salida en JSON one-liner para facilitar ingesta en
   Sentry / CloudWatch / Datadog. Cada línea puede parsearse
   con `JSON.parse` por cualquier log aggregator.

   Campos estándar:
     radicadoId — contexto de negocio del error
     timestamp  — ISO 8601, siempre UTC
     modulo     — "submodulo/operacion" (ej. "resolver-radicado/trazabilidad")
     mensaje    — mensaje human-readable del error, ya saneado de PII (H-N03)
══════════════════════════════════════════════════════════════ */

import { sanitizarTextoObservabilidad } from '@/lib/seguridad/sanitizar-observabilidad';

export interface ErrorLog {
  radicadoId: string;
  timestamp:  string;
  modulo:     string;
  mensaje:    string;
}

/**
 * Registra un error estructurado en stderr **y lo envía a Sentry** si está
 * inicializado.
 *
 * - La salida JSON es fácil de parsear por cualquier log aggregator.
 * - Sentry enriquece el evento con radicadoId y módulo como tags.
 * - Si SENTRY_DSN no está seteado, Sentry queda en modo no-op silencioso.
 * - Nunca lanza excepciones — seguro para llamar desde .catch().
 */
export function logError(params: {
  radicadoId: string;
  modulo:     string;
  error:      unknown;
}): void {
  const entry: ErrorLog = {
    radicadoId: params.radicadoId,
    timestamp:  new Date().toISOString(),
    modulo:     params.modulo,
    mensaje:    sanitizarTextoObservabilidad(
      params.error instanceof Error ? params.error.message : String(params.error),
    ),
  };

  // 1. Log estructurado (siempre)
  console.error('[ventanilla:error]', JSON.stringify(entry));

  // 2. Sentry (solo si está disponible e inicializado — no-op silencioso si no)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/nextjs') as typeof import('@sentry/nextjs');
    if (typeof Sentry.withScope === 'function') {
      Sentry.withScope((scope) => {
        scope.setTag('modulo',     entry.modulo);
        scope.setTag('radicadoId', entry.radicadoId);
        scope.setContext('ventanilla', entry as unknown as Record<string, unknown>);
        if (params.error instanceof Error) {
          Sentry.captureException(params.error);
        } else {
          Sentry.captureMessage(entry.mensaje, 'error');
        }
      });
    }
  } catch {
    // Sentry no disponible — no afecta el flujo principal
  }
}
