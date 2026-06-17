import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import type { Metadata } from 'next';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';

export const dynamic = 'force-dynamic';

// Bloquea la indexación de esta ruta privada (doble capa junto a robots.ts)
export const metadata: Metadata = {
  title: 'Acceso Funcionarios',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};


function LoginFormFallback() {
  return (
    <div className="glass-card p-8 flex items-center justify-center min-h-72">
      <span className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin-smooth" />
    </div>
  );
}

export default function LoginInternoPage() {
  return (
    <main className="min-h-dvh bg-obsidian-gradient flex items-center justify-center overflow-y-auto px-4 py-8 sm:p-4">
      <div className="w-full max-w-md">
        {/* Encabezado institucional */}
        <div className="text-center mb-8">
          <InstitucionalHeader align="center" subtitle="Acceso Funcionarios · Ventanilla Única Digital" />
          {/* Eyebrow institucional */}
          <div className="inline-flex items-center gap-2 px-3 py-1 mt-4 mb-3 rounded-full border border-emerald-500/30 bg-emerald-500/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="font-label text-emerald-300 text-[10px]">Panel institucional seguro</span>
          </div>
          <h1 className="font-headline text-2xl sm:text-3xl text-slate-50">
            Panel de Gestión
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Ingreso seguro para usuarios institucionales de la Alcaldía Municipal de Simacota.
          </p>
        </div>

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>

        {/* Pie institucional discreto */}
        <p className="mt-6 text-center text-[10px] font-label text-slate-600 leading-relaxed">
          Plataforma oficial · Santander · Colombia
        </p>
      </div>
    </main>
  );
}
