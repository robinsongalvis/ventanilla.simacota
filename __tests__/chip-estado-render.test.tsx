import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChipEstado } from '@/app/interno/licencias/components/ChipEstado';
import type { EstadoLicenciaUI } from '@/app/interno/licencias/tipos';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Módulo Licencias (Fase 2, Tarea 5) — render de ChipEstado.
   Los 6 estados del semáforo, uno por uno: cada uno debe mostrar su
   etiqueta en español y nunca la del vecino.
══════════════════════════════════════════════════════════════ */

const ETIQUETA: Record<EstadoLicenciaUI, string> = {
  EN_TERMINO: 'En término',
  POR_VENCER: 'Por vencer',
  VENCIDO: 'Vencido',
  ASIGNADO: 'Asignado',
  TERMINADO: 'Terminado',
  HISTORICO: 'Histórico',
};

describe('Módulo Licencias — ChipEstado', () => {
  (Object.keys(ETIQUETA) as EstadoLicenciaUI[]).forEach((estado) => {
    it(`muestra la etiqueta correcta para ${estado}`, () => {
      render(<ChipEstado estado={estado} />);
      expect(screen.getByText(ETIQUETA[estado])).toBeTruthy();
    });
  });

  it('HISTÓRICO nunca se confunde visualmente con VENCIDO (regla: histórico no entra al semáforo)', () => {
    render(<ChipEstado estado="HISTORICO" />);
    expect(screen.queryByText('Vencido')).toBeNull();
    expect(screen.getByText('Histórico')).toBeTruthy();
  });
});
