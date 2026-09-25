import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://firebasestorage.googleapis.com https://storage.googleapis.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://generativelanguage.googleapis.com https://*.ingest.sentry.io https://vercel.live wss://*.firebaseio.com",
  "frame-src 'self' https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  /*
   * Silent build si SENTRY_AUTH_TOKEN no está configurado.
   * Útil para builds locales o PRs que no necesitan subir source maps.
   */
  silent: !process.env.SENTRY_AUTH_TOKEN,

  /*
   * Organización y proyecto en Sentry.
   * Configurar SENTRY_ORG y SENTRY_PROJECT como env vars
   * solo si se quiere subir source maps en CI/CD.
   */
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  /*
   * No subir source maps automáticamente a menos que
   * SENTRY_AUTH_TOKEN esté configurado.
   */
  authToken: process.env.SENTRY_AUTH_TOKEN,

  automaticVercelMonitors: false,
});
