'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { DashboardErrorBoundary } from '@/app/components/ErrorBoundary';

function CargandoModuloInterno() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin-smooth" />
        <span className="text-sm text-slate-500">Verificando sesion...</span>
      </div>
    </div>
  );
}

export default function InternoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, cargando } = useAuth();
  const esLogin = pathname === '/interno/login';

  useEffect(() => {
    if (cargando) return;

    if (!usuario && !esLogin) {
      router.replace(`/interno/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (usuario && esLogin) {
      router.replace('/interno/dashboard');
    }
  }, [cargando, esLogin, pathname, router, usuario]);

  if (esLogin) return <>{children}</>;
  if (cargando || !usuario) return <CargandoModuloInterno />;

  return (
    <DashboardErrorBoundary>
      {children}
    </DashboardErrorBoundary>
  );
}
