import { describe, expect, it } from 'vitest';
import {
  resumirFiltrosActivos,
  hayFiltrosActivos,
  type EstadoFiltros,
} from '@/lib/filtros-activos/resumir-filtros-activos';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 3A — resumen de filtros activos.

   Reproduce el caso real que confundió a la funcionaria: "8 TODOS"
   pero "1 resultado" porque dos filtros secundarios estaban activos
   y apilados sin indicador visible.
══════════════════════════════════════════════════════════════ */

const SIN_FILTROS: EstadoFiltros = {
  filtroMIPG:           'TODOS',
  filtroOperativo:      'NINGUNO',
  tenantFiltro:         'TODOS',
  soloDatosIncompletos: false,
  soloMios:             false,
  busqueda:             '',
};

describe('Panel Op Nivel 3A — resumirFiltrosActivos', () => {
  /* 1 — estado limpio: sin chips, barra oculta */
  it('sin filtros activos devuelve lista vacía', () => {
    expect(resumirFiltrosActivos(SIN_FILTROS)).toEqual([]);
    expect(hayFiltrosActivos(SIN_FILTROS)).toBe(false);
  });

  /* 2 — el caso real de Laura: sin sellar + datos incompletos */
  it('reproduce el caso de la bandeja municipal con dos filtros apilados', () => {
    const chips = resumirFiltrosActivos({
      ...SIN_FILTROS,
      filtroOperativo:      'SIN_SELLAR',
      soloDatosIncompletos: true,
    });
    expect(chips).toEqual([
      { dimension: 'OPERATIVO', label: 'Sin sellar' },
      { dimension: 'DATOS_INCOMPLETOS', label: 'Datos incompletos' },
    ]);
    expect(hayFiltrosActivos({
      ...SIN_FILTROS,
      filtroOperativo: 'SIN_SELLAR',
      soloDatosIncompletos: true,
    })).toBe(true);
  });

  /* 3 — filtro MIPG (distinto de TODOS) */
  it('incluye el filtro MIPG cuando no es TODOS', () => {
    const chips = resumirFiltrosActivos({ ...SIN_FILTROS, filtroMIPG: 'VENCIDAS' });
    expect(chips).toEqual([{ dimension: 'MIPG', label: 'Vencidas' }]);
  });

  /* 4 — tenant específico usa el nombre humano */
  it('incluye el tenant con su nombre humano', () => {
    const chips = resumirFiltrosActivos({ ...SIN_FILTROS, tenantFiltro: 'SEC_GOBIERNO' });
    expect(chips).toHaveLength(1);
    expect(chips[0].dimension).toBe('TENANT');
    expect(chips[0].label).toMatch(/Gobierno/i);
  });

  /* 5 — búsqueda entrecomillada, con trim */
  it('incluye la búsqueda entrecomillada e ignora espacios en blanco', () => {
    expect(resumirFiltrosActivos({ ...SIN_FILTROS, busqueda: '  1-WEB-2026  ' }))
      .toEqual([{ dimension: 'BUSQUEDA', label: '"1-WEB-2026"' }]);
    // Solo espacios → no cuenta como filtro.
    expect(resumirFiltrosActivos({ ...SIN_FILTROS, busqueda: '   ' })).toEqual([]);
  });

  /* 6 — orden estable: MIPG → operativo → tenant → datos → míos → búsqueda */
  it('mantiene orden estable con todas las dimensiones activas', () => {
    const chips = resumirFiltrosActivos({
      filtroMIPG:           'POR_VENCER',
      filtroOperativo:      'SIN_ASIGNAR',
      tenantFiltro:         'SEC_PLANEACION',
      soloDatosIncompletos: true,
      soloMios:             true,
      busqueda:             'perez',
    });
    expect(chips.map((c) => c.dimension)).toEqual([
      'MIPG', 'OPERATIVO', 'TENANT', 'DATOS_INCOMPLETOS', 'SOLO_MIOS', 'BUSQUEDA',
    ]);
  });

  /* 7 — Sprint Cola personal: el chip "Solo los míos" */
  it('incluye el chip Solo los míos cuando está activo', () => {
    const chips = resumirFiltrosActivos({ ...SIN_FILTROS, soloMios: true });
    expect(chips).toEqual([{ dimension: 'SOLO_MIOS', label: 'Solo los míos' }]);
  });
});
