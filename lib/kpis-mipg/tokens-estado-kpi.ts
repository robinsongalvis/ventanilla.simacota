import type { FiltroGrande } from '@/lib/kpis-mipg/radicado-mas-critico';

/**
 * Sprint 3B.2 — paleta por estado para las tarjetas KPI grandes.
 *
 * El color se usa SOLO para comunicar estado (rojo=vencido,
 * ámbar=por vencer, azul=asignado, gris=pendiente), nunca como
 * decoración. Centralizar el trío de color aquí evita dispersar hex por
 * el JSX y garantiza que riel, tinte y texto de cada estado sean
 * consistentes en toda la vista.
 *
 * Función pura: sin React, sin store.
 */

export interface TokensEstadoKpi {
  /** Riel superior de la tarjeta (color fuerte del estado). */
  riel:       string;
  /** Texto de la etiqueta y la razón de urgencia (tono oscuro legible). */
  texto:      string;
  /** Fondo del panel del radicado crítico (tinte muy claro). */
  tinte:      string;
  /** Fondo del chip de estado. */
  chipBg:     string;
  /** Texto del chip de estado. */
  chipTexto:  string;
  /** Etiqueta del chip ("crítico", "atención", ...). */
  chipLabel:  string;
}

const TOKENS: Record<FiltroGrande, TokensEstadoKpi> = {
  VENCIDAS: {
    riel:      '#DC2626',
    texto:     '#A32D2D',
    tinte:     '#FDF3F3',
    chipBg:    '#FCEBEB',
    chipTexto: '#911111',
    chipLabel: 'crítico',
  },
  POR_VENCER: {
    riel:      '#D97706',
    texto:     '#854F0B',
    tinte:     '#FCF6EB',
    chipBg:    '#FAEEDA',
    chipTexto: '#7A4F0A',
    chipLabel: 'atención',
  },
  RADICADAS: {
    riel:      '#475569',
    texto:     '#3A4551',
    tinte:     '#F7FAF7',
    chipBg:    '#EEF2F5',
    chipTexto: '#3A4551',
    chipLabel: 'pendiente',
  },
  ASIGNADAS: {
    riel:      '#1D4ED8',
    texto:     '#185FA5',
    tinte:     '#F1F6FB',
    chipBg:    '#E6F1FB',
    chipTexto: '#185FA5',
    chipLabel: 'en trámite',
  },
};

export function tokensEstadoKpi(filtro: FiltroGrande): TokensEstadoKpi {
  return TOKENS[filtro];
}
