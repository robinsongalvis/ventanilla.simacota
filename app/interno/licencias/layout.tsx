import type { ReactNode } from 'react';
import { LicenciasSidebar, LicenciasTopBarMovil } from './components/LicenciasSidebar';
import { GuardModuloPlaneacion } from './components/GuardModuloPlaneacion';

/**
 * Layout del módulo Licencias — envuelve la Bandeja, el Detalle y el Libro
 * consecutivo con el mismo chrome (sidebar + fondo institucional). Server
 * Component: la única parte interactiva propia del chrome (resaltar el
 * ítem activo) vive dentro de `LicenciasSidebar` ('use client'), no aquí.
 *
 * `app/interno/layout.tsx` ya resuelve la autenticación/control de pestaña
 * única para todo `/interno/*` — este layout no repite esa lógica.
 *
 * `GuardModuloPlaneacion` (ver su JSDoc) envuelve TODO el árbol —sidebar,
 * barra móvil y `children`—, no solo `children`: un funcionario sin
 * permiso no debe ver ni la marca "Secretaría de Planeación" del sidebar
 * antes de la tarjeta de acceso restringido. Este layout sigue siendo
 * Server Component; el guard es el único límite 'use client' del módulo.
 *
 * `print:h-auto print:overflow-visible` (Bloque C, Libro consecutivo): el
 * chrome de pantalla es `h-screen overflow-hidden` con scroll interno en
 * `<main>` — correcto en pantalla, pero al imprimir cortaría la tabla del
 * libro a lo que cabe en un viewport. `LicenciasSidebar`/
 * `LicenciasTopBarMovil` ya se ocultan con `print:hidden` (ver su JSDoc);
 * estos overrides dejan que el contenido fluya a tantas páginas como haga
 * falta.
 */
export default function LicenciasLayout({ children }: { children: ReactNode }) {
  return (
    <GuardModuloPlaneacion>
      <div className="h-screen flex overflow-hidden print:h-auto print:overflow-visible print:block" style={{ background: 'var(--bg-base)' }}>
        <LicenciasSidebar />
        {/* `min-h-0` NO es decorativo: sin él, un hijo flex con `flex-1` no
            puede contraerse por debajo de su contenido (su `min-height`
            implícito es `auto`), así que `<main>` crecía con la pantalla
            larga —el Detalle con su checklist completo— empujaba el
            documento más allá de `h-screen` y el SCROLL SE IBA AL BODY: la
            página bajaba, el sidebar de altura fija se quedaba arriba y
            debajo aparecía una franja en blanco (reportado en producción
            el 11-ago-2026). Con `min-h-0`, `<main>` recupera su scroll
            interno y el documento nunca desborda el viewport. Es el mismo
            patrón que el resto del proyecto ya aplica (ver los
            contenedores equivalentes de `app/interno/dashboard/page.tsx`);
            este layout era el único que lo omitía. */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden print:overflow-visible print:block">
          <LicenciasTopBarMovil titulo="Licencias" />
          <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
        </div>
      </div>
    </GuardModuloPlaneacion>
  );
}
