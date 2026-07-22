/**
 * Pieza angular (P2.1, Fase 2) — kill-switch de la radicación interna a
 * servidor DEBE nacer en OFF (blueprint §Kill-switch de 1 línea): el
 * endpoint nuevo EXISTE pero la producción no cambia de comportamiento
 * hasta que dev-frontend conmute el caller en Fase 3 (paso 3 de la
 * migración) y el propietario dé el punto de control (PdC 2).
 *
 * Esta prueba es el guardarraíl automatizado: si alguien flipea el flag a
 * `true` sin pasar por Fase 3 (revisión cruzada + PdC 2), este test lo
 * detecta en rojo. Se complementa con la evidencia de que el caller del
 * cliente (`app/interno/dashboard/page.tsx`) sigue invocando la *action*
 * legada `radicarInstitucionalmente` — no el endpoint nuevo — confirmada
 * por inspección (`grep`) en el informe de esta fase.
 */
import { describe, it, expect } from 'vitest';
import { USA_RADICACION_INTERNA_SERVER } from '@/lib/recepcion/radicacion-interna-flag';

describe('kill-switch de radicación interna a servidor', () => {
  it('nace en OFF — la producción no cambia de comportamiento en Fase 2', () => {
    expect(USA_RADICACION_INTERNA_SERVER).toBe(false);
  });
});
