import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Layout de segmento para /radicacion.
 * Permite exportar metadata desde el servidor, ya que page.tsx
 * usa 'use client' y no puede exportar metadata directamente.
 */
export const metadata: Metadata = {
  title: 'Radicar Solicitud',
  description:
    'Formula tu solicitud ciudadana en línea ante la Alcaldía de Simacota. ' +
    'Recibe un número de radicado único al instante con confirmación digital y seguimiento por WhatsApp.',
  alternates: {
    canonical: '/radicacion',
  },
  openGraph: {
    title: 'Radicar Solicitud – Ventanilla Única · Simacota',
    description:
      'Completa tu solicitud en minutos. Clasificación automática con IA y enrutamiento a la dependencia correcta.',
    url: '/radicacion',
  },
  robots: { index: true, follow: true },
};

export default function RadicacionLayout({ children }: { children: ReactNode }) {
  return children;
}
