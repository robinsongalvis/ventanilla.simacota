'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
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

  if (!visible || !installEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-emerald-500/20 bg-slate-950/95 p-4 shadow-2xl shadow-black/30 backdrop-blur print:hidden">
      <p className="text-sm font-black text-slate-50">Instalar Ventanilla Única Simacota</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        Acceso rápido para funcionarios y ciudadanos. No guarda datos sensibles sin conexión.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={instalar} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">
          Instalar
        </button>
        <button type="button" onClick={() => setVisible(false)} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">
          Ahora no
        </button>
      </div>
    </div>
  );
}
