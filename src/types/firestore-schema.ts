/**
 * src/types/firestore-schema.ts
 * ──────────────────────────────
 * Canonical Firestore collection names and required composite indexes.
 *
 * USAGE
 *   import { COLECCIONES } from '@/src/types/firestore-schema';
 *   collection(db, COLECCIONES.RADICADOS)
 */

/* ── Collection names ────────────────────────────────────────────────────── */

export const COLECCIONES = {
  RADICADOS: 'radicados',
  USERS:     'users',
} as const;

export type ColeccionId = (typeof COLECCIONES)[keyof typeof COLECCIONES];

/* ── Required Firestore composite indexes ────────────────────────────────── */

/**
 * Each entry documents a composite index that must exist in Firestore.
 *
 * To create missing indexes, open the link that appears in the Firebase
 * error message when the query first runs (onSnapshot will surface it).
 */
export const INDICES_REQUERIDOS = [
  {
    descripcion: 'Radicados por tenant + fecha (usado en useRadicados para FUNCIONARIO/RECEPCIONISTA)',
    coleccion:   COLECCIONES.RADICADOS,
    campos:      [
      { campo: 'clasificacionIA.oficinaDestino', orden: 'ASCENDING'  },
      { campo: 'fechaCreacion',                   orden: 'DESCENDING' },
    ],
  },
  {
    descripcion: 'Radicados por fecha DESC (ADMIN sin filtro de tenant)',
    coleccion:   COLECCIONES.RADICADOS,
    campos:      [
      { campo: 'fechaCreacion', orden: 'DESCENDING' },
    ],
  },
] as const;
