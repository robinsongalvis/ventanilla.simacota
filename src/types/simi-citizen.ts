/**
 * Tipos del Portal Ciudadano — Sprint 5
 * Información pública y segura del estado de un radicado.
 */

/** Estado visible al ciudadano — no expone estados internos */
export type EstadoCiudadano =
  | 'radicado_recibido'
  | 'en_revision'
  | 'asignado_dependencia'
  | 'en_proyeccion_respuesta'
  | 'pendiente_aprobacion'
  | 'requiere_aclaracion'
  | 'trasladado'
  | 'respondido'
  | 'cerrado';

export const ESTADO_CIUDADANO_LABELS: Record<EstadoCiudadano, string> = {
  radicado_recibido:       'Solicitud recibida',
  en_revision:             'En revisión',
  asignado_dependencia:    'Asignado a dependencia',
  en_proyeccion_respuesta: 'En proyección de respuesta',
  pendiente_aprobacion:    'Pendiente de aprobación interna',
  requiere_aclaracion:     'Requiere información adicional',
  trasladado:              'Trasladado a otra entidad',
  respondido:              'Respondido',
  cerrado:                 'Cerrado',
};

export const ESTADO_CIUDADANO_DESC: Record<EstadoCiudadano, string> = {
  radicado_recibido:       'Su solicitud fue recibida correctamente y está en proceso de asignación.',
  en_revision:             'Un funcionario está revisando su solicitud.',
  asignado_dependencia:    'Su solicitud fue asignada a la dependencia competente para ser atendida.',
  en_proyeccion_respuesta: 'La dependencia está preparando la respuesta oficial.',
  pendiente_aprobacion:    'La respuesta está siendo revisada internamente antes de ser enviada.',
  requiere_aclaracion:     'Nos comunicaremos con usted para solicitar información adicional.',
  trasladado:              'Su solicitud fue trasladada a la entidad o dependencia competente para atenderla.',
  respondido:              'Su solicitud fue respondida. Puede consultar la respuesta en los canales indicados.',
  cerrado:                 'El trámite fue cerrado. Si tiene dudas, puede radicar una nueva solicitud.',
};

/** Información pública de un radicado */
export interface RadicadoPublico {
  radicadoId:           string;
  fechaRadicacion:      string;
  estadoCiudadano:      EstadoCiudadano;
  dependencia:          string;
  tipoSolicitud:        string;
  fechaVencimiento:     string;
  requiereAclaracion:   boolean;
  fueRespondido:        boolean;
  fechaRespuesta?:      string;
  canalRespuesta?:      string;
  /** Solo si ya fue enviado oficialmente */
  respuestaDisponible?: boolean;
}

/** Registro de auditoría de consultas ciudadanas */
export interface ConsultaCiudadanaLog {
  id?:            string;
  radicadoId:     string;
  tenantId:       string;
  fechaConsulta:  string;
  ipHash?:        string;
  userAgent?:     string;
  resultado:      'encontrado' | 'no_encontrado' | 'verificacion_fallida';
}
