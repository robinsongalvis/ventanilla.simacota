'use client';

import { useCallback, useEffect, useState } from 'react';

/* ══════════════════════════════════════════════════════════════
   Preferencia de UI: modo de los indicadores (KPIs) en el dashboard.

   - 'normal'    → tarjetas y métricas con el tamaño completo.
   - 'compacto'  → bandeja delgada, deja más altura útil al listado.

   Se persiste en localStorage para que el funcionario conserve su
   preferencia entre sesiones. No afecta lógica de negocio.
══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'indicadoresModo';

export type IndicadoresModo = 'normal' | 'compacto';

function leerInicial(): IndicadoresModo {
  if (typeof window === 'undefined') return 'normal';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'compacto' ? 'compacto' : 'normal';
  } catch {
    return 'normal';
  }
}

export function useIndicadoresModo(): {
  modo: IndicadoresModo;
  setModo: (v: IndicadoresModo) => void;
  toggle: () => void;
} {
  const [modo, setModoState] = useState<IndicadoresModo>('normal');

  useEffect(() => {
    setModoState(leerInicial());
  }, []);

  const setModo = useCallback((v: IndicadoresModo) => {
    setModoState(v);
    try { window.localStorage.setItem(STORAGE_KEY, v); } catch { /* no-op */ }
  }, []);

  const toggle = useCallback(() => {
    setModoState((prev) => {
      const next: IndicadoresModo = prev === 'normal' ? 'compacto' : 'normal';
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* no-op */ }
      return next;
    });
  }, []);

  return { modo, setModo, toggle };
}
