import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PanelTerminoDual } from '@/app/interno/licencias/components/PanelTerminoDual';
import type { TerminoDualUI } from '@/app/interno/licencias/tipos-computos';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Bloque "Términos y vigencias protectores" (10-ago-2026) —
   `PanelTerminoDual` consume `computos.terminoDual` YA CALCULADO por el
   servidor (`calcularVencimientoDual`, `lib/motor-expedientes/termino.ts`).
   Reglas verificadas aquí:
    1. Se muestran SIEMPRE las dos fechas, con las etiquetas exactas del
       encargo ("Si el término se suspende y reanuda" / "Si el término
       reinicia").
    2. La alerta roja (`role="alert"`) va sobre `fechaAlertaConservadora`
       — la MÁS TEMPRANA de las dos, sin importar cuál de las dos políticas
       la produzca (se prueba en ambas direcciones).
    3. Ninguna fecha se presenta como "la correcta" — el texto queda en
       condicional ("Si...").
    4. Ambas `null` → estado vacío honesto (distinto para RECONSTRUIDO vs.
       REAL sin radicar aún).
══════════════════════════════════════════════════════════════ */

describe('PanelTerminoDual — doble fecha con alerta sobre la más temprana', () => {
  it('reinicio más temprano que suspensión: la alerta roja muestra la fecha de REINICIO', () => {
    const terminoDual: TerminoDualUI = {
      suspension: '2026-09-15T12:00:00.000Z',
      reinicio: '2026-08-20T12:00:00.000Z',
      fechaAlertaConservadora: '2026-08-20T12:00:00.000Z',
    };

    render(<PanelTerminoDual terminoDual={terminoDual} />);

    expect(screen.getByText(/Si el término se suspende y reanuda/i)).toBeTruthy();
    expect(screen.getByText(/Si el término reinicia/i)).toBeTruthy();
    expect(screen.getByText('15/09/2026')).toBeTruthy();

    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('20/08/2026');
    expect(alerta.textContent).not.toContain('15/09/2026');

    // Nunca declara una política "correcta" — el texto de contexto queda condicional.
    expect(screen.getByText(/pendiente de concepto/i)).toBeTruthy();
  });

  it('suspensión más temprana que reinicio: la alerta roja muestra la fecha de SUSPENSIÓN (nunca hardcodeada a un campo)', () => {
    const terminoDual: TerminoDualUI = {
      suspension: '2026-08-20T12:00:00.000Z',
      reinicio: '2026-09-15T12:00:00.000Z',
      fechaAlertaConservadora: '2026-08-20T12:00:00.000Z',
    };

    render(<PanelTerminoDual terminoDual={terminoDual} />);

    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('20/08/2026');
    expect(alerta.textContent).not.toContain('15/09/2026');
    expect(screen.getByText('15/09/2026')).toBeTruthy();
  });

  it('ambas null (sin radicación en debida forma, expediente REAL): estado vacío honesto, sin alerta', () => {
    const terminoDual: TerminoDualUI = { suspension: null, reinicio: null, fechaAlertaConservadora: null };

    render(<PanelTerminoDual terminoDual={terminoDual} origen="REAL" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Sin radicación en debida forma registrada todavía/i)).toBeTruthy();
  });

  it('ambas null (expediente histórico migrado): estado vacío honesto distinto, sin alerta', () => {
    const terminoDual: TerminoDualUI = { suspension: null, reinicio: null, fechaAlertaConservadora: null };

    render(<PanelTerminoDual terminoDual={terminoDual} origen="RECONSTRUIDO" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/histórico migrado/i)).toBeTruthy();
  });
});
