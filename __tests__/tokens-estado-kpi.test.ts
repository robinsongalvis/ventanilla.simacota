import { describe, expect, it } from 'vitest';
import { tokensEstadoKpi } from '@/lib/kpis-mipg/tokens-estado-kpi';
import type { FiltroGrande } from '@/lib/kpis-mipg/radicado-mas-critico';

/* ══════════════════════════════════════════════════════════════
   Sprint 3B.2 — tokens de estado de las KPI cards grandes.

   El color comunica estado, no decora. Cada filtro tiene un trío
   coherente (riel fuerte, tinte claro, texto oscuro legible).
══════════════════════════════════════════════════════════════ */

describe('Sprint 3B.2 — tokensEstadoKpi', () => {
  /* 1 · cada estado tiene su color semántico */
  it('mapea cada filtro grande a su color de estado', () => {
    expect(tokensEstadoKpi('VENCIDAS').riel).toBe('#DC2626');   // rojo
    expect(tokensEstadoKpi('POR_VENCER').riel).toBe('#D97706'); // ámbar
    expect(tokensEstadoKpi('ASIGNADAS').riel).toBe('#1D4ED8');  // azul
    expect(tokensEstadoKpi('RADICADAS').riel).toBe('#475569');  // gris neutro
  });

  /* 2 · el chip label describe la urgencia */
  it('cada estado trae una etiqueta de chip legible', () => {
    expect(tokensEstadoKpi('VENCIDAS').chipLabel).toBe('crítico');
    expect(tokensEstadoKpi('POR_VENCER').chipLabel).toBe('atención');
    expect(tokensEstadoKpi('RADICADAS').chipLabel).toBe('pendiente');
    expect(tokensEstadoKpi('ASIGNADAS').chipLabel).toBe('en trámite');
  });

  /* 3 · el trío está completo para los 4 filtros (nada undefined) */
  it('devuelve un trío completo por filtro', () => {
    const filtros: FiltroGrande[] = ['VENCIDAS', 'POR_VENCER', 'RADICADAS', 'ASIGNADAS'];
    for (const f of filtros) {
      const t = tokensEstadoKpi(f);
      expect(t.riel).toBeTruthy();
      expect(t.texto).toBeTruthy();
      expect(t.tinte).toBeTruthy();
      expect(t.chipBg).toBeTruthy();
      expect(t.chipTexto).toBeTruthy();
    }
  });

  /* 4 · tinte y riel son distintos (el tinte es el fondo claro) */
  it('el tinte del panel es distinto del riel fuerte', () => {
    const t = tokensEstadoKpi('VENCIDAS');
    expect(t.tinte).not.toBe(t.riel);
  });
});
