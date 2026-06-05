'use client';

/**
 * SimiChatCondicional — Renderiza SimiChat solo en rutas públicas.
 *
 * El chat ciudadano no debe aparecer en el panel interno (/interno/*),
 * donde interferiría con el dashboard administrativo en móvil.
 */

import { usePathname } from 'next/navigation';
import { SimiChat } from '@/app/components/ai/SimiChat';

/** Prefijos de ruta donde el chat ciudadano NO debe aparecer */
const RUTAS_INTERNAS = ['/interno', '/admin', '/dashboard'];

export function SimiChatCondicional() {
  const pathname = usePathname();

  const esRutaInterna = RUTAS_INTERNAS.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (esRutaInterna) return null;

  return <SimiChat />;
}
