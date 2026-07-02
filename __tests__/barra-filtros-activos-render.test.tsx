import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { BarraFiltrosActivos } from '@/app/interno/dashboard/components/BarraFiltrosActivos';
import type { EstadoFiltros } from '@/lib/filtros-activos/resumir-filtros-activos';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 3A — render de la barra de filtros activos.
══════════════════════════════════════════════════════════════ */

const SIN_FILTROS: EstadoFiltros = {
  filtroMIPG:           'TODOS',
  filtroOperativo:      'NINGUNO',
  tenantFiltro:         'TODOS',
  soloDatosIncompletos: false,
  busqueda:             '',
};

describe('Panel Op Nivel 3A — BarraFiltrosActivos', () => {
  /* 1 — no renderiza nada sin filtros */
  it('no renderiza nada cuando no hay filtros activos', () => {
    const { container } = render(
      <BarraFiltrosActivos
        estado={SIN_FILTROS}
        onQuitarDimension={vi.fn()}
        onLimpiarTodo={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  /* 2 — muestra los chips del caso real de la funcionaria */
  it('muestra "Filtrando por" con los chips activos', () => {
    render(
      <BarraFiltrosActivos
        estado={{ ...SIN_FILTROS, filtroOperativo: 'SIN_SELLAR', soloDatosIncompletos: true }}
        onQuitarDimension={vi.fn()}
        onLimpiarTodo={vi.fn()}
      />,
    );
    expect(screen.getByText(/Filtrando por/i)).toBeTruthy();
    expect(screen.getByText('Sin sellar')).toBeTruthy();
    expect(screen.getByText('Datos incompletos')).toBeTruthy();
  });

  /* 3 — la "×" de un chip quita esa dimensión */
  it('la × de un chip llama onQuitarDimension con la dimensión correcta', () => {
    const onQuitar = vi.fn();
    render(
      <BarraFiltrosActivos
        estado={{ ...SIN_FILTROS, filtroOperativo: 'SIN_SELLAR' }}
        onQuitarDimension={onQuitar}
        onLimpiarTodo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Quitar filtro Sin sellar/i }));
    expect(onQuitar).toHaveBeenCalledWith('OPERATIVO');
  });

  /* 4 — "Limpiar todo" dispara el reset global */
  it('"Limpiar todo" llama onLimpiarTodo', () => {
    const onLimpiar = vi.fn();
    render(
      <BarraFiltrosActivos
        estado={{ ...SIN_FILTROS, filtroMIPG: 'VENCIDAS', soloDatosIncompletos: true }}
        onQuitarDimension={vi.fn()}
        onLimpiarTodo={onLimpiar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Limpiar todo/i }));
    expect(onLimpiar).toHaveBeenCalledOnce();
  });
});
