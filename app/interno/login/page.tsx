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
      <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin-smooth" />
    </div>
  );
}

export default function LoginInternoPage() {
  return (
    <main className="min-h-dvh bg-obsidian-gradient flex items-center justify-center overflow-y-auto px-4 py-6 sm:p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <InstitucionalHeader align="center" subtitle="Acceso Funcionarios · Ventanilla Única Digital" />
          <h1 className="font-headline text-2xl text-slate-50">
            Panel de Gestión
          </h1>
          <p className="text-sm text-slate-400 mt-1">Ingreso seguro para usuarios institucionales</p>
        </div>

        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
