'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import type { TenantId } from '@/src/types/radicado';

/**
 * Tenant de Licencias Urbanísticas. Mismo valor que la constante privada
 * `TENANT_LICENCIAS` de `app/api/licencias/expedientes/route.ts` — no está
 * exportada (API route) y este componente de UI no debe importar de ahí,
 * así que se duplica el literal. Ambos están tipados contra `TenantId`,
 * así que un typo se detecta en compilación, no en producción; si algún
 * día se crea un módulo compartido de constantes de tenant, este es el
 * punto a actualizar.
 */
const TENANT_LICENCIAS: TenantId = 'SEC_PLANEACION';

/**
 * Gate visual del módulo Licencias (micro-bloque "acceso solo Planeación",
 * encargo del propietario). El servidor YA exige `canOperateTenant`
 * (`app/api/licencias/expedientes*`) — este componente no reemplaza esa
 * autorización, evita que un funcionario sin permiso vea la CÁSCARA del
 * módulo (bandeja vacía, KPIs en cero) mientras el fetch le falla con 403.
 *
 * Reglas de acceso — a propósito MÁS ESTRICTAS que el servidor:
 *  - `ADMIN`: acceso total (igual que el servidor).
 *  - `FUNCIONARIO` con `tenantId === 'SEC_PLANEACION'`: acceso (igual que
 *    el servidor).
 *  - `RECEPCIONISTA`: el servidor SÍ lo deja operar hoy (`canOperateTenant`
 *    incluye RECEPCIONISTA por la convención de ventanilla — puede
 *    radicar/asignar en cualquier dependencia), pero esta pantalla no es
 *    ventanilla: es el escritorio jurídico de Planeación (estados
 *    jurídicos, actas de observaciones). Darle acceso visual aquí
 *    adelantaría una integración que no existe todavía — el handoff
 *    radicado⇄expediente de licencias. Se declara como dependencia: ese
 *    handoff es lo único que debería mover este `if`.
 *  - Cualquier otro rol o dependencia: tarjeta institucional, nunca la
 *    cáscara del módulo.
 *
 * Dónde vive el guard (decisión, no descuido): `../layout.tsx` es Server
 * Component (conserva ese carácter a propósito — ver su JSDoc) y no puede
 * llamar `useAuth`. En vez de duplicar el chequeo en las 3 páginas
 * (Bandeja, Detalle, Libro consecutivo), este componente 'use client' se
 * monta UNA sola vez desde el layout envolviendo TODO su árbol (sidebar +
 * barra móvil + `children`) — no solo `children` — para que un usuario no
 * autorizado no vea ni la cáscara del módulo ni el sidebar con la marca
 * "Secretaría de Planeación" antes de la tarjeta de rechazo. Patrón
 * "Interleaving Server and Client Components" documentado en
 * node_modules/next/dist/docs/01-app/01-getting-started/
 * 05-server-and-client-components.md: el Server Component sigue
 * resolviendo `children` en el servidor y se los pasa a este Client
 * Component como prop — React no obliga a que `children` también sea
 * cliente por venir envuelto en un componente cliente.
 */
export function GuardModuloPlaneacion({ children }: { children: ReactNode }) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-3" role="status">
          <span
            className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: '#D9E2D9', borderTopColor: '#14532D' }}
          />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Verificando acceso…</span>
        </div>
      </div>
    );
  }

  const autorizado = !!usuario && (
    usuario.rol === 'ADMIN'
    || (usuario.rol === 'FUNCIONARIO' && usuario.tenantId === TENANT_LICENCIAS)
  );

  if (!autorizado) {
    return (
      <div className="h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-base)' }}>
        <div
          className="max-w-[480px] w-full rounded-xl p-8 flex flex-col items-center text-center gap-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: '#EEF4EE' }}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#14532D" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75s.75-1.5 2.25-1.5 2.25 1.125 2.25 2.0625c0 1.5-2.25 1.6875-2.25 3.1875M12 16.5h.008v.008H12V16.5z" />
            </svg>
          </div>
          <div>
            <h1 className="font-headline text-xl" style={{ color: 'var(--text-primary)' }}>
              Este módulo pertenece a la Secretaría de Planeación
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              La Bandeja de Licencias, el Detalle de expediente y el Libro consecutivo son de uso exclusivo de la
              Secretaría de Planeación. Si necesitas acceso, contacta al administrador del sistema.
            </p>
          </div>
          <Link
            href="/interno/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded focus-visible:outline-none focus-visible:ring-2"
            style={{ color: '#14532D' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver al Tablero
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
