/* ══════════════════════════════════════════════════════════════
   Pieza angular (P2.1) — contrato FormData tipado compartido (deuda DT-4).

   Fase 2 (`app/api/radicacion/interna/route.ts`) leyó los campos del
   multipart con strings literales. Fase 3 (docs/CRONOGRAMA_PIEZA_ANGULAR.md
   §FASE 3) introduce un SEGUNDO consumidor de ese contrato — el cliente del
   endpoint (`lib/recepcion/radicar-interna-cliente.ts`) — así que el nombre
   de cada campo pasa a vivir en un único lugar: si cambia aquí, cambia a la
   vez en quien arma el FormData y en quien lo lee. Reemplazo MECÁNICO de
   los strings del endpoint por estas constantes: cero cambio de
   comportamiento (mismos nombres, mismo orden de validación).

   Deliberadamente NO incluye los campos de ESTADO que el endpoint ignora a
   propósito (consecutivo, radicadoId, estadoActual, esAnonimo,
   identidadReservada, tenantId, control.*, cumplioTermino,
   prorrogasAplicadas, consultaTokenHash, ultimaActualizacion) — ver
   `__tests__/radicacion-interna-anti-forja.test.ts`. Ese es el punto: el
   contrato solo describe la ENTRADA legítima.
══════════════════════════════════════════════════════════════ */

/** Nombres de campo del `multipart/form-data` que espera
 *  `POST /api/radicacion/interna`. Único origen de verdad para quien arma
 *  el FormData (cliente) y quien lo lee (endpoint). */
export const CAMPOS_RADICACION_INTERNA = {
  tipoSolicitudId: 'tipoSolicitudId',
  tipoPresentacion: 'tipoPresentacion',
  canalRespuesta: 'canalRespuesta',
  tipoPersona: 'tipoPersona',
  tipoDocumento: 'tipoDocumento',
  medioRecepcion: 'medioRecepcion',
  origenIngreso: 'origenIngreso',
  tipoEntrada: 'tipoEntrada',
  oficinaDestino: 'oficinaDestino',
  nombreCompleto: 'nombreCompleto',
  numeroDocumento: 'numeroDocumento',
  email: 'email',
  telefono: 'telefono',
  telefonoMovil: 'telefonoMovil',
  telefonoFijo: 'telefonoFijo',
  direccion: 'direccion',
  pais: 'pais',
  departamento: 'departamento',
  municipio: 'municipio',
  barrio: 'barrio',
  asunto: 'asunto',
  descripcion: 'descripcion',
  numeroFolios: 'numeroFolios',
  numeroAnexos: 'numeroAnexos',
  anexosDescripcion: 'anexosDescripcion',
  observacionesAnexos: 'observacionesAnexos',
  areaResponsable: 'areaResponsable',
  noAportaDocumento: 'noAportaDocumento',
  noAportaCorreo: 'noAportaCorreo',
  noAportaTelefono: 'noAportaTelefono',
  noAportaDireccion: 'noAportaDireccion',
  /** Campo repetible: un `formData.append(archivos, file)` por adjunto. */
  archivos: 'archivos',
} as const;

/** Respuesta 200 del endpoint. */
export interface RespuestaRadicacionInternaOk {
  ok: true;
  radicadoId: string;
  consecutivo: number;
  archivosSubidos: number;
}

/** Respuesta de error (400/401/403/429/500). `errores` solo viaja en 400
 *  (lista de validaciones incumplidas); el resto trae únicamente `error`. */
export interface RespuestaRadicacionInternaError {
  error: string;
  errores?: string[];
}

export type RespuestaRadicacionInterna =
  | RespuestaRadicacionInternaOk
  | RespuestaRadicacionInternaError;
