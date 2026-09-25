import type { EstiloChipEstado } from './estilos-chip-estado';

/**
 * Estado VISUAL de un requisito del checklist (Bloque A·A3) — deriva
 * SIEMPRE de `ResultadoCompletitud` (`lib/motor-expedientes/completitud.ts`,
 * D4/ADR-0026), nunca reimplementa la evaluación de condiciones ni la
 * lógica de tres valores (Kleene). Ver `ChecklistRequisitos.tsx` para la
 * función que clasifica cada requisito en uno de estos 5 valores a partir
 * de las listas ya calculadas por el evaluador puro.
 *
 * `NO_APLICA` cubre DOS casos distintos en los datos (un CONDICIONAL cuya
 * condición no se cumple, o un OPCIONAL sin aporte — el evaluador ni
 * siquiera reporta a los opcionales, ver JSDoc de `estadoDe` en
 * `ChecklistRequisitos.tsx`) pero comparten el mismo trío de color: ambos
 * son "no bloquea, informativo". `RequisitoItem` distingue el TEXTO según
 * `requisito.tipo`, no el color.
 */
export type EstadoVisualRequisito = 'APORTADO' | 'PENDIENTE' | 'NO_APLICA' | 'INDETERMINADO' | 'DUPLICADO';

/**
 * Mismos tríos ya definidos en `estilos-chip-estado.ts` / `estilos-estado-
 * juridico.ts` — ninguna paleta nueva (principio de reutilización de
 * tokens ya documentado en esos archivos):
 *  - APORTADO      → el mismo esmeralda que CONCEDIDA (acto favorable).
 *  - PENDIENTE      → el mismo ámbar que POR_VENCER / CON_ACTA_DE_OBSERVACIONES.
 *  - NO_APLICA      → el mismo gris neutro que DESISTIDA / TERMINADO.
 *  - INDETERMINADO  → el mismo azul info que HISTORICO / RADICADA_EN_DEBIDA_FORMA
 *    (deliberado: NO es un error, es un dato del caso que falta capturar
 *    en «Hechos del caso» — el rojo se reserva para DUPLICADO, que sí es
 *    una inconsistencia real del expediente).
 *  - DUPLICADO      → el mismo rojo que NEGADA (única condición de error
 *    real de esta tabla — H2, ADR-0026 §A2 #14).
 */
export const ESTILOS_ESTADO_REQUISITO: Record<EstadoVisualRequisito, EstiloChipEstado> = {
  APORTADO: {
    dot: '#16A34A',
    texto: '#116932',
    fondo: '#E7F6EC',
    label: 'Aportado',
  },
  PENDIENTE: {
    dot: '#D97706',
    texto: '#7A4F0A',
    fondo: '#FAEEDA',
    label: 'Pendiente',
  },
  NO_APLICA: {
    dot: '#475569',
    texto: '#3A4551',
    fondo: '#EEF2F5',
    label: 'No aplica',
  },
  INDETERMINADO: {
    dot: '#2563EB',
    texto: '#1E4FA0',
    fondo: '#E9F0FC',
    label: 'Falta definir',
  },
  DUPLICADO: {
    dot: '#DC2626',
    texto: '#911111',
    fondo: '#FCEBEB',
    label: 'Aportes duplicados',
  },
};
