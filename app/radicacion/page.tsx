import type { Metadata } from 'next';
import Link from 'next/link';
import FormRadicacion from './_components/FormRadicacion';

export const metadata: Metadata = {
  title: 'Radicar Solicitud – Ventanilla Única · Alcaldía de Simacota',
  description:
    'Radica tu solicitud ciudadana de forma digital. Sistema de trazabilidad total de la Alcaldía Municipal de Simacota.',
};

export default function RadicacionPage() {
  return (
    <div className="bg-obsidian-gradient min-h-screen flex flex-col">

      {/* ── Navbar ── */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 backdrop-blur-[20px] bg-[#0A0A0B]/70">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          {/* Back */}
          <Link
            href="/"
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all"
            aria-label="Volver al inicio"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5.25-3.5 10.15-8 11.5C7.5 22.15 4 17.25 4 12V7l8-4z" />
              </svg>
            </div>
            <div>
              <p className="font-label text-indigo-400 text-[10px]">Alcaldía de Simacota</p>
              <p className="text-slate-200 font-semibold text-xs" style={{ fontFamily: 'var(--font-manrope)' }}>
                Ventanilla Única Digital
              </p>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="ml-auto hidden sm:flex items-center gap-2 font-label text-[10px] text-slate-600">
            <Link href="/" className="hover:text-slate-400 transition-colors">Inicio</Link>
            <span>/</span>
            <span className="text-slate-400">Radicar Solicitud</span>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* Encabezado de sección */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/10 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="font-label text-indigo-400 text-[10px]">Portal ciudadano</span>
            </div>
            <h1 className="font-headline text-3xl md:text-4xl text-slate-50 mb-3">
              Radica tu Solicitud
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
              Completa el formulario. La IA clasificará tu caso y lo enviará
              a la dependencia correspondiente de la Alcaldía.
            </p>
          </div>

          {/* Tarjeta principal (glassmorphism) */}
          <div className="glass-card p-8">
            <FormRadicacion />
          </div>

          {/* Info adicional */}
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <div className="glass-card p-4 flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-label text-amber-400 text-[10px] mb-1">Tiempo de respuesta</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Las solicitudes son atendidas en un plazo máximo de 15 días hábiles según la ley 1437 de 2011.
                </p>
              </div>
            </div>

            <div className="glass-card p-4 flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <p className="font-label text-indigo-400 text-[10px] mb-1">Datos seguros</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Tu información está protegida bajo la Ley 1581 de 2012 de protección de datos personales.
                </p>
              </div>
            </div>
          </div>

          {/* Atención física */}
          <p className="text-center text-slate-600 text-xs mt-8">
            ¿Prefieres atención presencial?{' '}
            <span className="text-slate-400 font-medium">
              Visítanos en la Alcaldía Municipal, Calle 4 # 4-28, Simacota, Santander.
            </span>
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-6 text-center">
        <p className="font-label text-slate-700 text-[10px]">
          Alcaldía Municipal de Simacota · Santander, Colombia · Sistema de Ventanilla Única Digital
        </p>
      </footer>
    </div>
  );
}
