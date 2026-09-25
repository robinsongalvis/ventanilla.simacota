import { BandejaLicenciasClient } from './components/BandejaLicenciasClient';

export const metadata = {
  title: 'Bandeja de Licencias',
};

/**
 * Pantalla 01 · Bandeja de Licencias — bloque "Integración UI y demo"
 * (ADR-0029). Cascarón Server Component (conserva `metadata` estático, no
 * disponible en Client Components) — toda la interactividad real (fetch,
 * KPIs, modal de radicación) vive en `BandejaLicenciasClient` ('use
 * client'), siguiendo el patrón "server-first, use client solo donde haga
 * falta".
 */
export default function BandejaLicenciasPage() {
  return <BandejaLicenciasClient />;
}
