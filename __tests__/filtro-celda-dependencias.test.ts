import { describe, expect, it } from 'vitest';
import { filtroMipgParaCelda } from '@/app/interno/dashboard/components/dependencias/filtro-celda';

/* ══════════════════════════════════════════════════════════════
   Panel Operativo Nivel 2 — mapping celda de la matriz → FiltroMIPG.

   El contrato clave: el número que muestra el chip debe coincidir
   exactamente con las filas que la bandeja muestra al hacer clic.
   Eso exige que cada celda mapee al filtro MIPG cuyo criterio es
   idéntico al del contador en useCargaDependencias:

   - pendientes cuenta estadoActual === 'PENDIENTE'
     → RADICADAS filtra estadoActual === 'PENDIENTE'.
   - enProceso cuenta ASIGNADO | EN_REVISION | EN_PROCESO
     → ASIGNADAS filtra los mismos tres estados.
   - porVencer cuenta activo con 0–2 días hábiles
     → POR_VENCER filtra activo con 0–2 días hábiles.
   - vencidos cuenta activo con días < 0
     → VENCIDAS filtra activo con días < 0.
══════════════════════════════════════════════════════════════ */

describe('Panel Op Nivel 2 — filtroMipgParaCelda', () => {
  /* 1 */
  it('pendientes → RADICADAS', () => {
    expect(filtroMipgParaCelda('pendientes')).toBe('RADICADAS');
  });

  /* 2 */
  it('enProceso → ASIGNADAS', () => {
    expect(filtroMipgParaCelda('enProceso')).toBe('ASIGNADAS');
  });

  /* 3 */
  it('porVencer → POR_VENCER', () => {
    expect(filtroMipgParaCelda('porVencer')).toBe('POR_VENCER');
  });

  /* 4 */
  it('vencidos → VENCIDAS', () => {
    expect(filtroMipgParaCelda('vencidos')).toBe('VENCIDAS');
  });
});
