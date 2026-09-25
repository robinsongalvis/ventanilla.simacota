import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PanelVigenciaActo } from '@/app/interno/licencias/components/PanelVigenciaActo';
import type { VigenciaUI } from '@/app/interno/licencias/tipos-computos';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Bloque "Términos y vigencias protectores" (10-ago-2026) —
   `PanelVigenciaActo` consume `computos.vigencia` YA CALCULADO por el
   servidor (`calcularVencimientoVigencia`, `lib/motor-expedientes/
   vigencias.ts`). El caller (`DetalleLicenciaClient`) es quien decide NO
   renderizar este panel cuando `vigencia === undefined` (expediente sin
   `actoFinal.fechaFirmeza`) — este componente siempre recibe un
   `VigenciaUI` presente: éxito o error de selección de regla.
══════════════════════════════════════════════════════════════ */

describe('PanelVigenciaActo — vencimiento + regla aplicada', () => {
  it('caso exitoso PRORROGABLE: muestra el vencimiento y los meses de la regla + nota de prórroga', () => {
    const vigencia: VigenciaUI = {
      vencimiento: '2029-08-10T12:00:00.000Z',
      configAplicada: {
        figuras: ['CONSTRUCCION:obra-nueva'],
        meses: 36,
        prorroga: { meses: 12, unica: true, radicarDiasHabilesAntesMin: 30 },
      },
    };

    render(<PanelVigenciaActo vigencia={vigencia} />);

    expect(screen.getByText(/Vence el 10\/08\/2029/)).toBeTruthy();
    expect(screen.getByText(/36 meses desde la firmeza del acto/)).toBeTruthy();
    expect(screen.getByText(/Prorrogable una vez \(\+12 meses\)/)).toBeTruthy();
  });

  it('caso exitoso IMPRORROGABLE (p. ej. subdivisión): nunca sugiere una prórroga que la regla no admite', () => {
    const vigencia: VigenciaUI = {
      vencimiento: '2027-06-01T12:00:00.000Z',
      configAplicada: {
        figuras: ['SUBDIVISION_RURAL', 'SUBDIVISION_URBANA', 'RELOTEO', 'SANEAMIENTO'],
        meses: 12,
        improrrogable: true,
      },
    };

    render(<PanelVigenciaActo vigencia={vigencia} />);

    expect(screen.getByText(/No admite prórroga/)).toBeTruthy();
    expect(screen.queryByText(/Prorrogable/)).toBeNull();
  });

  it('error MODALIDAD_REQUERIDA: explicación honesta con el texto exacto del encargo, no un vacío mudo', () => {
    const vigencia: VigenciaUI = {
      codigo: 'MODALIDAD_REQUERIDA',
      mensaje: 'El régimen de vigencias de CONSTRUCCION distingue por modalidad; falta "modalidadConstruccion".',
    };

    render(<PanelVigenciaActo vigencia={vigencia} />);

    expect(
      screen.getByText('No se puede calcular la vigencia: falta la modalidad de construcción.'),
    ).toBeTruthy();
    // Nunca el vacío mudo: hay texto explicando el porqué.
    expect(screen.queryByText(/Vence el/)).toBeNull();
  });

  it('otro código de error (p. ej. FIGURA_SIN_REGLA): muestra el mensaje que ya trae el servidor, sin inventar uno nuevo', () => {
    const vigencia: VigenciaUI = {
      codigo: 'FIGURA_SIN_REGLA',
      mensaje: 'Ninguna regla de vigencia del régimen "D1783" cubre "ESPACIO_PUBLICO_X".',
    };

    render(<PanelVigenciaActo vigencia={vigencia} />);

    expect(screen.getByText(vigencia.mensaje)).toBeTruthy();
  });
});
