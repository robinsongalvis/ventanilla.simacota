import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { TarjetaMIPGGrande } from '@/app/interno/dashboard/components/TarjetaMIPGGrande';
import type { RadicadoCritico } from '@/lib/kpis-mipg/radicado-mas-critico';
import { tokensEstadoKpi } from '@/lib/kpis-mipg/tokens-estado-kpi';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Panel Operativo — render de la tarjeta grande (rediseño 3B.2).
══════════════════════════════════════════════════════════════ */

const CRITICO: RadicadoCritico = {
  radicadoId:     '1-OFICIO-2026-00000018',
  oficinaDestino: 'SEC_PLANEACION',
  razon:          'venció hace 3 d',
  diasRestantes:  -3,
};

function props(overrides = {}) {
  return {
    label:        'Vencidas',
    valor:        4,
    icono:        null,
    tokens:       tokensEstadoKpi('VENCIDAS'),
    criticoLabel: 'Más crítico',
    activo:       false,
    critico:      CRITICO,
    onFiltrar:    vi.fn(),
    onAbrirRadicado: vi.fn(),
    ...overrides,
  };
}

describe('Panel Op Nivel 3B — TarjetaMIPGGrande', () => {
  /* 1 · muestra etiqueta, número y radicado crítico */
  it('muestra label, valor y el radicado crítico con su razón', () => {
    render(<TarjetaMIPGGrande {...props()} />);
    expect(screen.getByText('Vencidas')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('1-OFICIO-2026-00000018')).toBeTruthy();
    expect(screen.getByText(/venció hace 3 d/i)).toBeTruthy();
    expect(screen.getByText(/Planeación/i)).toBeTruthy();
  });

  /* 2 · clic en la zona superior filtra */
  it('clic en la tarjeta llama onFiltrar', () => {
    const onFiltrar = vi.fn();
    render(<TarjetaMIPGGrande {...props({ onFiltrar })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtrar bandeja por Vencidas/i }));
    expect(onFiltrar).toHaveBeenCalledOnce();
  });

  /* 3 · clic en el radicado destacado abre su detalle */
  it('clic en el radicado crítico llama onAbrirRadicado con su id', () => {
    const onAbrir = vi.fn();
    render(<TarjetaMIPGGrande {...props({ onAbrirRadicado: onAbrir })} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir radicado 1-OFICIO-2026-00000018/i }));
    expect(onAbrir).toHaveBeenCalledWith('1-OFICIO-2026-00000018');
  });

  /* 4 · grupo vacío muestra "Sin radicados" y no rompe */
  it('sin radicado crítico muestra un placeholder', () => {
    render(<TarjetaMIPGGrande {...props({ critico: null, valor: 0 })} />);
    expect(screen.getByText(/Sin radicados/i)).toBeTruthy();
  });

  /* 5 · nunca muestra el nombre del solicitante (no viene en las props) */
  it('el critico solo aporta id, dependencia y razón — sin nombre', () => {
    render(<TarjetaMIPGGrande {...props()} />);
    // El componente no recibe ni renderiza nombre del solicitante.
    expect(screen.queryByText(/NOMBRE/i)).toBeNull();
  });

  /* 6 · Sprint tablero-jerarquia — jerarquía por severidad */
  describe('jerarquía por severidad', () => {
    /* Vencidas > 0 → dominante: riel/borde más grueso y número más grande. */
    it('Vencidas > 0 con dominante=true gana peso visual (riel y número más grandes)', () => {
      render(<TarjetaMIPGGrande {...props({ label: 'Vencidas', valor: 4, dominante: true })} />);
      const boton = screen.getByRole('button', { name: /Filtrar bandeja por Vencidas/i });
      const tarjeta = boton.parentElement as HTMLElement;
      expect(tarjeta.style.borderTopWidth).toBe('5px');
      const numero = screen.getByText('4');
      expect(numero.style.fontSize).toBe('44px');
    });

    /* Card en 0 → atenuada: opacity ~0.55, sigue visible y clicable. */
    it('valor 0 con atenuada=true se atenúa (opacity 0.55) pero sigue clicable', () => {
      const onFiltrar = vi.fn();
      render(<TarjetaMIPGGrande {...props({
        label: 'Radicadas', valor: 0, critico: null, atenuada: true, onFiltrar,
      })} />);
      const boton = screen.getByRole('button', { name: /Filtrar bandeja por Radicadas/i });
      const tarjeta = boton.parentElement as HTMLElement;
      expect(tarjeta.style.opacity).toBe('0.55');
      // Sigue visible y clicable — nunca se deshabilita.
      expect((boton as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(boton);
      expect(onFiltrar).toHaveBeenCalledOnce();
    });

    /* Sin dominante/atenuada explícitos (comportamiento por defecto,
       tests 1-5 arriba) — no rompe el render existente. */
    it('sin dominante ni atenuada, mantiene el tamaño y opacidad estándar', () => {
      render(<TarjetaMIPGGrande {...props()} />);
      const boton = screen.getByRole('button', { name: /Filtrar bandeja por Vencidas/i });
      const tarjeta = boton.parentElement as HTMLElement;
      expect(tarjeta.style.borderTopWidth).toBe('3px');
      expect(tarjeta.style.opacity).toBe('1');
    });
  });
});
