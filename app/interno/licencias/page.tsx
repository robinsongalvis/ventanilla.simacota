import { RedireccionLicencias } from './components/RedireccionLicencias';

export const metadata = {
  title: 'Bandeja de Licencias',
};

/**
 * Ruta antigua de la Bandeja de Licencias. Licencias vive en el panel
 * interno con el mismo armazón que el resto (ADR-0046 §7): esta dirección
 * se conserva para enlaces guardados y correos ya enviados, y redirige a
 * `/interno/dashboard?vista=licencias`.
 */
export default function BandejaLicenciasPage() {
  return <RedireccionLicencias />;
}
