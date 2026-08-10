import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PanelDesistimientoSemicontrolado } from '@/app/interno/licencias/components/PanelDesistimientoSemicontrolado';
import type { EvaluacionPlazoSubsanacion, BorradorActoDesistimiento } from '@/app/interno/licencias/tipos-computos';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Bloque "Términos y vigencias protectores" (10-ago-2026) — desistimiento
   SEMICONTROLADO. `PanelDesistimientoSemicontrolado` consume
   `computos.plazoSubsanacion` (`evaluarPlazoSubsanacion`) y
   `borradorActoDesistimiento` (`generarBorradorActoDesistimiento`), ambos
   YA CALCULADOS por el servidor.

   Principio 9 (el sistema sugiere, el funcionario decide) aplica con más
   fuerza aquí: se verifica que el copy diga EXPLÍCITAMENTE que el sistema
   NO archivó nada y que hace falta la FIRMA del funcionario, y que NO
   exista ningún botón que sugiera archivar automáticamente.
══════════════════════════════════════════════════════════════ */

const BORRADOR: BorradorActoDesistimiento = {
  titulo: 'Proyecto de acto de desistimiento tácito — expediente DEMO-26-abc12345',
  cuerpo: 'PROYECTO DE ACTO ADMINISTRATIVO — DESISTIMIENTO TÁCITO DE LA SOLICITUD\n\nExpediente No. DEMO-26-abc12345',
};

describe('PanelDesistimientoSemicontrolado — NO_APLICA', () => {
  it('no renderiza nada', () => {
    const plazoSubsanacion: EvaluacionPlazoSubsanacion = { resultado: 'NO_APLICA' };
    const { container } = render(
      <PanelDesistimientoSemicontrolado plazoSubsanacion={plazoSubsanacion} borrador={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('PanelDesistimientoSemicontrolado — EN_PLAZO (discreto, sin alarma)', () => {
  it('muestra los días hábiles restantes sin role="alert" ni badge de "Por archivar"', () => {
    const plazoSubsanacion: EvaluacionPlazoSubsanacion = {
      resultado: 'EN_PLAZO',
      fechaVencimientoPlazo: '2026-09-10T12:00:00.000Z',
      diasHabilesRestantes: 12,
    };

    render(<PanelDesistimientoSemicontrolado plazoSubsanacion={plazoSubsanacion} borrador={null} />);

    expect(screen.getByText(/quedan 12 días hábiles/i)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Por archivar/i)).toBeNull();
  });
});

describe('PanelDesistimientoSemicontrolado — POR_ARCHIVAR (badge + borrador + copy de firma)', () => {
  it('muestra el badge, el borrador completo y el copy obligatorio de que nada ocurre hasta la firma', () => {
    const plazoSubsanacion: EvaluacionPlazoSubsanacion = {
      resultado: 'POR_ARCHIVAR',
      fechaVencimientoPlazo: '2026-07-01T12:00:00.000Z',
      diasHabilesRestantes: -6,
    };

    render(<PanelDesistimientoSemicontrolado plazoSubsanacion={plazoSubsanacion} borrador={BORRADOR} />);

    const alerta = screen.getByRole('alert');
    expect(alerta).toBeTruthy();

    expect(screen.getByText('Por archivar')).toBeTruthy();
    expect(screen.getByText(/hace 6 días hábiles/i)).toBeTruthy();

    // Copy NO NEGOCIABLE: el sistema no archivó nada, es un proyecto, requiere firma.
    expect(screen.getByText(/El sistema NO archivó nada/i)).toBeTruthy();
    expect(screen.getByText(/Lo que sigue es un PROYECTO de acto administrativo/i)).toBeTruthy();
    expect(screen.getByText(/firmarlo/i)).toBeTruthy();
    expect(screen.getByText(/Nada ocurre hasta su firma/i)).toBeTruthy();

    // El borrador se ve completo (título + cuerpo), para leer/copiar/imprimir.
    expect(screen.getByText(BORRADOR.titulo)).toBeTruthy();
    expect(screen.getByText(/DESISTIMIENTO TÁCITO DE LA SOLICITUD/)).toBeTruthy();

    // Acciones permitidas: copiar e imprimir. NUNCA un botón de archivar.
    expect(screen.getByRole('button', { name: /copiar texto/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /imprimir/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /archivar/i })).toBeNull();
  });

  it('sin borrador (defensivo): sigue mostrando el badge y el copy, sin reventar por borrador=null', () => {
    const plazoSubsanacion: EvaluacionPlazoSubsanacion = {
      resultado: 'POR_ARCHIVAR',
      fechaVencimientoPlazo: '2026-07-01T12:00:00.000Z',
      diasHabilesRestantes: -3,
    };

    render(<PanelDesistimientoSemicontrolado plazoSubsanacion={plazoSubsanacion} borrador={null} />);

    expect(screen.getByText('Por archivar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /copiar texto/i })).toBeNull();
  });
});
