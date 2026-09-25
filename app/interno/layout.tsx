'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useSingleTab } from '@/lib/hooks/useSingleTab';
import { DashboardErrorBoundary } from '@/app/components/ErrorBoundary';
import { TabBloqueada } from '@/app/components/TabBloqueada';

/** Pantallas internas cuyo raíz tiene altura fija y scroll interno propio — ver el efecto que usa esta lista. */
const RUTAS_CON_SCROLL_PROPIO = ['/interno/dashboard', '/interno/licencias'] as const;

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
  const router   = useRouter();
  const { usuario, cargando } = useAuth();
  const esLogin = pathname === '/interno/login';

  // Control de pestaña única: solo aplica fuera de la página de login
  const { isActive, isResolving, tomarControl, revisarYContinuar, segundosDesdeHeartbeat } = useSingleTab();

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

  /**
   * El `<body>` NO debe poder desplazarse en las pantallas que gestionan su
   * propio scroll interno (raíz con altura fija + `overflow-hidden`, con el
   * scroll dentro de `<main>`): Dashboard y Licencias.
   *
   * Defecto que corrige (reportado en producción el 11-ago-2026 y medido en
   * el navegador del propietario): la página aparecía desplazada ~420 px con
   * media pantalla en blanco debajo del contenido. Las mediciones descartaron
   * las causas obvias — el documento NO desbordaba (`scrollHeight` = 678 =
   * `innerHeight`), el contenedor raíz SÍ cubría la ventana (678) y el
   * contenedor interno tenía su scroll correcto (621/3772) — pero `scrollY`
   * valía **420** y el raíz estaba en `top: -420`. Es decir: el documento
   * creció en algún instante (cambio de vista, transición de estado de carga,
   * hidratación), el navegador desplazó el `<body>`, y al volver el layout a
   * su altura fija el desplazamiento QUEDÓ — el navegador no siempre lo
   * restaura cuando el contenido se encoge. El resultado es una app
   * correctamente dimensionada pero corrida fuera de la vista.
   *
   * Fijar `overflow: hidden` en el `<body>` cierra la causa de raíz: sin
   * scroll de página no hay desplazamiento que pueda quedarse pegado. El
   * `scrollTo(0, 0)` sanea además el estado heredado de una sesión ya
   * desplazada.
   *
   * ACOTADO A PROPÓSITO: `/interno/recepcion` y `/interno/login` NO llevan
   * altura fija y sí dependen del scroll de página — bloquearlo ahí dejaría
   * contenido inalcanzable. Si una pantalla interna futura gestiona su propio
   * scroll, se agrega su prefijo aquí; si deja de hacerlo, se quita.
   */
  useEffect(() => {
    const gestionaSuScroll = RUTAS_CON_SCROLL_PROPIO.some((ruta) => pathname.startsWith(ruta));
    if (!gestionaSuScroll) return;

    document.body.classList.add('sin-scroll-de-pagina');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('sin-scroll-de-pagina');
  }, [pathname]);

  // La página de login no requiere control de pestaña única
  if (esLogin) return <>{children}</>;


  // Aún verificando autenticación o cuál pestaña es la activa
  if (cargando || !usuario || isResolving) return <CargandoModuloInterno />;

  // Esta pestaña no es la activa → mostrar pantalla de bloqueo
  if (!isActive) {
    return (
      <TabBloqueada
        onTomarControl={tomarControl}
        onRevisarYContinuar={revisarYContinuar}
        segundosDesdeHeartbeat={segundosDesdeHeartbeat}
      />
    );
  }

  return (
    <DashboardErrorBoundary>
      {children}
    </DashboardErrorBoundary>
  );
}
