import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Layout de segmento para /consulta.
 * Permite exportar metadata desde el servidor, ya que page.tsx
 * usa 'use client' y no puede exportar metadata directamente.
 */
export const metadata: Metadata = {
  title: 'Consultar Estado de Solicitud',
  description:
    'Consulta el estado actualizado de tu solicitud radicada ante la Alcaldía de Simacota. ' +
    'Ingresa tu número de radicado para ver el historial y seguimiento en tiempo real.',
  alternates: {
    canonical: '/consulta',
  },
  openGraph: {
    title: 'Consultar Solicitud – Ventanilla Única · Simacota',
    description:
      'Seguimiento en tiempo real de tu trámite ante la Alcaldía de Simacota, Santander.',
    url: '/consulta',
  },
  robots: { index: true, follow: true },
};

export default function ConsultaLayout({ children }: { children: ReactNode }) {
  return children;
}
