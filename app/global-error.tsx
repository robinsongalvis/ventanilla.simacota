'use client';

/**
 * Frontera de error GLOBAL del App Router: atrapa lo que revienta por
 * encima de los ErrorBoundary de página (layout raíz incluido) — el caso
 * en que el ciudadano ve la aplicación caerse entera.
 *
 * Reporta a Sentry (no-op sin DSN) y muestra un mensaje institucional en
 * español con salida de reintento. Sin detalles técnicos en pantalla: el
 * detalle va a la observabilidad, no al ciudadano.
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F8FAF7', margin: 0 }}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ color: '#14532D', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            El sistema tuvo un problema inesperado
          </h1>
          <p style={{ color: '#667085', maxWidth: '28rem', fontSize: '0.9rem' }}>
            El error ya quedó registrado para el equipo técnico. Puede intentar de nuevo;
            si persiste, comuníquese con la Alcaldía de Simacota.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.25rem',
              padding: '0.6rem 1.4rem',
              borderRadius: '10px',
              border: 'none',
              background: '#14532D',
              color: '#FFFFFF',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
