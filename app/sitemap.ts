import type { MetadataRoute } from 'next';

const BASE_URL = 'https://ventanilla.simacota.gov.co';

/**
 * sitemap.ts — Mapa de sitio para motores de búsqueda
 *
 * Solo incluye las rutas públicas ciudadanas.
 * Las rutas /interno/* y /api/* se excluyen intencionalmente.
 *
 * Accesible en: https://ventanilla.simacota.gov.co/sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      // Página de inicio — máxima prioridad
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      // Formulario de radicación — acción principal del ciudadano
      url: `${BASE_URL}/radicacion`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      // Consulta de estado — se actualiza con cada trámite nuevo
      url: `${BASE_URL}/consulta`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
