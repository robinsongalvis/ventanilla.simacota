import { RedireccionLicencias } from '../components/RedireccionLicencias';

type ParamsPromise = Promise<{ expedienteId: string }>;

export const metadata = {
  title: 'Detalle de expediente · Licencias',
};

/**
 * Ruta antigua del detalle de un expediente (enlaces guardados, correos
 * ya enviados). Redirige a su dirección canónica en el panel
 * (`/interno/dashboard?vista=licencias&expediente={id}`, ADR-0046 §7).
 * `params` es una promesa en Next 16.
 */
export default async function DetalleLicenciaPage({ params }: { params: ParamsPromise }) {
  const { expedienteId } = await params;
  return <RedireccionLicencias expedienteId={expedienteId} />;
}
