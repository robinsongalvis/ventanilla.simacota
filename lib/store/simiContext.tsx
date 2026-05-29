'use client';

/**
 * SimiContext — Puente de estado entre el widget flotante SimiChat
 * y cualquier formulario de la aplicación que quiera recibir datos extraídos.
 *
 * Patrón: Observer ligero con Context API.
 * El formulario registra el handler. SIMI lo dispara cuando extrae datos.
 * Sin Zustand. Sin prop drilling. Sin acoplamiento directo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import type { DatosExtraidos } from '@/src/types/simi';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

/** Callback que el formulario registra para recibir datos del escáner */
export type OnDataExtractedFn = (datos: Partial<DatosExtraidos>) => void;

interface SimiContextValue {
  /**
   * Registra el handler del formulario activo.
   * El formulario llama esto en un useEffect con cleanup.
   */
  registrarHandler: (fn: OnDataExtractedFn) => void;
  /** El formulario desregistra su handler al desmontarse */
  desregistrarHandler: () => void;
  /**
   * SIMI llama esto cuando extrae datos de un documento.
   * El Context lo delega al handler activo (si existe).
   */
  notificarExtraccion: (datos: Partial<DatosExtraidos>) => void;
}

/* ══════════════════════════════════════════════════════════════
   CONTEXT
══════════════════════════════════════════════════════════════ */

const SimiContext = createContext<SimiContextValue | null>(null);

/* ══════════════════════════════════════════════════════════════
   PROVIDER
══════════════════════════════════════════════════════════════ */

export function SimiProvider({ children }: { children: ReactNode }) {
  // Ref para evitar re-renders en el Provider cuando el handler cambia
  const handlerRef = useRef<OnDataExtractedFn | null>(null);

  const registrarHandler = useCallback((fn: OnDataExtractedFn) => {
    handlerRef.current = fn;
  }, []);

  const desregistrarHandler = useCallback(() => {
    handlerRef.current = null;
  }, []);

  const notificarExtraccion = useCallback((datos: Partial<DatosExtraidos>) => {
    handlerRef.current?.(datos);
  }, []);

  const value = useMemo(
    () => ({ registrarHandler, desregistrarHandler, notificarExtraccion }),
    [registrarHandler, desregistrarHandler, notificarExtraccion],
  );

  return <SimiContext.Provider value={value}>{children}</SimiContext.Provider>;
}

/* ══════════════════════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════════════════════ */

/** Usado por SimiChat para disparar notificaciones de extracción */
export function useSimiNotifier(): Pick<SimiContextValue, 'notificarExtraccion'> {
  const ctx = useContext(SimiContext);
  if (!ctx) throw new Error('useSimiNotifier debe usarse dentro de <SimiProvider>');
  return { notificarExtraccion: ctx.notificarExtraccion };
}

/**
 * Usado por formularios para registrar su handler de auto-llenado.
 * Gestiona automáticamente el ciclo de vida (register/cleanup).
 *
 * @example
 * useSimiDataReceiver((datos) => {
 *   if (datos.nombre) setForm(prev => ({ ...prev, nombre: datos.nombre! }));
 * });
 */
export function useSimiDataReceiver(onDataExtracted: OnDataExtractedFn): void {
  const ctx = useContext(SimiContext);
  if (!ctx) throw new Error('useSimiDataReceiver debe usarse dentro de <SimiProvider>');

  const { registrarHandler, desregistrarHandler } = ctx;

  // callbackRef mantiene la referencia estable del handler sin necesitarlo
  // como dependencia del useEffect → evita registrar/desregistrar en cada render
  const callbackRef = useRef<OnDataExtractedFn>(onDataExtracted);
  callbackRef.current = onDataExtracted;

  useEffect(() => {
    registrarHandler((datos) => callbackRef.current(datos));
    return () => desregistrarHandler();
  }, [registrarHandler, desregistrarHandler]);
}
