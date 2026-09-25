import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { BarraKpisOperativos } from '@/app/interno/dashboard/components/BarraKpisOperativos';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Fase 2 — tests de render y comportamiento.
══════════════════════════════════════════════════════════════ */

const KPIS_BASE = {
  hoy:            3,
  sinAsignar:     5,
  sinSellar:      12,
  correoFallido:  1,
  resueltosHoy:   2,
};

describe('Panel Op Fase 2 — BarraKpisOperativos', () => {
  /* 1 · Renderiza las 5 pastillas con sus conteos */
  it('renderiza las 5 pastillas con los conteos correctos', () => {
    render(
      <BarraKpisOperativos
        kpis={KPIS_BASE}
        filtroActivo="NINGUNO"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Estado operativo/i)).toBeTruthy();
    expect(screen.getByText('Hoy')).toBeTruthy();
    expect(screen.getByText('Sin asignar')).toBeTruthy();
    expect(screen.getByText('Sin sellar')).toBeTruthy();
    expect(screen.getByText('Correo fallido')).toBeTruthy();
    expect(screen.getByText('Resueltos hoy')).toBeTruthy();
    // Conteos
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  /* 2 · Clic en pastilla activa el filtro */
  it('clic en pastilla activa el filtro correspondiente', () => {
    const onChange = vi.fn();
    render(
      <BarraKpisOperativos
        kpis={KPIS_BASE}
        filtroActivo="NINGUNO"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /KPI operativo: Sin asignar/i }));
    expect(onChange).toHaveBeenCalledWith('SIN_ASIGNAR');
  });

  /* 3 · Segundo clic sobre la pastilla activa la desactiva (toggle) */
  it('clic en pastilla activa la desactiva (toggle → NINGUNO)', () => {
    const onChange = vi.fn();
    render(
      <BarraKpisOperativos
        kpis={KPIS_BASE}
        filtroActivo="SIN_ASIGNAR"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /KPI operativo: Sin asignar/i }));
    expect(onChange).toHaveBeenCalledWith('NINGUNO');
  });

  /* 4 · Pastilla con conteo 0 queda deshabilitada si no está activa */
  it('deshabilita las pastillas con conteo 0 (excepto la activa)', () => {
    const onChange = vi.fn();
    const kpisConCeros = { ...KPIS_BASE, correoFallido: 0, resueltosHoy: 0 };
    render(
      <BarraKpisOperativos
        kpis={kpisConCeros}
        filtroActivo="NINGUNO"
        onChange={onChange}
      />,
    );
    // Click en "Correo fallido" con valor 0 no debe disparar el handler
    // (botón disabled).
    fireEvent.click(screen.getByRole('button', { name: /KPI operativo: Correo fallido/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  /* 5 · Sprint tablero-jerarquia — jerarquía por severidad: pastilla en
     0 se atenúa (opacity ~0.55, borde gris) sin perder el resto de su
     comportamiento (test 4 ya cubre que sigue deshabilitada). */
  it('atenúa (opacity 0.55, borde gris) la pastilla con conteo 0', () => {
    const kpisConCeros = { ...KPIS_BASE, correoFallido: 0 };
    render(
      <BarraKpisOperativos
        kpis={kpisConCeros}
        filtroActivo="NINGUNO"
        onChange={vi.fn()}
      />,
    );
    const pastilla = screen.getByRole('button', { name: /KPI operativo: Correo fallido/i });
    expect(pastilla.style.opacity).toBe('0.55');
    // jsdom normaliza el hex a rgb() al leer style.borderColor.
    expect(pastilla.style.borderColor).toBe('rgb(217, 226, 217)');
  });

  /* 6 · Sprint tablero-jerarquia — banda única de estado: chipsExtra se
     intercala entre el rótulo y las pastillas operativas, fusionando
     la franja MIPG compacta con "Estado operativo" sin duplicar layout. */
  it('renderiza chipsExtra dentro de la misma banda "Estado operativo"', () => {
    render(
      <BarraKpisOperativos
        kpis={KPIS_BASE}
        filtroActivo="NINGUNO"
        onChange={vi.fn()}
        chipsExtra={<button type="button">Prioridad MIPG · 2</button>}
      />,
    );
    expect(screen.getByText(/Estado operativo/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Prioridad MIPG · 2' })).toBeTruthy();
  });
});
