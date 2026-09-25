import { DetalleLicenciaClient } from './DetalleLicenciaClient';

type ParamsPromise = Promise<{ expedienteId: string }>;

export const metadata = {
  title: 'Detalle de expediente · Licencias',
};

/**
 * Pantalla 02 · Detalle de Expediente — bloque "Integración UI y demo"
 * (ADR-0029). Cascarón Server Component: SOLO resuelve `params` (Next 16:
 * promesa — ver node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/page.md) y lo pasa al Client Component real
 * (`DetalleLicenciaClient`, 'use client'), que hace el fetch por id + las
 * acciones (registrar acta/respuesta) contra el contrato real.
 *
 * El título ya no es dinámico por número de expediente (antes venía de
 * `detalleLicencia()` sobre fixtures locales, sin I/O): generar un título
 * dinámico real exigiría duplicar aquí la misma consulta a Firestore que
 * ya hace `GET /api/licencias/expedientes/{id}` — fuera de los límites de
 * este rol (no se reimplementan lecturas de Firestore en una página; se
 * consume el endpoint ya expuesto, que es justo lo que hace el Client
 * Component de abajo).
 */
export default async function DetalleLicenciaPage({ params }: { params: ParamsPromise }) {
  const { expedienteId } = await params;
  return <DetalleLicenciaClient expedienteId={expedienteId} />;
}
