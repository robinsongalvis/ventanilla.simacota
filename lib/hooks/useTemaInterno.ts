'use client';

import { useCallback, useSyncExternalStore } from 'react';

/* ══════════════════════════════════════════════════════════════
   Preferencia de UI: tema claro / oscuro del panel interno (ADR-0043).

   - Si el funcionario eligió un tema, se respeta (localStorage).
   - Si nunca eligió, se sigue la preferencia del sistema operativo
     (`prefers-color-scheme`) y se reacciona si esta cambia.

   Se lee con `useSyncExternalStore` y no con un `useEffect` posterior al
   montaje: así el primer render en el cliente ya pinta el tema correcto,
   sin destello claro → oscuro. No afecta lógica de negocio.
══════════════════════════════════════════════════════════════ */

export type TemaInterno = 'claro' | 'oscuro';

export const TEMA_STORAGE_KEY = 'ventanilla:tema-interno';
const EVENTO_CAMBIO = 'ventanilla:tema-interno-cambio';
const CONSULTA_SISTEMA = '(prefers-color-scheme: dark)';

/** Respaldo cuando localStorage no está disponible: el cambio dura mientras viva la pestaña. */
let temaEnMemoria: TemaInterno | null = null;

function leerGuardado(): TemaInterno | null {
  try {
    const v = window.localStorage.getItem(TEMA_STORAGE_KEY);
    return v === 'claro' || v === 'oscuro' ? v : null;
  } catch {
    return null;
  }
}

function leerSistema(): TemaInterno {
  try {
    return window.matchMedia(CONSULTA_SISTEMA).matches ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

/** Tema efectivo en el cliente: preferencia guardada o, en su defecto, la del sistema. */
export function leerTemaInterno(): TemaInterno {
  return leerGuardado() ?? temaEnMemoria ?? leerSistema();
}

function suscribir(avisar: () => void): () => void {
  let consulta: MediaQueryList | null = null;
  try { consulta = window.matchMedia(CONSULTA_SISTEMA); } catch { /* sin matchMedia */ }
  consulta?.addEventListener('change', avisar);
  // `storage` sincroniza otras pestañas; el evento propio, esta misma.
  window.addEventListener('storage', avisar);
  window.addEventListener(EVENTO_CAMBIO, avisar);
  return () => {
    consulta?.removeEventListener('change', avisar);
    window.removeEventListener('storage', avisar);
    window.removeEventListener(EVENTO_CAMBIO, avisar);
  };
}

/** En el servidor no hay preferencia: el HTML inicial es el tema claro. */
const temaServidor = (): TemaInterno => 'claro';

export function useTemaInterno(): { tema: TemaInterno; alternarTema: () => void } {
  const tema = useSyncExternalStore(suscribir, leerTemaInterno, temaServidor);

  const alternarTema = useCallback(() => {
    const siguiente: TemaInterno = leerTemaInterno() === 'oscuro' ? 'claro' : 'oscuro';
    temaEnMemoria = siguiente;
    try { window.localStorage.setItem(TEMA_STORAGE_KEY, siguiente); } catch { /* sin almacenamiento: queda el respaldo en memoria */ }
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }, []);

  return { tema, alternarTema };
}
