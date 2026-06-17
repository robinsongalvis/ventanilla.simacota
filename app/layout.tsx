import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SimiProvider } from '@/lib/store/simiContext';
import { SimiChatCondicional } from '@/app/components/SimiChatCondicional';
import { PwaInstallPrompt } from '@/app/components/pwa/PwaInstallPrompt';

/* ── Base URL absoluto.
      Prioridad: NEXT_PUBLIC_SITE_URL → VERCEL_URL → dominio institucional.
      Esto es lo que hace que WhatsApp resuelva la imagen OG, porque
      necesita acceder a https://<host>/og-image.png públicamente. */
const SITE_URL_RAW =
  process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  || 'https://ventanilla-simacota.vercel.app';
const SITE_URL = SITE_URL_RAW.startsWith('http') ? SITE_URL_RAW : `https://${SITE_URL_RAW}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  // ── Template de título: las rutas hijas heredan automáticamente ──
  title: {
    default: 'Ventanilla Única Digital | Alcaldía Municipal de Simacota',
    template: '%s | Alcaldía Municipal de Simacota',
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
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  appleWebApp: {
    capable: true,
    title: 'Ventanilla Simacota',
    statusBarStyle: 'black-translucent',
  },

  // ── Canonical raíz ──────────────────────────────────────────────
  alternates: {
    canonical: '/',
  },

  // ── OpenGraph: WhatsApp, Facebook, LinkedIn ─────────────────────
  //   URLs absolutas para que WhatsApp/Telegram/Slack resuelvan la
  //   imagen previa sin ambigüedad.
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: SITE_URL,
    siteName: 'Ventanilla Única Digital – Simacota',
    title: 'Ventanilla Única Digital – Alcaldía de Simacota',
    description:
      'Radica tu solicitud ciudadana en segundos. Plataforma oficial con IA y trazabilidad total. Simacota, Santander, Colombia.',
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Ventanilla Única Digital – Alcaldía de Simacota, Santander',
        type: 'image/png',
        secureUrl: `${SITE_URL}/og-image.png`,
      },
    ],
  },

  // ── Twitter / X Card ────────────────────────────────────────────
  twitter: {
    card: 'summary_large_image',
    site: '@AlcaldiaSimacota',
    title: 'Ventanilla Única Digital – Alcaldía de Simacota',
    description:
      'Radica tu solicitud ciudadana en segundos. Plataforma oficial con IA y trazabilidad total.',
    images: [`${SITE_URL}/og-image.png`],
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

export const viewport: Viewport = {
  themeColor: '#14532d',
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
          <PwaInstallPrompt />
        </SimiProvider>
      </body>
    </html>
  );
}
