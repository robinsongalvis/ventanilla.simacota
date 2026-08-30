import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PanelTerminoDual } from '@/app/interno/licencias/components/PanelTerminoDual';
import type { TerminoUI } from '@/app/interno/licencias/tipos-computos';
import { FUNDAMENTO_SUSPENSION_REANUDACION } from '@/lib/motor-expedientes/termino';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   PanelTerminoDual — UNA fecha, con su artículo (ADR-0038)

   ── POR QUÉ SE REESCRIBIÓ UNA PRUEBA CUSTODIADA ──────────────────────────

   Este archivo custodiaba el DOBLE CÓMPUTO: las dos fechas «Si el término se
   suspende y reanuda» / «Si el término reinicia», y la alerta sobre la MÁS
   TEMPRANA de las dos. Existía porque el «hueco 1» del ADR-0029 declaraba que
   nadie sabía cuál lectura regía, y el sistema se protegía calculando ambas.

   Se reescribe NO porque un rediseño se topara con ella —esa regla sigue en
   pie y esa dirección sería siempre la equivocada— sino porque el ADR-0038
   RETIRÓ lo que probaba, con el artículo delante: el D.1077/2015 art.
   2.2.6.1.2.2.4 dice «se suspenderá». No había hueco.

   ── LO QUE SOBREVIVE, Y SIGUE CUSTODIADO ─────────────────────────────────

   1. La alerta va sobre la fecha OPERATIVA, con `role="alert"`.
   2. El estado vacío es HONESTO y distingue el histórico migrado del real que
      todavía no ha radicado.
   3. Y lo nuevo que el ADR exige: la pantalla CITA EL ARTÍCULO en vez de
      explicar una incertidumbre que ya no existe.

   ── ALCANCE (ADR-0033 §4.6-bis) ──────────────────────────────────────────
   QUÉ MIRA: qué fecha se destaca, que la alerta exista, el estado vacío, y que
   el fundamento se muestre.
   QUÉ NO MIRA: el cálculo en sí —es de `calcularVencimientoTermino`— ni la
   maquetación.
══════════════════════════════════════════════════════════════ */

const VENCE = '2026-11-03T12:00:00.000Z';

const termino = (over: Partial<TerminoUI> = {}): TerminoUI => ({
  fechaAlertaConservadora: VENCE,
  fundamento: FUNDAMENTO_SUSPENSION_REANUDACION,
  ...over,
});

describe('la alerta va sobre la fecha operativa', () => {
  it('la muestra, y con `role="alert"`', () => {
    render(<PanelTerminoDual terminoDual={termino()} />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('03/11/2026');
  });

  it('ya NO ofrece dos fechas: no hay dos lecturas que elegir', () => {
    render(<PanelTerminoDual terminoDual={termino()} />);
    expect(screen.queryByText(/Si el término se suspende y reanuda/i)).toBeNull();
    expect(screen.queryByText(/Si el término reinicia/i)).toBeNull();
  });
});

describe('la pantalla CITA el artículo, no explica una duda', () => {
  it('muestra el fundamento que devuelve el motor', () => {
    render(<PanelTerminoDual terminoDual={termino()} />);
    expect(screen.getByText(/2\.2\.6\.1\.2\.2\.4/)).toBeTruthy();
  });

  it('y dice en español que se reanuda donde se detuvo', () => {
    render(<PanelTerminoDual terminoDual={termino()} />);
    expect(screen.getByText(/no vuelve a empezar/i)).toBeTruthy();
  });

  it('ya NO dice que la interpretación esté pendiente de concepto', () => {
    /* Era cierto hasta el 30-ago-2026 y dejó de serlo al leer el artículo. Una
       pantalla que sigue declarando una duda resuelta desinforma. */
    render(<PanelTerminoDual terminoDual={termino()} />);
    expect(screen.queryByText(/pendiente de concepto/i)).toBeNull();
  });
});

describe('el estado vacío sigue siendo honesto', () => {
  it('expediente REAL sin radicar: dice que el plazo no ha empezado, sin alerta', () => {
    render(<PanelTerminoDual terminoDual={termino({ fechaAlertaConservadora: null })} origen="REAL" />);
    expect(screen.getByText('El plazo aún no ha empezado a correr')).toBeTruthy();
    expect(screen.getByText(/Sin radicación en debida forma registrada todavía/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('histórico migrado: otro texto, porque es otra situación (R9)', () => {
    render(<PanelTerminoDual terminoDual={termino({ fechaAlertaConservadora: null })} origen="RECONSTRUIDO" />);
    expect(screen.getByText(/Expediente histórico migrado/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
