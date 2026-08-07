import type { EstadoLicenciaUI } from './tipos';

/**
 * Trío de color por estado del semáforo de Licencias — dot, texto y fondo
 * del `ChipEstado`.
 *
 * DECISIÓN DE MAPEO DE TOKENS (ver respuesta de la tarea): en vez de crear
 * una paleta rose/amber/emerald nueva en `app/globals.css`, este módulo
 * REUTILIZA los matices semánticos que YA existen en el sistema de diseño:
 *  - EN_TERMINO  → verde institucional (`VERDE_INST` = '#14532D', el mismo
 *    que usa `construirTarjetasMIPG` en el dashboard para su fila "En
 *    término" — misma semántica, mismo color).
 *  - POR_VENCER / VENCIDO → los mismos pares riel/chipBg/chipTexto que
 *    `lib/kpis-mipg/tokens-estado-kpi.ts` ya define para 'POR_VENCER' y
 *    'VENCIDAS' (copiados literalmente, no reinventados).
 *  - ASIGNADO → dorado institucional (`--color-accent` / `--color-inst-gold`
 *    '#D4A017', fondo `--color-accent-soft` '#F5E8B7', ambos YA definidos en
 *    `app/globals.css`).
 *  - TERMINADO → gris neutro, mismo trío que 'RADICADAS' en
 *    `tokens-estado-kpi.ts` (un estado "sin urgencia", no un color nuevo).
 *  - HISTORICO → azul info, tinte derivado de `--color-info` ('#2563EB',
 *    ya existente); el tinte de fondo es la única cifra genuinamente nueva
 *    de esta tabla, siguiendo la MISMA fórmula (≈93% claridad) que ya usan
 *    los otros pares de `tokens-estado-kpi.ts`.
 *
 * Si `ChipEstado` se reutiliza fuera de este módulo, promover esta tabla a
 * `app/globals.css` (tokens CSS compartidos) es el siguiente paso natural —
 * no hay puertas cerradas, solo se evitó adelantar esa promoción sin un
 * segundo consumidor real (YAGNI).
 */
export interface EstiloChipEstado {
  dot: string;
  texto: string;
  fondo: string;
  label: string;
}

export const ESTILOS_CHIP_ESTADO: Record<EstadoLicenciaUI, EstiloChipEstado> = {
  EN_TERMINO: {
    dot: '#14532D',
    texto: '#14532D',
    fondo: '#EEF4EE',
    label: 'En término',
  },
  POR_VENCER: {
    dot: '#D97706',
    texto: '#7A4F0A',
    fondo: '#FAEEDA',
    label: 'Por vencer',
  },
  VENCIDO: {
    dot: '#DC2626',
    texto: '#911111',
    fondo: '#FCEBEB',
    label: 'Vencido',
  },
  ASIGNADO: {
    dot: '#D4A017',
    texto: '#8A6414',
    fondo: '#F5E8B7',
    label: 'Asignado',
  },
  TERMINADO: {
    dot: '#475569',
    texto: '#3A4551',
    fondo: '#EEF2F5',
    label: 'Terminado',
  },
  HISTORICO: {
    dot: '#2563EB',
    texto: '#1E4FA0',
    fondo: '#E9F0FC',
    label: 'Histórico',
  },
};
