/* ══════════════════════════════════════════════════════════════
   Rutas de Licencias dentro del panel (ADR-0046 §7, armazón único).

   Licencias vive en el panel interno, con el mismo menú, encabezado,
   barra móvil y selector de tema que el resto. Su dirección canónica es
   `/interno/dashboard?vista=licencias[&expediente={id}|&seccion=libro]`:
   así un enlace directo, recargar la página y los botones atrás/adelante
   del navegador llevan a la misma pantalla.

   Las rutas antiguas (`/interno/licencias`, `/interno/licencias/{id}` y
   `/interno/licencias/libro-consecutivo`) siguen funcionando: redirigen
   aquí (correos ya enviados, marcadores, enlaces guardados).

   Único lugar que arma o lee estas direcciones (Principio 3).
══════════════════════════════════════════════════════════════ */

export type SeccionLicencias = 'BANDEJA' | 'LIBRO_CONSECUTIVO';

/** A qué pantalla de Licencias se va. Un expediente tiene prioridad sobre la sección. */
export interface DestinoLicencias {
  expedienteId?: string | null;
  seccion?: SeccionLicencias;
}

const PARAM_VISTA = 'vista';
const VALOR_VISTA = 'licencias';
const PARAM_EXPEDIENTE = 'expediente';
const PARAM_SECCION = 'seccion';
const VALOR_SECCION_LIBRO = 'libro';

/** Parámetros propios de Licencias: se quitan al salir de la vista. */
export const PARAMETROS_LICENCIAS: readonly string[] = [PARAM_VISTA, PARAM_EXPEDIENTE, PARAM_SECCION];

/** Dirección canónica de una pantalla de Licencias. */
export function urlLicencias(destino: DestinoLicencias = {}): string {
  const parametros = new URLSearchParams({ [PARAM_VISTA]: VALOR_VISTA });
  if (destino.expedienteId) {
    parametros.set(PARAM_EXPEDIENTE, destino.expedienteId);
  } else if (destino.seccion === 'LIBRO_CONSECUTIVO') {
    parametros.set(PARAM_SECCION, VALOR_SECCION_LIBRO);
  }
  return `/interno/dashboard?${parametros.toString()}`;
}

/** Lee de la dirección si se está en Licencias y en qué pantalla. */
export function leerDestinoLicencias(parametros: Pick<URLSearchParams, 'get'>): {
  activa: boolean;
  expedienteId: string | null;
  seccion: SeccionLicencias;
} {
  return {
    activa: parametros.get(PARAM_VISTA) === VALOR_VISTA,
    expedienteId: parametros.get(PARAM_EXPEDIENTE) || null,
    seccion: parametros.get(PARAM_SECCION) === VALOR_SECCION_LIBRO ? 'LIBRO_CONSECUTIVO' : 'BANDEJA',
  };
}
