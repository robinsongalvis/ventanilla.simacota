'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { InstitucionalHeader } from '@/app/components/institucional/InstitucionalHeader';

/**
 * Sidebar del módulo Licencias — visualmente coherente con el sidebar real
 * del panel (`SidebarNav`, `app/interno/dashboard/page.tsx`: mismo verde
 * institucional `#14532D`, mismo bloque `InstitucionalHeader`, mismo patrón
 * de ítem activo dorado), pero es un componente PROPIO de este módulo, no
 * el mismo componente reutilizado literalmente.
 *
 * Actualización (Bloque B, "la ventanita"): `VistaActual` YA tiene un
 * ítem `'LICENCIAS'` (`lib/store/ventanillaStore.tsx`) que monta
 * `VistaLicencias` (`app/interno/dashboard/components/licencias/
 * VistaLicencias.tsx`) EMBEBIDO dentro de `SidebarNav`, con su propia
 * sub-navegación local (Bandeja / Libro consecutivo) — ese es hoy el
 * camino principal para el funcionario de Planeación. Este sidebar y la
 * ruta standalone que envuelve (`/interno/licencias`, `layout.tsx`) NO se
 * retiraron: siguen vivos a propósito para deep-links (un enlace directo a
 * `/interno/licencias/{id}` sigue funcionando fuera del panel). Los dos
 * caminos comparten los mismos Client Components (`BandejaLicenciasClient`,
 * `DetalleLicenciaClient`), no lógica duplicada.
 */
const ITEMS = [
  { href: '/interno/licencias', label: 'Licencias' },
  { href: '/interno/licencias/libro-consecutivo', label: 'Libro consecutivo' },
] as const;

export function LicenciasSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex h-full flex-col shrink-0 w-[250px] overflow-hidden print:hidden"
      style={{ background: '#14532D' }}
    >
      <div
        className="px-4 py-4 w-full overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}
      >
        <InstitucionalHeader variant="sidebar" subtitle="Ventanilla Única Digital" />
      </div>

      <div className="px-3 pt-3 pb-1">
        <Link
          href="/interno/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver al Tablero
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
        <p
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          Secretaría de Planeación
        </p>
        {ITEMS.map((item) => {
          const activo = item.href === '/interno/licencias'
            ? pathname === item.href || pathname.startsWith('/interno/licencias/lic-')
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? 'page' : undefined}
              className="micro-sidebar-item flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              style={
                activo
                  ? { background: '#D4A017', color: '#14532D', boxShadow: '0 2px 8px rgba(212,160,23,0.30)' }
                  : { color: 'rgba(255,255,255,0.75)' }
              }
            >
              <span className="text-xs font-medium flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/** Barra superior compacta para pantallas pequeñas (el sidebar completo se oculta bajo `md`). */
export function LicenciasTopBarMovil({ titulo }: { titulo: string }) {
  return (
    <header
      className="md:hidden shrink-0 bg-white px-3 py-2.5 flex items-center gap-2.5 print:hidden"
      style={{ borderBottom: '1px solid #D9E2D9' }}
    >
      <Link
        href="/interno/dashboard"
        aria-label="Volver al Tablero"
        className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2"
        style={{ border: '1px solid #D9E2D9', color: '#14532D', background: '#EEF4EE' }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: '#667085' }}>
          Secretaría de Planeación
        </p>
        <p className="truncate text-sm font-black leading-tight" style={{ color: '#1F2933' }}>
          {titulo}
        </p>
      </div>
    </header>
  );
}
