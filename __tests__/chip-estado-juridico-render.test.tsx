import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChipEstadoJuridico } from '@/app/interno/licencias/components/ChipEstadoJuridico';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Bloque "Integración UI y demo" — render de ChipEstadoJuridico.
   Los 9 estados jurídicos del ciclo (DF-5, `estados-licencia.ts`), uno por
   uno: cada uno debe mostrar su etiqueta en español y nunca la del vecino.
   Cubre los 9/9 — si `EstadoJuridicoLicencia` gana un estado nuevo, este
   mapa (`Record` exhaustivo por tipo) obliga a TypeScript a rechazar el
   build hasta declarar su etiqueta aquí también.
══════════════════════════════════════════════════════════════ */

const ETIQUETA: Record<EstadoJuridicoLicencia, string> = {
  RADICADA_EN_DEBIDA_FORMA: 'Radicada en debida forma',
  EN_REVISION: 'En revisión',
  CON_ACTA_DE_OBSERVACIONES: 'Con acta de observaciones',
  EN_VIABILIDAD: 'En viabilidad',
  CONCEDIDA: 'Concedida',
  NEGADA: 'Negada',
  DESISTIDA: 'Desistida',
  NOTIFICADA: 'Notificada',
  EN_FIRME: 'En firme',
};

describe('Módulo Licencias — ChipEstadoJuridico', () => {
  const estados = Object.keys(ETIQUETA) as EstadoJuridicoLicencia[];

  it('cubre los 9 estados jurídicos del ciclo (DF-5)', () => {
    expect(estados.length).toBe(9);
  });

  estados.forEach((estado) => {
    it(`muestra la etiqueta correcta para ${estado}`, () => {
      render(<ChipEstadoJuridico estado={estado} />);
      expect(screen.getByText(ETIQUETA[estado])).toBeTruthy();
    });
  });

  it('CONCEDIDA y NEGADA nunca se confunden visualmente (resultados opuestos)', () => {
    render(<ChipEstadoJuridico estado="NEGADA" />);
    expect(screen.queryByText('Concedida')).toBeNull();
    expect(screen.getByText('Negada')).toBeTruthy();
  });
});
