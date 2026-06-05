import type { Metadata } from 'next';
import './globals.css';
import { SimiProvider } from '@/lib/store/simiContext';
import { SimiChatCondicional } from '@/app/components/SimiChatCondicional';

export const metadata: Metadata = {
  // ── Base URL — obligatorio para que los OG relativos funcionen ──
  metadataBase: new URL('https://ventanilla.simacota.gov.co'),

  // ── Template de título: las rutas hijas heredan automáticamente ──
  title: {
    default: 'Ventanilla Única Digital – Alcaldía de Simacota',
    template: '%s | Ventanilla Única · Simacota',
  },

  // ── Descripción optimizada para snippet de Google (≤160 chars) ──
  description:
    'Radica y consulta tu solicitud ciudadana en línea desde cualquier lugar. ' +
    'Plataforma oficial de la Alcaldía Municipal de Simacota, Santander, con ' +
    'trazabilidad total y clasificación inteligente.',

  // ── Keywords hiperlocales (Simacota + Zona Yariguíes) ───────────
  keywords: [
    'Ventanilla Única Digital',
    'Simacota',
    'Alcaldía Simacota',
    'Santander',
    'radicación solicitudes',
    'trámites municipales',
    'Zona Yariguíes',
    'gobierno digital Colombia',
  ],

  // ── Atribución ──────────────────────────────────────────────────
  authors: [{ name: 'Alcaldía Municipal de Simacota' }],
  creator: 'Alcaldía Municipal de Simacota',
  publisher: 'Alcaldía Municipal de Simacota',

  // ── Canonical raíz ──────────────────────────────────────────────
  alternates: {
    canonical: '/',
  },

  // ── OpenGraph: WhatsApp, Facebook, LinkedIn ─────────────────────
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: '/',
    siteName: 'Ventanilla Única Digital – Simacota',
    title: 'Ventanilla Única Digital – Alcaldía de Simacota',
    description:
      'Radica tu solicitud ciudadana en segundos. Plataforma oficial con IA y trazabilidad total. Simacota, Santander, Colombia.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Ventanilla Única Digital – Alcaldía de Simacota, Santander',
        type: 'image/png',
      },
    ],
  },

  // ── Twitter / X Card ────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    title: 'Ventanilla Única Digital – Alcaldía de Simacota',
    description:
      'Radica tu solicitud ciudadana en segundos. Plataforma oficial con IA y trazabilidad total.',
    images: ['/og-image.png'],
  },

  // ── Directivas de indexación ────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full"
    >
      <body className="min-h-full antialiased">
        <SimiProvider>
          {children}
          <SimiChatCondicional />
        </SimiProvider>
      </body>
    </html>
  );
}
