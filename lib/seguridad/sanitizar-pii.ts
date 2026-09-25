/**
 * Sanitización mínima de PII en textos enviados a SIMI/Gemini (H-11.2).
 *
 * Reemplaza patrones que aparecen con alta confianza como datos personales
 * (correo, teléfono móvil colombiano, número de documento con prefijo
 * explícito) por placeholders neutros. NO intenta detectar nombres, direcciones
 * ni teléfonos fijos — el riesgo de falsos positivos es alto y el prompt
 * institucional ya prohíbe inventar identidad.
 *
 * Decisiones de diseño:
 * - Email: regex estricto con TLD obligatorio.
 * - Teléfono: sólo móvil colombiano (10 dígitos empezando por 3, opcional +57).
 * - Documento: SÓLO con prefijo explícito (CC, TI, NIT, "cédula", ...) para
 *   no destrozar años, montos o códigos de radicado.
 *
 * Trade-off intencional: preferimos falsos negativos (algo de PII se cuela)
 * sobre falsos positivos (texto del ciudadano destruido). El objetivo es
 * reducción de riesgo, no bloqueo total.
 */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const TELEFONO_MOVIL_CO_RE = /(?:\+?57[\s.-]?)?\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

const DOCUMENTO_CON_PREFIJO_RE =
  /\b(CC|TI|RC|CE|PA|NIT|cédula|cedula|documento)[:\s.-]*(\d{6,11}|\d{1,3}(?:\.\d{3}){1,3})\b/gi;

export function sanitizarPiiTextoSimi(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto
    .replace(EMAIL_RE, '[CORREO]')
    .replace(TELEFONO_MOVIL_CO_RE, '[TELEFONO]')
    .replace(DOCUMENTO_CON_PREFIJO_RE, (_match, prefijo: string) => `${prefijo} [DOCUMENTO]`);
}
