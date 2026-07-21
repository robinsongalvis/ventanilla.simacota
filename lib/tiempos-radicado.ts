/* ══════════════════════════════════════════════════════════════
   lib/tiempos-radicado.ts

   Cálculo de términos legales y festivos colombianos.

   Esta capa se apoya en el catálogo central
   `lib/catalogos/tipos-solicitud.ts` como fuente única de verdad para
   los tipos de solicitud, sus términos y unidad (hábiles/calendario).

   Se preserva la API histórica (TIPOS_SOLICITUD, TipoSolicitudId,
   TIPOS_PQRSD_CIUDADANO, LISTA_TIPOS_SOLICITUD, calcularFechaVencimiento)
   para no romper a los consumidores existentes.
══════════════════════════════════════════════════════════════ */

import {
  CATALOGO_TIPOS_SOLICITUD,
  TIPO_SOLICITUD_FALLBACK_ID,
  getTipoSolicitudById,
  getTiposSolicitudCiudadano,
  type PrioridadSugerida,
  type TipoSolicitudCatalogo,
} from './catalogos/tipos-solicitud';

/* ──────────────────────────────────────────────
   Tipos públicos (compatibilidad histórica)
────────────────────────────────────────────── */

export type UnidadTermino = 'HABILES' | 'CALENDARIO';

export type TipoSolicitudId = (typeof CATALOGO_TIPOS_SOLICITUD)[number]['id'];

export interface TipoSolicitudConfig {
  id: TipoSolicitudId;
  nombre: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
  prioridadSugerida: PrioridadSugerida;
}

export interface CalculoVencimiento {
  tipoSolicitud: TipoSolicitudConfig;
  fechaRadicado: string;
  fechaVencimiento: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
}

/* ──────────────────────────────────────────────
   Adaptador catálogo → TipoSolicitudConfig
────────────────────────────────────────────── */

function toConfig(tipo: TipoSolicitudCatalogo): TipoSolicitudConfig {
  return {
    id: tipo.id as TipoSolicitudId,
    nombre: tipo.nombre,
    diasRespuesta: tipo.terminoDias,
    unidad: tipo.tipoDias,
    prioridadSugerida: tipo.prioridadSugerida ?? 'AMARILLO',
  };
}

/* ──────────────────────────────────────────────
   Registro plano TIPOS_SOLICITUD derivado del catálogo
────────────────────────────────────────────── */

export const TIPOS_SOLICITUD: Record<TipoSolicitudId, TipoSolicitudConfig> =
  Object.fromEntries(
    CATALOGO_TIPOS_SOLICITUD.map((t) => [t.id, toConfig(t)] as const),
  ) as Record<TipoSolicitudId, TipoSolicitudConfig>;

/** Tipos visibles para el ciudadano en el formulario público de radicación. */
export const TIPOS_PQRSD_CIUDADANO: TipoSolicitudId[] = getTiposSolicitudCiudadano().map(
  (t) => t.id as TipoSolicitudId,
);

/** Lista plana de tipos del catálogo en orden estable. */
export const LISTA_TIPOS_SOLICITUD: TipoSolicitudConfig[] = CATALOGO_TIPOS_SOLICITUD.map(toConfig);

/* ──────────────────────────────────────────────
   Alias legacy → catálogo nuevo

   Documentos radicados antes de la unificación del catálogo usaron IDs
   que ya no existen en `lib/catalogos/tipos-solicitud.ts`. Para mantener
   la compatibilidad de lectura, mapeamos esos IDs al equivalente actual.
   El resolver consulta este mapa antes de aplicar el fallback duro.
────────────────────────────────────────────── */

const LEGACY_TIPO_ALIASES: Record<string, TipoSolicitudId> = {
  PETICION: 'PETICION_GENERAL',
  PETICION_AUTORIDADES: 'CONSULTA',
  ENTES_CONTROL_URGENTE: 'PETICION_ENTES_CONTROL',
};

