export type UnidadTermino = 'HABILES' | 'CALENDARIO';

export type TipoSolicitudId =
  | 'PETICION'
  | 'PETICION_INFORMACION'
  | 'PETICION_AUTORIDADES'
  | 'QUEJA'
  | 'RECLAMO'
  | 'SUGERENCIA'
  | 'FELICITACION'
  | 'DENUNCIA'
  | 'HABEAS_DATA'
  | 'INFORMATIVO'
  | 'LICENCIA_CONSTRUCCION'
  | 'ENTES_CONTROL_URGENTE';

export interface TipoSolicitudConfig {
  id: TipoSolicitudId;
  nombre: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
  prioridadSugerida: 'ROJO' | 'NARANJA' | 'AMARILLO';
}

export interface CalculoVencimiento {
  tipoSolicitud: TipoSolicitudConfig;
  fechaRadicado: string;
  fechaVencimiento: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
}

export const TIPOS_SOLICITUD: Record<TipoSolicitudId, TipoSolicitudConfig> = {
  /* ── PQRSD — Catálogo completo Ley 1755 de 2015 ─────────── */
  PETICION: {
    id: 'PETICION',
    nombre: 'Petición (Derecho de petición)',
    diasRespuesta: 15,
    unidad: 'HABILES',
    prioridadSugerida: 'NARANJA',
  },
  PETICION_INFORMACION: {
    id: 'PETICION_INFORMACION',
    nombre: 'Solicitud de información',
    diasRespuesta: 10,
    unidad: 'HABILES',
    prioridadSugerida: 'AMARILLO',
  },
  PETICION_AUTORIDADES: {
    id: 'PETICION_AUTORIDADES',
    nombre: 'Petición entre autoridades',
    diasRespuesta: 15,
    unidad: 'HABILES',
    prioridadSugerida: 'NARANJA',
  },
  QUEJA: {
    id: 'QUEJA',
    nombre: 'Queja',
    diasRespuesta: 15,
    unidad: 'HABILES',
    prioridadSugerida: 'NARANJA',
  },
  RECLAMO: {
    id: 'RECLAMO',
    nombre: 'Reclamo',
    diasRespuesta: 15,
    unidad: 'HABILES',
    prioridadSugerida: 'NARANJA',
  },
  SUGERENCIA: {
    id: 'SUGERENCIA',
    nombre: 'Sugerencia',
    diasRespuesta: 15,
    unidad: 'HABILES',
    prioridadSugerida: 'AMARILLO',
  },
  FELICITACION: {
    id: 'FELICITACION',
    nombre: 'Felicitación',
    diasRespuesta: 15,
    unidad: 'CALENDARIO',
    prioridadSugerida: 'AMARILLO',
  },
  DENUNCIA: {
    id: 'DENUNCIA',
    nombre: 'Denuncia',
    diasRespuesta: 15,
    unidad: 'HABILES',
    prioridadSugerida: 'ROJO',
  },
  HABEAS_DATA: {
    id: 'HABEAS_DATA',
    nombre: 'Solicitud de datos personales (Habeas Data)',
    diasRespuesta: 10,
    unidad: 'HABILES',
    prioridadSugerida: 'NARANJA',
  },
  /* ── Tipos especializados existentes ─────────────────────── */
  INFORMATIVO: {
    id: 'INFORMATIVO',
    nombre: 'Informativo',
    diasRespuesta: 10,
    unidad: 'CALENDARIO',
    prioridadSugerida: 'AMARILLO',
  },
  LICENCIA_CONSTRUCCION: {
    id: 'LICENCIA_CONSTRUCCION',
    nombre: 'Licencia de construcción',
    diasRespuesta: 45,
    unidad: 'HABILES',
    prioridadSugerida: 'AMARILLO',
  },
  ENTES_CONTROL_URGENTE: {
    id: 'ENTES_CONTROL_URGENTE',
    nombre: 'Petición entes de control (urgente)',
    diasRespuesta: 2,
    unidad: 'HABILES',
    prioridadSugerida: 'ROJO',
  },
};

/** Tipos visibles para el ciudadano en el formulario público de radicación */
export const TIPOS_PQRSD_CIUDADANO: TipoSolicitudId[] = [
  'PETICION',
  'QUEJA',
  'RECLAMO',
  'SUGERENCIA',
  'FELICITACION',
  'DENUNCIA',
  'PETICION_INFORMACION',
  'HABEAS_DATA',
];

export const LISTA_TIPOS_SOLICITUD = Object.values(TIPOS_SOLICITUD);

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

export function calcularFechaVencimiento(
  fechaRadicado: string | Date,
  tipoSolicitudId: TipoSolicitudId,
  festivosExtra: string[] = [],
): CalculoVencimiento {
  const tipoSolicitud = TIPOS_SOLICITUD[tipoSolicitudId];
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

export function diasRestantesHabiles(fechaVencimiento: string | Date, desde: string | Date = new Date()): number {
  const fin = atLocalNoon(fechaVencimiento);
  let cursor = atLocalNoon(desde);
  const direction = cursor <= fin ? 1 : -1;
  let count = 0;

  while (toDateOnly(cursor) !== toDateOnly(fin)) {
    cursor = addDays(cursor, direction);
    if (esDiaHabil(cursor)) count += direction;
  }

  return count;
}

