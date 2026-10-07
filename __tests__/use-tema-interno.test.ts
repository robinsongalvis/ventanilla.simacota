import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEMA_STORAGE_KEY = 'ventanilla:tema-interno';

/** Módulo recién cargado: el respaldo en memoria no arrastra estado entre tests. */
async function cargarHook() {
  vi.resetModules();
  return (await import('@/lib/hooks/useTemaInterno')).useTemaInterno;
}

/** Simula `prefers-color-scheme` del sistema operativo. */
function sistemaPrefiereOscuro(oscuro: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('dark') ? oscuro : false,
    media: consulta,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('useTemaInterno — preferencia de tema del Tablero (ADR-0043)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('sin preferencia guardada sigue al sistema operativo', async () => {
    const useTemaInterno = await cargarHook();
    sistemaPrefiereOscuro(true);
    expect(renderHook(() => useTemaInterno()).result.current.tema).toBe('oscuro');

    sistemaPrefiereOscuro(false);
    expect(renderHook(() => useTemaInterno()).result.current.tema).toBe('claro');
  });

  it('la preferencia guardada manda sobre la del sistema', async () => {
    const useTemaInterno = await cargarHook();
    sistemaPrefiereOscuro(true);
    window.localStorage.setItem(TEMA_STORAGE_KEY, 'claro');
    expect(renderHook(() => useTemaInterno()).result.current.tema).toBe('claro');
  });

  it('alternar cambia el tema al instante y lo persiste para la próxima visita', async () => {
    const useTemaInterno = await cargarHook();
    sistemaPrefiereOscuro(false);
    const { result } = renderHook(() => useTemaInterno());
    expect(result.current.tema).toBe('claro');

    act(() => result.current.alternarTema());
    expect(result.current.tema).toBe('oscuro');
    expect(window.localStorage.getItem(TEMA_STORAGE_KEY)).toBe('oscuro');

    // "Volver a entrar": un montaje nuevo conserva el último modo elegido.
    expect(renderHook(() => useTemaInterno()).result.current.tema).toBe('oscuro');

    act(() => result.current.alternarTema());
    expect(result.current.tema).toBe('claro');
    expect(window.localStorage.getItem(TEMA_STORAGE_KEY)).toBe('claro');
  });

  it('ignora valores guardados que no son un tema válido', async () => {
    const useTemaInterno = await cargarHook();
    sistemaPrefiereOscuro(true);
    window.localStorage.setItem(TEMA_STORAGE_KEY, 'azul');
    expect(renderHook(() => useTemaInterno()).result.current.tema).toBe('oscuro');
  });
});
