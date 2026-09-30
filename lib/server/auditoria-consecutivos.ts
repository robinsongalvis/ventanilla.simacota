import { type AlcanceVigilancia } from '@/lib/server/alcance-vigilancia';
import { type SerieConsecutivo } from '@/lib/server/consecutivo-legal';

/**
 * Alcance declarado del barrido de continuidad (ADR-0033 §4.6).
 *
 * Las series excluidas no quedan sin vigilancia: las que todavía no tienen
 * documentos emitidos se revisan por contador y coherencia de apertura en el
 * cron de auditoría. Mantener esta declaración fuera del Route Handler permite
 * probarla sin convertirla en un export no admitido de `route.ts`.
 */
export const ALCANCE_BARRIDA_CONTINUIDAD: AlcanceVigilancia<SerieConsecutivo> = {
  cubiertos: ['radicados', 'salidas', 'planillas'],
  excluidos: {
    expedientes:
      'No tiene colección de documentos asignada mientras Fase 1 no la defina, así que no hay serie de ids que barrer por continuidad. NO queda sin vigilancia: se audita en su propia rama (estado del contador y coherencia con su apertura) más abajo en este mismo cron.',
    'actos-lsr':
      'El acto todavía no se emite: no hay documentos cuyo id lleve el consecutivo. Se audita con `expedientes`, por contador y apertura.',
    'actos-lc':
      'El acto todavía no se emite: no hay documentos cuyo id lleve el consecutivo. Se audita con `expedientes`, por contador y apertura.',
    'actos-lsu':
      'El acto todavía no se emite: no hay documentos cuyo id lleve el consecutivo. Se audita con `expedientes`, por contador y apertura.',
    'actos-ph':
      'El acto todavía no se emite: no hay documentos cuyo id lleve el consecutivo. Se audita con `expedientes`, por contador y apertura.',
    'actos-lr':
      'El acto todavía no se emite: no hay documentos cuyo id lleve el consecutivo. Se audita con `expedientes`, por contador y apertura.',
    'actos-lu':
      'El acto todavía no se emite: no hay documentos cuyo id lleve el consecutivo. Se audita con `expedientes`, por contador y apertura.',
  },
};

/**
 * Rama propia para la serie `expedientes` (PASO 6, Fase 2 arranque),
 * deliberadamente separada del barrido de las series legadas.
 *
 * Los identificadores de expedientes usan año de dos dígitos en el penúltimo
 * segmento y todavía no existe una colección de documentos emitidos contra la
 * cual comprobar continuidad. Por eso, hasta que esa colección exista, esta
 * rama informa exclusivamente el estado del contador.
 */
export interface ReporteSerieExpedientes {
  estado: 'SIN_ABRIR' | 'PARCIAL' | 'CORRUPTO';
  ultimo?: number;
  motivo?: string;
}

/**
 * Audita, sin I/O, la forma del contador anual de expedientes.
 *
 * `SIN_ABRIR` es válido antes de la primera emisión; `PARCIAL` confirma que
 * el contador tiene forma válida, pero no sustituye una futura auditoría de
 * continuidad; `CORRUPTO` identifica un valor que no puede ser consecutivo.
 */
export function auditarCounterExpedientes(
  data: Record<string, unknown> | undefined,
): ReporteSerieExpedientes {
  if (data === undefined) {
    return { estado: 'SIN_ABRIR' };
  }
  const ultimoRaw = data.ultimo;
  const ultimo = Number(ultimoRaw);
  if (!Number.isInteger(ultimo) || ultimo < 0) {
    return {
      estado: 'CORRUPTO',
      motivo: `counters/expedientes-{año}.ultimo inválido (${JSON.stringify(ultimoRaw)}): debe ser un entero >= 0.`,
    };
  }
  return {
    estado: 'PARCIAL',
    ultimo,
    motivo: 'auditoría de continuidad pendiente de colección (Fase 1)',
  };
}
