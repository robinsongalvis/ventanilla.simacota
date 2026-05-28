import type { MetadataRoute } from 'next';

/**
 * manifest.ts — Web App Manifest (PWA básico)
 *
 * Permite que ciudadanos en móvil (incluyendo zonas rurales Yariguíes)
 * puedan instalar la app en su pantalla de inicio sin necesidad de
 * una app store. Compatible con Android Chrome y iOS Safari.
 *
 * Accesible en: /manifest.webmanifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ventanilla Única Digital – Simacota',
    short_name: 'Ventanilla Simacota',
    description:
      'Plataforma oficial de radicación ciudadana de la Alcaldía Municipal de Simacota, Santander',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0A0B',
    theme_color: '#6366F1',
    lang: 'es',
    icons: [
      {
        src: '/og-image.png',
        sizes: '1200x630',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
