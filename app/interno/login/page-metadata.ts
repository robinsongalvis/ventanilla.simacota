/**
 * layout-metadata.tsx — Server-side metadata para rutas /interno/*
 *
 * El layout principal de /interno es un Client Component ('use client')
 * por lo que no puede exportar metadata directamente. Este archivo separado
 * le indica a Next.js que NO indexe ninguna ruta bajo /interno/.
 *
 * Next.js App Router también respeta el archivo robots.ts a nivel de app/,
 * que bloquea /interno/ con Disallow. Esta capa es una defensa adicional.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceso Restringido',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};
