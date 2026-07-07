'use client';

import { useEffect } from 'react';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';

/* ══════════════════════════════════════════════════════════════
   Pantalla de error del panel — diagnóstico y recuperación.

   Tres mejoras sobre la versión genérica:
   1. Si el error es "versión vieja tras una actualización" (chunk
      perdido), recarga sola UNA vez — la funcionaria ni se entera.
   2. "Recargar el panel" hace una recarga completa de verdad
      (reset() solo reintentaba el render con las mismas piezas).
   3. Muestra el detalle técnico plegado — sin stack traces ni rutas,
      solo mensaje y digest — para poder diagnosticar sin adivinar.
══════════════════════════════════════════════════════════════ */

const RELOAD_GUARD_KEY = 'panel-error-autoreload';

function esErrorDeVersionVieja(error: Error): boolean {
  const texto = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|dynamically imported module|import\(\) failed/i.test(texto);
}

// `reset()` de Next solo reintenta el render con los mismos assets — no
// sirve tras un despliegue; por eso este boundary recarga la página.
export default function DashboardError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] error detectado', {
      name: error.name,
      message: error.message,
      digest: error.digest,
    });

    // Auto-recuperación tras un despliegue: recarga completa una sola
    // vez (el guard evita un ciclo si el error persiste tras recargar).
    if (esErrorDeVersionVieja(error) && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
      window.location.reload();
    }
  }, [error]);

  function handleRecargar() {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
    window.location.reload();
  }

  return (
    <main className="min-h-dvh bg-obsidian-gradient flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center shadow-2xl shadow-black/30">
        <InstitucionalHeader align="center" compact subtitle="Panel Institucional" />
        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-50" style={{ fontFamily: 'var(--font-manrope)' }}>
          No fue posible cargar el panel
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          {esErrorDeVersionVieja(error)
            ? 'El sistema se actualizó mientras esta pestaña estaba abierta. Recarga el panel para traer la versión nueva.'
            : 'La sesión puede haber expirado o un módulo interno no respondió correctamente. Recarga el panel; si el mensaje vuelve, comparte el detalle técnico de abajo con el administrador.'}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={handleRecargar} className="btn-primary justify-center">
            Recargar el panel
          </button>
          <a href="/interno/login" className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06]">
            Volver al login
          </a>
        </div>

        {/* Detalle diagnóstico — mensaje y digest, nunca stack ni rutas. */}
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Detalle técnico
          </summary>
          <p className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-400 break-words">
            {error.name}: {error.message || 'sin mensaje'}
            {error.digest ? ` · digest: ${error.digest}` : ''}
          </p>
        </details>
      </section>
    </main>
  );
}
