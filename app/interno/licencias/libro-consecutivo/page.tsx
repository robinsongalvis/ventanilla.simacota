import Link from 'next/link';
import { LibroConsecutivoClient } from '../components/LibroConsecutivoClient';

export const metadata = {
  title: 'Libro consecutivo · Licencias',
};

/**
 * Pantalla del Libro Consecutivo — Bloque C ("el reemplazo funcional del
 * Excel"). Cascarón Server Component (conserva `metadata` estático, no
 * disponible en Client Components) — toda la interactividad real (fetch,
 * selector de año, export CSV, impresión) vive en `LibroConsecutivoClient`
 * ('use client'), mismo patrón "server-first" que `page.tsx` de la Bandeja.
 *
 * El enlace "← Bandeja de Licencias" es exclusivo de esta ruta standalone
 * (deep-link): la sub-pestaña embebida de `VistaLicencias` no lo repite —
 * ahí volver a la Bandeja es cambiar de pestaña, no navegar. Va con
 * `print:hidden`: al imprimir el libro no debe salir un enlace de
 * navegación en el papel.
 */
export default function LibroConsecutivoPage() {
  return (
    <div className="flex flex-col">
      <div className="px-4 md:px-6 pt-4 print:hidden">
        <Link
          href="/interno/licencias"
          className="inline-flex items-center gap-1.5 text-sm font-medium rounded focus-visible:outline-none focus-visible:ring-2"
          style={{ color: '#14532D' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Bandeja de Licencias
        </Link>
      </div>
      <LibroConsecutivoClient />
    </div>
  );
}
