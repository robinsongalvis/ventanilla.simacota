'use client';

import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (process.env.NODE_ENV === 'development') {
    console.error('[dashboard] error detectado', {
      message: error.message,
      digest: error.digest,
    });
  }

  return (
    <main className="min-h-dvh bg-obsidian-gradient flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-center shadow-2xl shadow-black/30">
        <InstitucionalHeader align="center" compact subtitle="Panel Institucional" />
        <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-50" style={{ fontFamily: 'var(--font-manrope)' }}>
          No fue posible cargar el panel
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          La sesión puede haber expirado o un módulo interno no respondió correctamente. Intenta recargar el panel.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="btn-primary justify-center">
            Reintentar
          </button>
          <a href="/interno/login" className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-white/[0.06]">
            Volver al login
          </a>
        </div>
      </section>
    </main>
  );
}
