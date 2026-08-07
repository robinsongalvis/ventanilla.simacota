import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AvisoPoliticaSubsanacion } from '@/app/interno/licencias/components/AvisoPoliticaSubsanacion';
import type { EventoTermino } from '@/lib/motor-expedientes/termino';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Módulo Licencias (Fase 2, Tarea 5) — cálculo dual del panel término.

   El aviso ⚖️ NUNCA elige una política de subsanación por su cuenta:
   llama a `calcularVencimiento` (lib real) dos veces sobre los MISMOS
   eventos, una vez por política, y muestra ambas fechas. Este test usa
   una serie de eventos con acta + respuesta de subsanación — el mismo
   caso que hace divergir REINICIO_A_CERO de SUSPENSION_REANUDACION — y
   verifica que las DOS fechas resultantes se rendericen, y que sean
   distintas entre sí (si fueran iguales, el test no probaría nada sobre
   el cálculo dual).
══════════════════════════════════════════════════════════════ */

function fecha(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

describe('Módulo Licencias — AvisoPoliticaSubsanacion (cálculo dual)', () => {
  it('renderiza las dos fechas (REINICIO_A_CERO y SUSPENSION_REANUDACION) y son distintas', () => {
    const eventos: EventoTermino[] = [
      { tipo: 'RADICACION_DEBIDA_FORMA', fecha: fecha(2026, 6, 1) },
      { tipo: 'ACTA_OBSERVACIONES', fecha: fecha(2026, 7, 1) },
      { tipo: 'RESPUESTA_SUBSANACION', fecha: fecha(2026, 7, 20) },
    ];

    render(<AvisoPoliticaSubsanacion eventos={eventos} plazoDias={45} />);

    // Las dos fechas calculadas por el motor real para este caso.
    expect(screen.getByText('23/09/2026')).toBeTruthy(); // REINICIO_A_CERO
    expect(screen.getByText('27/08/2026')).toBeTruthy(); // SUSPENSION_REANUDACION

    // Nunca declara una política ganadora — el texto deja ambas en condicional.
    expect(screen.getByText(/PENDIENTE DE JURÍDICA/i)).toBeTruthy();
    expect(screen.getByText(/REINICIO A CERO/i)).toBeTruthy();
    expect(screen.getByText(/SUSPENSIÓN/i)).toBeTruthy();
  });

  it('sin eventos de subsanación, las dos políticas coinciden (mismo cálculo, sin inventar una divergencia)', () => {
    const eventos: EventoTermino[] = [
      { tipo: 'RADICACION_DEBIDA_FORMA', fecha: fecha(2026, 8, 3) },
    ];

    render(<AvisoPoliticaSubsanacion eventos={eventos} plazoDias={45} />);

    const fechas = screen.getAllByText('07/10/2026');
    expect(fechas.length).toBe(2);
  });
});
