/**
 * Control ejecutable R9 (ADR-0012, Ola 2) — anti-inferencia en los
 * filtros rápidos de cliente (mostrador de Ventanilla, buscador del
 * Tablero).
 *
 * El servidor ya excluye la identidad reservada de la búsqueda
 * (`lib/busqueda/filtros-radicado.ts`); este test cubre la brecha que
 * vivía en los filtros rápidos de cliente: matcheaban nombre/documento
 * del solicitante sin ninguna guarda, permitiendo inferir la existencia
 * de un radicado reservado tecleando su identidad (Ley 1581/2012 art. 4
 * f/g). Falla si el filtro vuelve a matchear identidad reservada.
 */
import { describe, expect, it } from 'vitest';
import {
  coincideIdentidadFiltroRapido,
  type RadicadoParaFiltroRapido,
} from '@/lib/busqueda/coincidencia-filtro-rapido';

const NO_RESERVADO: RadicadoParaFiltroRapido = {
  radicadoId: '1-110-2026-00000123',
  esAnonimo: false,
  identidadReservada: false,
  tipoPresentacion: 'IDENTIFICADA',
  solicitante: {
    nombreCompleto: 'María Pérez',
    numeroDocumento: '1101321226',
  },
};

const RESERVADO: RadicadoParaFiltroRapido = {
  radicadoId: '1-110-2026-00000456',
  esAnonimo: false,
  identidadReservada: true,
  tipoPresentacion: 'RESERVADA',
  solicitante: {
    nombreCompleto: 'Juan Gómez',
    numeroDocumento: '99887766',
  },
};

describe('coincideIdentidadFiltroRapido — R9 (ADR-0012)', () => {
  it('reservado: NO coincide por nombre del solicitante', () => {
    expect(coincideIdentidadFiltroRapido(RESERVADO, 'juan gómez')).toBe(false);
  });

  it('reservado: NO coincide por fragmento de nombre', () => {
    expect(coincideIdentidadFiltroRapido(RESERVADO, 'gómez')).toBe(false);
  });

  it('reservado: NO coincide por número de documento', () => {
    expect(coincideIdentidadFiltroRapido(RESERVADO, '99887766')).toBe(false);
  });

  it('reservado: SÍ coincide por radicadoId completo', () => {
    expect(coincideIdentidadFiltroRapido(RESERVADO, '1-110-2026-00000456')).toBe(true);
  });

  it('reservado: SÍ coincide por fragmento de radicadoId', () => {
    expect(coincideIdentidadFiltroRapido(RESERVADO, '00000456')).toBe(true);
  });

  it('no reservado: coincide por nombre del solicitante', () => {
    expect(coincideIdentidadFiltroRapido(NO_RESERVADO, 'maría pérez')).toBe(true);
  });

  it('no reservado: coincide por fragmento de nombre', () => {
    expect(coincideIdentidadFiltroRapido(NO_RESERVADO, 'pérez')).toBe(true);
  });

  it('no reservado: coincide por número de documento', () => {
    expect(coincideIdentidadFiltroRapido(NO_RESERVADO, '1101321226')).toBe(true);
  });

  it('no reservado: coincide por radicadoId', () => {
    expect(coincideIdentidadFiltroRapido(NO_RESERVADO, '00000123')).toBe(true);
  });

  it('ningún campo coincide: no matchea (ni reservado ni no reservado)', () => {
    expect(coincideIdentidadFiltroRapido(NO_RESERVADO, 'texto-inexistente')).toBe(false);
    expect(coincideIdentidadFiltroRapido(RESERVADO, 'texto-inexistente')).toBe(false);
  });

  it('anónimo (esAnonimo sin identidadReservada explícita): tampoco coincide por identidad', () => {
    const anonimo: RadicadoParaFiltroRapido = {
      radicadoId: '1-110-2026-00000789',
      esAnonimo: true,
      solicitante: { nombreCompleto: 'Anónimo', numeroDocumento: '' },
    };
    expect(coincideIdentidadFiltroRapido(anonimo, 'anónimo')).toBe(false);
    expect(coincideIdentidadFiltroRapido(anonimo, '00000789')).toBe(true);
  });
});
