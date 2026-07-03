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
});
