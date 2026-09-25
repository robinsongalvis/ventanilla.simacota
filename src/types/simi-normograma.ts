/**
 * Tipos del Normograma — SIMI Jurídico Sprint 2
 * Colecciones: normatividad_municipal, normatividad_nacional, plantillas_respuesta
 */

export type NormativeDocumentStatus =
  | 'vigente'
  | 'parcialmente_vigente'
  | 'derogada'
  | 'pendiente_verificacion'
  | 'interna_validada'
  | 'interna_no_validada';

export type NormativeDocumentType =
  | 'Constitución'
  | 'Ley'
  | 'Decreto'
  | 'Resolución'
  | 'Circular'
  | 'Acuerdo'
  | 'Manual'
  | 'Procedimiento'
  | 'TRD'
  | 'Política'
  | 'Acto administrativo'
  | 'Concepto'
  | 'Jurisprudencia'
  | 'Otro';

export type NormativeConfidenceLevel = 'alto' | 'medio' | 'bajo';

export interface NormativeDocument {
  id:                    string;
  titulo:                string;
  tipo_norma:            NormativeDocumentType;
  numero?:               string;
  anio?:                 string;
  entidad_emisora:       string;
  fecha_expedicion?:     string;
  fecha_vigencia?:       string;
  estado:                NormativeDocumentStatus;
  tema:                  string[];
  dependencia_relacionada: string[];
  resumen?:              string;
  /** Texto completo o extracto para búsqueda */
  contenido?:            string;
  archivo_url?:          string;
  fuente?:               string;
  url_fuente?:           string;
  palabras_clave:        string[];
  nivel_confianza:       NormativeConfidenceLevel;
  validado_por?:         string;
  fecha_validacion?:     string;
  /** Para normatividad municipal — scope del tenant */
  tenantId?:             string;
  createdAt?:            string;
  updatedAt?:            string;
}

export interface ResponseTemplate {
  id:                       string;
  nombre:                   string;
  dependencia:              string;
  tipo_solicitud:           string;
  modo_simi:                string;
  riesgo_aplicable:         'bajo' | 'medio' | 'alto' | 'todos';
  contenido:                string;
  variables:                string[];   // p.ej. ['{{radicadoId}}', '{{ciudadano}}']
  estado:                   'activa' | 'inactiva' | 'pendiente_validacion';
  version:                  string;
  requiere_revision_juridica: boolean;
  validado_por?:            string;
  fecha_validacion?:        string;
  tenantId:                 string;
  createdAt?:               string;
  updatedAt?:               string;
}
