'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 7; /* Reaparece después de 7 días si se rechaza */
const SHOW_DELAY_MS = 60_000; /* Espera 60s antes de mostrar */

function fueDescartadoRecientemente(): boolean {
  try {
    const valor = localStorage.getItem(STORAGE_KEY);
    if (!valor) return false;
    const fechaDescarte = new Date(valor);
    const ahora = new Date();
    const diasDesdeDescarte = (ahora.getTime() - fechaDescarte.getTime()) / (1000 * 60 * 60 * 24);
    return diasDesdeDescarte < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (fueDescartadoRecientemente()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      /* Espera antes de mostrar para no interrumpir al usuario */
      const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return () => clearTimeout(timer);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  async function instalar() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setVisible(false);
    setInstallEvent(null);
  }

  function descartar() {
    setVisible(false);
    setInstallEvent(null);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch { /* noop */ }
  }

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-emerald-500/20 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur print:hidden animate-fade-in-up">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#14532D' }}>
          <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-50">Instalar Ventanilla Única</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            Acceso rápido sin abrir el navegador. No guarda datos sensibles.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" onClick={instalar}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition-colors"
              style={{ background: '#14532D' }}>
              Instalar
            </button>
            <button type="button" onClick={descartar}
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-400 transition-colors hover:text-slate-200">
              Ahora no
            </button>
          </div>
        </div>
        <button type="button" onClick={descartar}
          className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Cerrar">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
