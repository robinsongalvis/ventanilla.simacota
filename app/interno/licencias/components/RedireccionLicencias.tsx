'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { urlLicencias, type DestinoLicencias } from '../rutas-licencias';

/**
 * Lleva una ruta antigua de Licencias a su dirección canónica en el panel
 * (ADR-0046 §7). Va dentro de `GuardModuloPlaneacion` (layout del módulo):
 * quien no tiene acceso sigue viendo la tarjeta «Este módulo pertenece a la
 * Secretaría de Planeación» y nunca llega a redirigirse.
 *
 * `replace` y no `push`: la ruta antigua no queda en el historial, así que
 * «atrás» no rebota contra ella.
 */
export function RedireccionLicencias(destino: DestinoLicencias) {
  const router = useRouter();
  const url = urlLicencias(destino);

  useEffect(() => {
    router.replace(url);
  }, [router, url]);

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center gap-3" role="status">
        <span
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: 'var(--tema-borde-dce4ea)', borderTopColor: 'var(--tema-borde-007049)' }}
        />
        <a href={url} className="text-sm underline" style={{ color: 'var(--tema-texto-007049)' }}>
          Abriendo Licencias en el panel…
        </a>
      </div>
    </div>
  );
}
