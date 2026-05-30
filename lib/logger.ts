/* ══════════════════════════════════════════════════════════════
   LOGGER ESTRUCTURADO — Ventanilla Única Simacota

   Salida en JSON one-liner para facilitar ingesta en
   Sentry / CloudWatch / Datadog. Cada línea puede parsearse
   con `JSON.parse` por cualquier log aggregator.

   Campos estándar:
     radicadoId — contexto de negocio del error
     timestamp  — ISO 8601, siempre UTC
     modulo     — "submodulo/operacion" (ej. "resolver-radicado/trazabilidad")
     mensaje    — mensaje human-readable del error
══════════════════════════════════════════════════════════════ */

export interface ErrorLog {
  radicadoId: string;
  timestamp:  string;
  modulo:     string;
  mensaje:    string;
}

/**
 * Registra un error estructurado en stderr.
 * Nunca lanza excepciones — seguro para llamar desde .catch().
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
    mensaje:    params.error instanceof Error ? params.error.message : String(params.error),
  };
  // eslint-disable-next-line no-console
  console.error('[ventanilla:error]', JSON.stringify(entry));
}
