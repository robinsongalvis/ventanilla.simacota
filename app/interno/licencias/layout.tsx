import type { ReactNode } from 'react';
import { LicenciasSidebar, LicenciasTopBarMovil } from './components/LicenciasSidebar';

/**
 * Layout del módulo Licencias — envuelve la Bandeja, el Detalle y el Libro
 * consecutivo con el mismo chrome (sidebar + fondo institucional). Server
 * Component: la única parte interactiva (resaltar el ítem activo) vive
 * dentro de `LicenciasSidebar` ('use client'), no aquí.
 *
 * `app/interno/layout.tsx` ya resuelve la autenticación/control de pestaña
 * única para todo `/interno/*` — este layout no repite esa lógica.
 */
export default function LicenciasLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <LicenciasSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <LicenciasTopBarMovil titulo="Licencias" />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
