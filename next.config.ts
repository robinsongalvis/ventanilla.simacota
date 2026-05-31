import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {};

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
