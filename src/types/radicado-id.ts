/**
 * src/types/radicado-id.ts
 * ─────────────────────────
 * Generates unique radicado IDs with the format:
 *   EXT-YYYY-MM-DD-HHmmss-XXXX
 *
 * The 4-char suffix uses a charset that excludes visually ambiguous
 * characters (O, 0, I, 1, L) to avoid transcription errors.
 */

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function uid4(): string {
  return Array.from(
    { length: 4 },
    () => CHARSET[Math.floor(Math.random() * CHARSET.length)]
  ).join('');
}

/**
 * Generates a radicado ID based on the current timestamp.
 *
 * @param offsetMs - Optional milliseconds to subtract from now (useful for seed data).
 *
 * @example
 * generarRadicadoId()
 * // → "EXT-2026-04-14-153022-K7MQ"
 */
export function generarRadicadoId(offsetMs = 0): string {
  const d    = new Date(Date.now() - offsetMs);
  const date = d.toISOString().split('T')[0];                      // YYYY-MM-DD
  const time = d.toTimeString().slice(0, 8).replace(/:/g, '');     // HHmmss
  return `EXT-${date}-${time}-${uid4()}`;
}