/**
 * Devuelve la configuración de un tipo a partir de su id.
 * Resuelve alias legacy y, si el id no existe, aplica fallback a
 * PETICION_GENERAL (15 días hábiles).
 */
export function resolverTipoSolicitud(id: string | null | undefined): TipoSolicitudConfig {
  if (id) {
    const directo = TIPOS_SOLICITUD[id as TipoSolicitudId];
    if (directo) return directo;
    const alias = LEGACY_TIPO_ALIASES[id];
    if (alias) {
      const aliasConfig = TIPOS_SOLICITUD[alias];
      if (aliasConfig) return aliasConfig;
    }
  }
  const fallback = getTipoSolicitudById(TIPO_SOLICITUD_FALLBACK_ID);
  if (!fallback) {
    throw new Error('Catálogo de tipos de solicitud corrupto: fallback ausente.');
  }
  return toConfig(fallback);
}

/* ──────────────────────────────────────────────
   Calendario hábil colombiano
────────────────────────────────────────────── */

function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function atLocalNoon(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function nextMonday(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  const delta = day === 1 ? 0 : (8 - day) % 7;
  return addDays(next, delta);
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function festivosColombia(year: number): Set<string> {
  const easter = easterSunday(year);
  const fixed = [
    new Date(year, 0, 1, 12),
    new Date(year, 4, 1, 12),
    new Date(year, 6, 20, 12),
    new Date(year, 7, 7, 12),
    new Date(year, 11, 8, 12),
    new Date(year, 11, 25, 12),
  ];

  const movedToMonday = [
    new Date(year, 0, 6, 12),
    new Date(year, 2, 19, 12),
    new Date(year, 5, 29, 12),
    new Date(year, 7, 15, 12),
    new Date(year, 9, 12, 12),
    new Date(year, 10, 1, 12),
    new Date(year, 10, 11, 12),
  ].map(nextMonday);

  const easterBased = [
    addDays(easter, -3),
    addDays(easter, -2),
    nextMonday(addDays(easter, 39)),
    nextMonday(addDays(easter, 60)),
    nextMonday(addDays(easter, 68)),
  ];

  return new Set([...fixed, ...movedToMonday, ...easterBased].map(toDateOnly));
}

export function esDiaHabil(date: Date, festivos = festivosColombia(date.getFullYear())): boolean {
  return !isWeekend(date) && !festivos.has(toDateOnly(date));
}

/* ──────────────────────────────────────────────
   Cálculo de vencimiento
────────────────────────────────────────────── */

/**
 * Calcula la fecha de vencimiento legal a partir del tipo de solicitud.
 *
 * - Si `tipoDias === HABILES`, se cuentan días hábiles colombianos
 *   (excluye sábados, domingos y festivos).
 * - Si `tipoDias === CALENDARIO`, se suman días calendario.
 * - Si `tipoSolicitudId` no existe en el catálogo, se aplica fallback a
 *   PETICION_GENERAL (15 días hábiles).
 */
export function calcularFechaVencimiento(
  fechaRadicado: string | Date,
  tipoSolicitudId: string,
  festivosExtra: string[] = [],
): CalculoVencimiento {
  const tipoSolicitud = resolverTipoSolicitud(tipoSolicitudId);
  const inicio = atLocalNoon(fechaRadicado);
  const festivos = new Set([
    ...festivosColombia(inicio.getFullYear()),
    ...festivosColombia(inicio.getFullYear() + 1),
    ...festivosExtra,
  ]);

  let cursor = inicio;

  if (tipoSolicitud.unidad === 'CALENDARIO') {
    cursor = addDays(cursor, tipoSolicitud.diasRespuesta);
  } else {
    let pendientes = tipoSolicitud.diasRespuesta;
    while (pendientes > 0) {
      cursor = addDays(cursor, 1);
      if (esDiaHabil(cursor, festivos)) pendientes -= 1;
    }
  }

  return {
    tipoSolicitud,
    fechaRadicado: inicio.toISOString(),
    fechaVencimiento: cursor.toISOString(),
    diasRespuesta: tipoSolicitud.diasRespuesta,
    unidad: tipoSolicitud.unidad,
  };
}

/**
 * Fecha límite (calendario) tal que CUALQUIER `fechaVencimiento <=` esta
 * fecha tiene, como máximo, `umbralDiasHabiles` días hábiles restantes desde
 * `desde` — es decir, una cota superior segura para acotar consultas
 * Firestore por rango en vez de traer la colección completa y filtrar en
 * memoria con `diasRestantesHabiles` (Roadmap P1.4: crons escalables). El
 * filtro exacto sigue siendo `diasRestantesHabiles` sobre el resultado ya
 * acotado — esta función solo decide QUÉ leer, no reemplaza la regla.
 *
 * Construida caminando hacia adelante exactamente `umbralDiasHabiles` días
 * hábiles desde `desde` (mismo algoritmo que `calcularFechaVencimiento` en
 * su rama HABILES). El conteo de días hábiles entre `desde+1` y el resultado
 * es, por construcción, `umbralDiasHabiles`; como ese conteo es monótono no
 * decreciente al avanzar la fecha, cualquier fecha anterior o igual al
 * resultado tiene un conteo <= umbralDiasHabiles.
 */
export function fechaLimiteAlertaVencimiento(
  desde: string | Date,
  umbralDiasHabiles: number,
  festivosExtra: string[] = [],
): Date {
  const inicio = atLocalNoon(desde);
  const festivos = new Set([
    ...festivosColombia(inicio.getFullYear()),
    ...festivosColombia(inicio.getFullYear() + 1),
    ...festivosExtra,
  ]);
  let cursor = inicio;
  let pendientes = Math.max(0, Math.trunc(umbralDiasHabiles));
  while (pendientes > 0) {
    cursor = addDays(cursor, 1);
    if (esDiaHabil(cursor, festivos)) pendientes -= 1;
  }
  return cursor;
}

export function diasRestantesHabiles(fechaVencimiento: string | Date, desde: string | Date = new Date()): number {
  const fin = atLocalNoon(fechaVencimiento);
  const cursorInicial = atLocalNoon(desde);
  // Defensa contra fechas inválidas: si cualquiera de los extremos no es
  // una fecha válida, devolver 0. Sin esta guarda el `while` de abajo
  // entraría en loop infinito (toDateOnly de Invalid Date nunca cuadra).
  if (Number.isNaN(fin.getTime()) || Number.isNaN(cursorInicial.getTime())) {
    return 0;
  }
  let cursor = cursorInicial;
  const direction = cursor <= fin ? 1 : -1;
  let count = 0;

  while (toDateOnly(cursor) !== toDateOnly(fin)) {
    cursor = addDays(cursor, direction);
    if (esDiaHabil(cursor)) count += direction;
  }

  return count;
}

/**
 * Suma `meses` calendario a una fecha con la regla del **Código Civil art. 67**
 * (y Ley 4 de 1913): el plazo vence el día correspondiente del mes destino y,
 * si ese día no existe en ese mes (p. ej. 31 de enero + 1 mes), vence el
 * **último día** del mes destino. `Date.setMonth` NO aplica esta regla
 * (desbordaría al mes siguiente), por eso se calcula el clamping explícito.
 *
 * Ancla a mediodía local para evitar corrimientos de día por zona horaria
 * (mismo patrón que el resto del módulo). Uso previsto: BM-B33 — plazo de
 * subsanación de 1 mes calendario desde la notificación (Ley 1755 Art. 17).
 *
 * Ejemplos: 31 ene 2026 +1 → 28 feb 2026; 31 ene 2024 +1 → 29 feb 2024;
 * 30/31 mar +1 → 30 abr; 30 dic 2026 +1 → 30 ene 2027.
 */
export function sumarMesCalendario(fecha: string | Date, meses = 1): Date {
  const base = atLocalNoon(fecha);
  if (Number.isNaN(base.getTime())) return base; // fecha inválida → se propaga
  // JS normaliza el desbordamiento de mes/año al construir la fecha.
  const mesDestino = base.getMonth() + meses;
  // Último día del mes destino = día 0 del mes siguiente.
  const ultimoDiaDestino = new Date(base.getFullYear(), mesDestino + 1, 0, 12, 0, 0, 0);
  const diaDestino = Math.min(base.getDate(), ultimoDiaDestino.getDate());
  return new Date(base.getFullYear(), mesDestino, diaDestino, 12, 0, 0, 0);
}

/* ──────────────────────────────────────────────
   BM-B33 — Reloj legal de la subsanación (Ley 1755 Art. 17)

   Funciones puras (sin IO, sin tipos de dominio → sin ciclo con
   `src/types/ventanilla.ts`). Los endpoints/cron las orquestan.
────────────────────────────────────────────── */

/**
 * Plazo del ciudadano para subsanar: 1 mes calendario desde la NOTIFICACIÓN
 * del requerimiento (no desde la emisión). Devuelve `Date` (mediodía local).
 */
export function plazoSubsanacion(fechaNotificacion: string | Date): Date {
  return sumarMesCalendario(fechaNotificacion, 1);
}

/**
 * Prórroga del ciudadano (Art. 17): hasta un término igual (1 mes calendario)
 * a partir de la fecha límite vigente. Una sola vez.
 */
export function plazoConProrroga(fechaLimiteActual: string | Date): Date {
  return sumarMesCalendario(fechaLimiteActual, 1);
}

/**
 * Reactivación del término al subsanar: se reanuda por los días hábiles que
 * quedaban, contados **desde el día siguiente** al aporte (Art. 17, no reinicia).
 * Caso límite (0 restantes): vence el día hábil siguiente al aporte (mínimo 1).
 */
export function reactivarVencimiento(
  fechaAporte: string | Date,
  diasHabilesRestantes: number,
  festivosExtra: string[] = [],
): Date {
  const inicio = atLocalNoon(fechaAporte);
  const festivos = new Set([
    ...festivosColombia(inicio.getFullYear()),
    ...festivosColombia(inicio.getFullYear() + 1),
    ...festivosExtra,
  ]);
  let pendientes = Math.max(1, Math.trunc(diasHabilesRestantes));
  let cursor = inicio;
  while (pendientes > 0) {
    cursor = addDays(cursor, 1);            // arranca el día SIGUIENTE al aporte
    if (esDiaHabil(cursor, festivos)) pendientes -= 1;
  }
  return cursor;
}

/**
 * ¿El requerimiento se emite dentro de la ventana legal? Art. 17: dentro de los
 * 10 días (hábiles, por consistencia con el resto de términos) desde la radicación.
 */
export function dentroVentanaRequerimiento(
  fechaRadicado: string | Date,
  ahora: string | Date = new Date(),
  maxDiasHabiles = 10,
): boolean {
  const transcurridos = diasRestantesHabiles(ahora, fechaRadicado);
  return transcurridos >= 0 && transcurridos <= maxDiasHabiles;
}

/** ¿La prórroga se solicita a tiempo (antes de vencer, inclusive el último día)? */
export function prorrogaEsOportuna(
  fechaLimite: string | Date,
  ahora: string | Date = new Date(),
): boolean {
  return atLocalNoon(ahora).getTime() <= atLocalNoon(fechaLimite).getTime();
}

/** ¿Venció el plazo de subsanación? (para el cron: propone solo si venció). */
export function subsanacionVencida(
  fechaLimiteEfectiva: string | Date,
  ahora: string | Date = new Date(),
): boolean {
  return atLocalNoon(ahora).getTime() > atLocalNoon(fechaLimiteEfectiva).getTime();
}
