import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChipEstadoJuridico } from '@/app/interno/licencias/components/ChipEstadoJuridico';
import type { EstadoJuridicoLicencia } from '@/lib/motor-expedientes/estados-licencia';

afterEach(() => cleanup());

/* ══════════════════════════════════════════════════════════════
   Bloque "Integración UI y demo" — render de ChipEstadoJuridico.
   Los estados jurídicos (DF-5, `estados-licencia.ts`), uno por uno: cada
   uno debe mostrar su etiqueta en español y nunca la del vecino. El mapa
   es un `Record` exhaustivo por tipo, así que si `EstadoJuridicoLicencia`
   gana un estado nuevo TypeScript rechaza el build hasta declarar su
   etiqueta aquí también — así funcionó al añadir HISTORICO_SIN_RESOLVER
   (DF-10, 11-ago-2026): el compilador señaló este archivo.
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
  // DF-10 — no es un hito del ciclo, es la ausencia declarada de uno
  // (expedientes migrados del libro histórico cuyo desenlace no consta).
  HISTORICO_SIN_RESOLVER: 'Histórico sin resolver',
};

describe('Módulo Licencias — ChipEstadoJuridico', () => {
  const estados = Object.keys(ETIQUETA) as EstadoJuridicoLicencia[];

  it('cubre todos los estados jurídicos declarados en el tipo', () => {
    // 9 hitos del ciclo (DF-5) + HISTORICO_SIN_RESOLVER (DF-10, que no es
    // un hito sino la ausencia declarada de uno).
    expect(estados.length).toBe(10);
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
