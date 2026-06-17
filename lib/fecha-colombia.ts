/* ══════════════════════════════════════════════════════════════
   lib/fecha-colombia.ts

   Capa centralizada de manejo de fechas y horas para la Ventanilla
   Única Digital de la Alcaldía Municipal de Simacota.

   Todas las visualizaciones del sistema deben usar estos helpers para
   garantizar que la fecha y la hora se muestran en horario Colombia
   (America/Bogota) en es-CO, independientemente del navegador o
   servidor que las renderice.

   El almacenamiento sigue siendo ISO UTC (Timestamp Firestore o string
   ISO). Esta capa solo afecta la PRESENTACIÓN.
══════════════════════════════════════════════════════════════ */

export const TIMEZONE_COLOMBIA = 'America/Bogota';
export const LOCALE_COLOMBIA = 'es-CO';

const FALLBACK_NO_REGISTRADA = 'No registrada';
const FALLBACK_CORTO = '—';

/* ──────────────────────────────────────────────
   Núcleo
────────────────────────────────────────────── */

/** Instante actual representado como `Date` en UTC, listo para almacenamiento. */
export function nowColombia(): Date {
  return new Date();
}

/** Convierte cualquier entrada en `Date` válido o `null` (fechas inválidas). */
export function safeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp (objeto con toDate())
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  return null;
}

/* ──────────────────────────────────────────────
   Formateadores
────────────────────────────────────────────── */

interface OpcionesFormato {
  /** Texto a mostrar si la fecha es inválida o nula. */
  fallback?: string;
}

function format(value: unknown, opts: Intl.DateTimeFormatOptions, fallback: string): string {
  const date = safeDate(value);
  if (!date) return fallback;
  try {
    return new Intl.DateTimeFormat(LOCALE_COLOMBIA, {
      timeZone: TIMEZONE_COLOMBIA,
      ...opts,
    }).format(date);
  } catch {
    return fallback;
  }
}

/** Fecha en formato `DD/MM/YYYY` en horario Colombia. */
export function formatFechaColombia(
  value: unknown,
  { fallback = FALLBACK_NO_REGISTRADA }: OpcionesFormato = {},
): string {
  return format(value, { day: '2-digit', month: '2-digit', year: 'numeric' }, fallback);
}

/** Fecha corta `DD/MM/YY` (uso compacto, p. ej. listados densos). */
export function formatFechaCortaColombia(
  value: unknown,
  { fallback = FALLBACK_CORTO }: OpcionesFormato = {},
): string {
  return format(value, { day: '2-digit', month: '2-digit', year: '2-digit' }, fallback);
}

/** Hora en formato `hh:mm a. m. / p. m.` en horario Colombia. */
export function formatHoraColombia(
  value: unknown,
  { fallback = FALLBACK_CORTO }: OpcionesFormato = {},
): string {
  return format(value, { hour: '2-digit', minute: '2-digit', hour12: true }, fallback);
}

/** Fecha + hora `DD/MM/YYYY, hh:mm a. m. / p. m.` en horario Colombia. */
export function formatFechaHoraColombia(
  value: unknown,
  { fallback = FALLBACK_NO_REGISTRADA }: OpcionesFormato = {},
): string {
  return format(
    value,
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    },
    fallback,
  );
}

/** Fecha larga (`17 de junio de 2026`) en horario Colombia. Útil en oficios. */
export function formatFechaLargaColombia(
  value: unknown,
  { fallback = FALLBACK_NO_REGISTRADA }: OpcionesFormato = {},
): string {
  return format(value, { day: 'numeric', month: 'long', year: 'numeric' }, fallback);
}

/* ──────────────────────────────────────────────
   Conversión input ↔ ISO

   Los `<input type="datetime-local">` trabajan en hora local del
   navegador, lo cual produce inconsistencias en producción cuando el
   funcionario está fuera de Colombia (o el servidor SSR está en UTC).
   `toIsoFromColombiaInput` interpreta la cadena del input como hora
   Colombia y devuelve un ISO UTC equivalente.
────────────────────────────────────────────── */

const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000; // -05:00, sin DST

/**
 * Convierte el valor de un `<input type="datetime-local">` (cadena
 * `YYYY-MM-DDTHH:mm` o `YYYY-MM-DDTHH:mm:ss`) interpretándola como
 * hora local Colombia y devuelve un ISO UTC válido.
 *
 * Si la cadena no es válida devuelve `''`.
 */
export function toIsoFromColombiaInput(value: string): string {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return '';
  const [, y, m, d, h, mi, s] = match;
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  const hh = Number(h);
  const mn = Number(mi);
  const ss = s ? Number(s) : 0;
  // Validación estricta de rangos (JS acepta overflow silenciosamente).
  if (mm < 1 || mm > 12) return '';
  if (dd < 1 || dd > 31) return '';
  if (hh < 0 || hh > 23) return '';
  if (mn < 0 || mn > 59) return '';
  if (ss < 0 || ss > 59) return '';
  // Construimos el instante asumiendo zona Colombia (UTC-5) — la
  // representación ISO real es esa hora + 5h en UTC.
  const utcMs = Date.UTC(yy, mm - 1, dd, hh, mn, ss) + COLOMBIA_OFFSET_MS;
  const date = new Date(utcMs);
  // Verifica que el día no haya hecho overflow (ej: 31 de febrero).
  if (date.getUTCMonth() !== mm - 1) return '';
  return date.toISOString();
}

/**
 * Inverso de `toIsoFromColombiaInput`: dado un ISO UTC, retorna un
 * string compatible con `<input type="datetime-local">` en hora
 * Colombia (sin sufijo de zona).
 */
export function fromIsoToColombiaInput(value: unknown): string {
  const date = safeDate(value);
  if (!date) return '';
  // Restamos 5h para obtener "hora Colombia" como si fuera UTC, luego
  // formateamos como YYYY-MM-DDTHH:mm.
  const colombia = new Date(date.getTime() - COLOMBIA_OFFSET_MS);
  const y = colombia.getUTCFullYear();
  const m = String(colombia.getUTCMonth() + 1).padStart(2, '0');
  const d = String(colombia.getUTCDate()).padStart(2, '0');
  const h = String(colombia.getUTCHours()).padStart(2, '0');
  const mi = String(colombia.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${mi}`;
}
