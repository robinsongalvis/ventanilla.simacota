import { RedireccionLicencias } from '../components/RedireccionLicencias';

export const metadata = {
  title: 'Libro consecutivo · Licencias',
};

/**
 * Ruta antigua del Libro consecutivo. Redirige a su pestaña en el panel
 * (`/interno/dashboard?vista=licencias&seccion=libro`, ADR-0046 §7), donde
 * conserva la exportación CSV y la impresión íntegra.
 */
export default function LibroConsecutivoPage() {
  return <RedireccionLicencias seccion="LIBRO_CONSECUTIVO" />;
}
