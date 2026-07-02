/**
 * Sprint 1.5 — labels operativos que traducen los enums TS de los
 * campos operativos (origenIngreso, tipoEntrada, tipoPersona) a texto
 * humano corto para bandeja y detalle del dashboard.
 *
 * Se mantienen fuera del archivo del dashboard para poder testearlos
 * sin arrastrar el árbol de React/Next.
 */

/**
 * Centinela para radicados históricos sin origen ni tipo de entrada
 * registrado. NO forma parte de los enums OrigenIngreso ni TipoEntrada
 * — es solo una clave del Record que se resuelve a "Sin clasificar" en
 * la UI y en reportes MIPG.
 */
export const SIN_CLASIFICAR = 'SIN_CLASIFICAR';

export const LABEL_ORIGEN_INGRESO: Record<string, string> = {
  PQRSD_WEB_OFICIAL:          'Portal web',
  CORREO_INSTITUCIONAL:       'Correo inst.',
  VENTANILLA_FISICA:          'Ventanilla',
  ENTREGA_PRESENCIAL:         'Presencial',
  OFICIO_EXTERNO:             'Oficio ext.',
  COMUNICACION_INSTITUCIONAL: 'Com. inst.',
  OTRO:                       'Otro',
  SIN_CLASIFICAR:             'Sin clasificar',
};

export const LABEL_TIPO_ENTRADA: Record<string, string> = {
  PQRSD:                        'PQRSD',
  CORRESPONDENCIA_RECIBIDA:     'Correspondencia',
  OFICIO_INSTITUCIONAL:         'Oficio',
  SOLICITUD_CIUDADANA:          'Solicitud',
  COMUNICACION_ENTIDAD_PUBLICA: 'Ent. pública',
  COMUNICACION_INTERNA:         'Interna',
  OTRO:                         'Otro',
  SIN_CLASIFICAR:               'Sin clasificar',
};

export const LABEL_TIPO_PERSONA: Record<string, string> = {
  NATURAL:                    'Persona natural',
  JURIDICA:                   'Persona jurídica',
  ENTIDAD_PUBLICA:            'Entidad pública',
  COMUNICACION_INSTITUCIONAL: 'Com. institucional',
  NO_IDENTIFICADO:            'No identificado',
};
