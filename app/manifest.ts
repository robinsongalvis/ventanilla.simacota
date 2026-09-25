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
    name: 'Ventanilla Única Digital - Alcaldía de Simacota',
    short_name: 'Ventanilla Simacota',
    description:
      'Sistema institucional de radicación, consulta y seguimiento de solicitudes ciudadanas.',
    start_url: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#ffffff',
    theme_color:      '#14532d',
    lang: 'es',
    scope: '/',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
