/**
 * Formateador del número de expediente de licencias urbanísticas — Fase 2
 * (arranque, PASO 4).
 *
 * PURO, sin I/O y SIN importar `DIRECTORIO_TENANTS`
 * (`src/types/reglas-negocio.ts`) ni ningún otro dato propio de Simacota —
 * el núcleo del motor de expedientes es trámite/municipio-agnóstico (A3,
 * ADR-0026 §A3: "ninguna Secretaría debe requerir modificaciones del
 * núcleo"). El call site (donde se arma el `SolicitudSerie.formatear` para
 * `lib/server/consecutivo-legal.ts`) resuelve los códigos del tenant vía
 * `codigosNumeroExpediente` (`src/types/reglas-negocio.ts`) y los pasa como
 * datos — este módulo solo sabe formatear, nunca de dónde salen los códigos.
 *
 * Formato: `{codigoDane}-{codigoCuraduria}-{AA}-{CCCC}` — AA = año en 2
 * dígitos, CCCC = consecutivo con padding a 4 dígitos (crece más allá de 4
 * sin truncar: `padStart` no recorta, solo rellena).
 */

export interface CodigosExpediente {
  /** Código DANE (DIVIPOLA) del municipio. String — puede llevar ceros a la izquierda. */
  codigoDane: string;
  /** Código de curaduría urbana ('0' si la función la ejerce Planeación directamente). */
  codigoCuraduria: string;
}

/**
 * Formatea el número de expediente a partir del consecutivo YA CONFIRMADO
 * (el que devuelve `leerConsecutivosLegales`/`confirmarConsecutivosLegales`,
 * `lib/server/consecutivo-legal.ts`) y la fecha de la actuación.
 *
 * RIESGO DE CONSISTENCIA DE AÑO (documentado a propósito, no un descuido):
 * el `AA` de este número sale de la MISMA `fecha` que el caller le pasa a
 * `leerConsecutivosLegales` para indexar `counters/expedientes-{año}` — eso
 * es responsabilidad del CALLER (el closure que arma `SolicitudSerie.
 * formatear`, que debe cerrar sobre la MISMA `fecha`/`Date` ya anclada por
 * el fix de TZ del PASO 1 — `atLocalNoon`/`Intl` anclado a `America/Bogota`,
 * no los getters locales del proceso). Si esa fecha NO estuviera anclada al
 * día civil de Bogotá, un expediente radicado la noche de Nochevieja
 * (31-dic tarde, hora Bogotá) en un proceso UTC podría indexar el counter
 * de un año pero formatear el número con el AA del año SIGUIENTE (o
 * viceversa) — número y contador de series distintos, exactamente la clase
 * de defecto que RS-1 corrigió para el reloj de términos. Este formateador
 * NO puede prevenir esa inconsistencia por sí solo (no controla qué `Date`
 * le llega): la previene el caller al reutilizar la MISMA fecha ancla para
 * ambas cosas.
 */
export function formatearNumeroExpediente(
  consecutivo: number,
  fecha: Date,
  codigos: CodigosExpediente,
): string {
  if (!Number.isInteger(consecutivo) || consecutivo <= 0) {
    throw new Error(`formatearNumeroExpediente: consecutivo inválido (${consecutivo}); debe ser un entero positivo.`);
  }
  if (!codigos.codigoDane || !codigos.codigoCuraduria) {
    throw new Error('formatearNumeroExpediente: codigoDane y codigoCuraduria son obligatorios (fail-closed, ver codigosNumeroExpediente).');
  }
  const anioCorto = String(fecha.getFullYear()).slice(-2);
  const consecutivoPadded = String(consecutivo).padStart(4, '0');
  return `${codigos.codigoDane}-${codigos.codigoCuraduria}-${anioCorto}-${consecutivoPadded}`;
}
