import type { ReactNode } from 'react';
import { GuardModuloPlaneacion } from './components/GuardModuloPlaneacion';

/**
 * Layout de las rutas antiguas de Licencias (ADR-0046 §7). Licencias ya no
 * tiene armazón propio: vive en el panel interno con el mismo menú,
 * encabezado, barra móvil y selector de tema que el resto, y estas rutas
 * solo redirigen a su dirección canónica.
 *
 * `GuardModuloPlaneacion` se conserva: quien no tiene acceso ve la tarjeta
 * de acceso restringido en vez de ser redirigido. La autenticación de todo
 * `/interno/*` la resuelve `app/interno/layout.tsx`.
 */
export default function LicenciasLayout({ children }: { children: ReactNode }) {
  return <GuardModuloPlaneacion>{children}</GuardModuloPlaneacion>;
}
