'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Constantes ──────────────────────────────────────────────────────────────

const CHANNEL_NAME    = 'vu-tab-control';
const LS_ACTIVE_TAB   = 'vu-active-tab-id';
const LS_ACTIVE_TS    = 'vu-active-tab-ts';
const HEARTBEAT_MS    = 2_000;   // Cada cuánto la pestaña activa anuncia que sigue viva
const CLAIM_WAIT_MS   = 500;     // Tiempo que espera una pestaña nueva antes de reclamar
const STALE_AFTER_MS  = 7_000;   // Si no hay heartbeat reciente, se considera pestaña muerta
const RECHECK_WAIT_MS = 800;

type TabMsg =
  | { type: 'HEARTBEAT';  tabId: string }
  | { type: 'TAKEOVER';   tabId: string }
  | { type: 'YIELD';      tabId: string }
  | { type: 'PING';       tabId: string }
  | { type: 'PONG';       tabId: string };

// ─── Generador de ID de pestaña ──────────────────────────────────────────────

function getOrCreateTabId(): string {
  const existing = sessionStorage.getItem('vu-tab-id');
  if (existing) return existing;

  const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem('vu-tab-id', id);
  return id;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseSingleTabReturn {
  /** true cuando esta pestaña es la activa y puede mostrar contenido */
  isActive: boolean;
  /** true mientras se está resolviendo cuál pestaña es la activa */
  isResolving: boolean;
  /** Toma el control de la sesión, bloqueando las demás pestañas */
  tomarControl: () => void;
  /** Verifica si la pestaña anterior sigue viva; si no, toma control sin fricción */
  revisarYContinuar: () => Promise<boolean>;
  /** Segundos desde el último heartbeat de la pestaña activa conocida */
  segundosDesdeHeartbeat: number | null;
}

function getStoredActive(): { tabId: string | null; lastSeen: number | null; stale: boolean } {
  const tabId = localStorage.getItem(LS_ACTIVE_TAB);
  const rawTs = localStorage.getItem(LS_ACTIVE_TS);
  const lastSeen = rawTs ? Number(rawTs) : null;
  const stale = !lastSeen || Number.isNaN(lastSeen) || Date.now() - lastSeen > STALE_AFTER_MS;
  return { tabId, lastSeen, stale };
}

export function useSingleTab(): UseSingleTabReturn {
  const [isActive,    setIsActive]    = useState(false);
  const [isResolving, setIsResolving] = useState(true);
  const [segundosDesdeHeartbeat, setSegundosDesdeHeartbeat] = useState<number | null>(null);

  const tabIdRef    = useRef<string>('');
  const channelRef  = useRef<BroadcastChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inicia el heartbeat de la pestaña activa
  const startHeartbeat = useCallback((ch: BroadcastChannel, tabId: string) => {
    const beat = () => {
      ch.postMessage({ type: 'HEARTBEAT', tabId } satisfies TabMsg);
      localStorage.setItem(LS_ACTIVE_TAB, tabId);
      localStorage.setItem(LS_ACTIVE_TS, String(Date.now()));
    };
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    beat();
    heartbeatRef.current = setInterval(beat, HEARTBEAT_MS);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Cede el control y pasa a estado bloqueado
  const yield_ = useCallback((ch: BroadcastChannel, tabId: string) => {
    stopHeartbeat();
    setIsActive(false);
    ch.postMessage({ type: 'YIELD', tabId } satisfies TabMsg);
  }, [stopHeartbeat]);

  // Toma el control desde una pestaña bloqueada
  const tomarControl = useCallback(() => {
    const ch    = channelRef.current;
    const tabId = tabIdRef.current;
    if (!ch) return;

    ch.postMessage({ type: 'TAKEOVER', tabId } satisfies TabMsg);
    localStorage.setItem(LS_ACTIVE_TAB, tabId);
    localStorage.setItem(LS_ACTIVE_TS, String(Date.now()));
    setIsActive(true);
    startHeartbeat(ch, tabId);
  }, [startHeartbeat]);

  const revisarYContinuar = useCallback(async (): Promise<boolean> => {
    const ch = channelRef.current;
    const tabId = tabIdRef.current;
    if (!ch) return false;

    let alive = false;
    const listener = (event: MessageEvent<TabMsg>) => {
      if (event.data.type === 'PONG' && event.data.tabId !== tabId) {
        alive = true;
      }
    };

    ch.addEventListener('message', listener as EventListener);
    ch.postMessage({ type: 'PING', tabId } satisfies TabMsg);

    await new Promise((resolve) => window.setTimeout(resolve, RECHECK_WAIT_MS));
    ch.removeEventListener('message', listener as EventListener);

    const stored = getStoredActive();
    if (!alive || stored.stale || !stored.tabId || stored.tabId === tabId) {
      localStorage.setItem(LS_ACTIVE_TAB, tabId);
      localStorage.setItem(LS_ACTIVE_TS, String(Date.now()));
      setIsActive(true);
      startHeartbeat(ch, tabId);
      return true;
    }

    setSegundosDesdeHeartbeat(
      stored.lastSeen ? Math.max(0, Math.round((Date.now() - stored.lastSeen) / 1000)) : null,
    );
    return false;
  }, [startHeartbeat]);

  useEffect(() => {
    // BroadcastChannel solo existe en el navegador
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      setIsActive(true);
      setIsResolving(false);
      return;
    }

    const tabId  = getOrCreateTabId();
    tabIdRef.current = tabId;

    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;

    // ── Escucha mensajes de otras pestañas ──
    ch.onmessage = (event: MessageEvent<TabMsg>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'HEARTBEAT':
          // Otra pestaña está activa → si esta no lo era, se mantiene bloqueada
          if (msg.tabId !== tabId) {
            localStorage.setItem(LS_ACTIVE_TAB, msg.tabId);
            localStorage.setItem(LS_ACTIVE_TS, String(Date.now()));
            // Si esta pestaña creía que era activa por error, cede
            setIsActive(prev => {
              if (prev) stopHeartbeat();
              return false;
            });
          }
          break;

        case 'TAKEOVER':
          // Otra pestaña tomó el control
          if (msg.tabId !== tabId) {
            stopHeartbeat();
            setIsActive(false);
          }
          break;

        case 'YIELD':
          // La pestaña activa cedió; si nadie más reclama, esta puede activarse
          if (msg.tabId !== tabId) {
            window.setTimeout(() => {
              // Doble chequeo: si el LS ya no apunta a nadie activo
              const current = localStorage.getItem(LS_ACTIVE_TAB);
              if (!current || current === msg.tabId) {
                localStorage.setItem(LS_ACTIVE_TAB, tabId);
                localStorage.setItem(LS_ACTIVE_TS, String(Date.now()));
                setIsActive(true);
                startHeartbeat(ch, tabId);
              }
            }, 100);
          }
          break;

        case 'PING':
          // Alguien pregunta si hay una pestaña activa
          if (heartbeatRef.current) {
            ch.postMessage({ type: 'PONG', tabId } satisfies TabMsg);
          }
          break;

        case 'PONG':
          // Hay respuesta → ya hay una pestaña activa
          break;
      }
    };

    // ── Resolución inicial: ¿hay ya una pestaña activa? ──
    // Envía un PING y espera respuesta brevemente
    let pongReceived = false;

    const pongListener = (event: MessageEvent<TabMsg>) => {
      if (event.data.type === 'PONG' && event.data.tabId !== tabId) {
        pongReceived = true;
      }
    };

    ch.addEventListener('message', pongListener as EventListener);
    ch.postMessage({ type: 'PING', tabId } satisfies TabMsg);

    const claimTimer = window.setTimeout(() => {
      ch.removeEventListener('message', pongListener as EventListener);

      const stored = getStoredActive();
      const hasActiveTab = pongReceived || (!!stored.tabId && stored.tabId !== tabId && !stored.stale);

      if (hasActiveTab) {
        // Hay otra pestaña activa → esta se bloquea
        setIsActive(false);
        setSegundosDesdeHeartbeat(
          stored.lastSeen ? Math.max(0, Math.round((Date.now() - stored.lastSeen) / 1000)) : null,
        );
      } else {
        // No hay ninguna activa → esta toma el control
        localStorage.setItem(LS_ACTIVE_TAB, tabId);
        localStorage.setItem(LS_ACTIVE_TS, String(Date.now()));
        setIsActive(true);
        startHeartbeat(ch, tabId);
      }

      setIsResolving(false);
    }, CLAIM_WAIT_MS);

    // ── Cleanup al cerrar / desmontar ──
    const handleUnload = () => {
      const current = localStorage.getItem(LS_ACTIVE_TAB);
      if (current === tabId) {
        localStorage.removeItem(LS_ACTIVE_TAB);
        localStorage.removeItem(LS_ACTIVE_TS);
        yield_(ch, tabId);
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearTimeout(claimTimer);
      stopHeartbeat();
      window.removeEventListener('beforeunload', handleUnload);

      const current = localStorage.getItem(LS_ACTIVE_TAB);
      if (current === tabId) {
        localStorage.removeItem(LS_ACTIVE_TAB);
        localStorage.removeItem(LS_ACTIVE_TS);
        yield_(ch, tabId);
      }

      ch.close();
    };
  }, [startHeartbeat, stopHeartbeat, yield_]);

  useEffect(() => {
    if (isActive || isResolving) {
      setSegundosDesdeHeartbeat(null);
      return;
    }

    const timer = window.setInterval(() => {
      const stored = getStoredActive();
      setSegundosDesdeHeartbeat(
        stored.lastSeen ? Math.max(0, Math.round((Date.now() - stored.lastSeen) / 1000)) : null,
      );
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [isActive, isResolving]);

  return { isActive, isResolving, tomarControl, revisarYContinuar, segundosDesdeHeartbeat };
}
