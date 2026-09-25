import { redirect } from 'next/navigation';

/**
 * Sprint 1.5 — El formulario legacy de recepción quedó reemplazado por
 * la Radicación Rápida del modal del dashboard. Esta página redirige
 * server-side al dashboard para evitar que se llegue al flujo antiguo.
 *
 * Redirect server-side: sin flash de UI, sin dependencia de JavaScript.
 */
export default function RecepcionLegacyPage(): never {
  redirect('/interno/dashboard');
}
