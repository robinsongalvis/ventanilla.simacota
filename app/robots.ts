import type { MetadataRoute } from 'next';

const BASE_URL = 'https://ventanilla.simacota.gov.co';

/**
 * robots.ts — Directivas de rastreo para motores de búsqueda
 *
 * Rutas PERMITIDAS:  / · /radicacion · /consulta
 * Rutas BLOQUEADAS:  /interno/* · /api/* · /seed/*
 *
 * Accesible en: https://ventanilla.simacota.gov.co/robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/radicacion', '/consulta'],
        disallow: [
          '/interno/',   // Panel de funcionarios — privado
          '/api/',       // Endpoints de API — no indexar
          '/seed/',      // Herramienta de datos iniciales — privado
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
