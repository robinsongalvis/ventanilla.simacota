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
const STORAGE_BANDEJA = 'dashboardPanelBandejaMinimizada';
const STORAGE_SIGUIENTE = 'dashboardPanelSiguienteMinimizada';

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
  bandejaMinimizada: boolean;
  siguienteMinimizada: boolean;
  toggleBandeja: () => void;
  toggleSiguiente: () => void;
} {
  const [modo, setModoState] = useState<IndicadoresModo>('normal');
  const [bandejaMinimizada, setBandejaMinimizada] = useState(false);
  const [siguienteMinimizada, setSiguienteMinimizada] = useState(false);

  useEffect(() => {
    const modoInicial = leerInicial();
    setModoState(modoInicial);
    try {
      const bandejaGuardada = window.localStorage.getItem(STORAGE_BANDEJA);
      const siguienteGuardada = window.localStorage.getItem(STORAGE_SIGUIENTE);
      setBandejaMinimizada(bandejaGuardada === null ? modoInicial === 'compacto' : bandejaGuardada === 'true');
      setSiguienteMinimizada(siguienteGuardada === null ? modoInicial === 'compacto' : siguienteGuardada === 'true');
    } catch {
      setBandejaMinimizada(modoInicial === 'compacto');
      setSiguienteMinimizada(modoInicial === 'compacto');
    }
  }, []);

  const guardarPaneles = useCallback((bandeja: boolean, siguiente: boolean) => {
    const siguienteModo: IndicadoresModo = bandeja && siguiente ? 'compacto' : 'normal';
    setModoState(siguienteModo);
    try {
      window.localStorage.setItem(STORAGE_KEY, siguienteModo);
      window.localStorage.setItem(STORAGE_BANDEJA, String(bandeja));
      window.localStorage.setItem(STORAGE_SIGUIENTE, String(siguiente));
    } catch { /* no-op */ }
  }, []);

  const setModo = useCallback((v: IndicadoresModo) => {
    const minimizar = v === 'compacto';
    setBandejaMinimizada(minimizar);
    setSiguienteMinimizada(minimizar);
    guardarPaneles(minimizar, minimizar);
  }, [guardarPaneles]);

  const toggle = useCallback(() => {
    const minimizar = !(bandejaMinimizada && siguienteMinimizada);
    setBandejaMinimizada(minimizar);
    setSiguienteMinimizada(minimizar);
    guardarPaneles(minimizar, minimizar);
  }, [bandejaMinimizada, guardarPaneles, siguienteMinimizada]);

  const toggleBandeja = useCallback(() => {
    setBandejaMinimizada((actual) => {
      const siguiente = !actual;
      guardarPaneles(siguiente, siguienteMinimizada);
      return siguiente;
    });
  }, [guardarPaneles, siguienteMinimizada]);

  const toggleSiguiente = useCallback(() => {
    setSiguienteMinimizada((actual) => {
      const siguiente = !actual;
      guardarPaneles(bandejaMinimizada, siguiente);
      return siguiente;
    });
  }, [bandejaMinimizada, guardarPaneles]);

  return {
    modo,
    setModo,
    toggle,
    bandejaMinimizada,
    siguienteMinimizada,
    toggleBandeja,
    toggleSiguiente,
  };
}
