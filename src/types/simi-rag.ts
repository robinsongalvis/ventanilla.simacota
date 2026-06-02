/**
 * Tipos del Módulo RAG Jurídico — SIMI Jurídico Sprint 2
 * Colección: simi_rag_consultas
 */

import type { NormativeDocumentStatus, NormativeConfidenceLevel } from './simi-normograma';

export interface RagSource {
  id:              string;
  titulo:          string;
  tipo_norma:      string;
  estado:          NormativeDocumentStatus;
  nivel_confianza: NormativeConfidenceLevel;
  resumen?:        string;
  aplicabilidad?:  string;
  /** true si puede citarse como fundamento directo */
  citableComo:     'fundamento_directo' | 'referencia_sujeta_validacion' | 'no_citable';
}

export interface LegalContextResult {
  fuentesValidadas:  RagSource[];
  fuentesPendientes: RagSource[];
  contexto:          string;
  advertencias:      string[];
  totalEncontradas:  number;
}

export interface RagQueryParams {
  tenantId:        string;
  query:           string;
  tema?:           string[];
  dependencia?:    string;
  tipoSolicitud?:  string;
  modo?:           string;
  maxResults?:     number;
}

export interface RagQueryRecord {
  id?:                    string;
  radicadoId?:            string;
  tenantId:               string;
  usuarioId:              string;
  query:                  string;
  coleccionesConsultadas: string[];
  documentosEncontrados:  number;
  documentosUsados:       number;
  fuentesUsadas:          RagSource[];
  createdAt:              string;
}

/** Resultado completo del generador con RAG */
export interface RagGenerationResult {
  fuentesUsadas:     RagSource[];
  fuentesPendientes: RagSource[];
  advertencias:      string[];
  usedRag:           boolean;
}

/** Validación de si una norma puede citarse */
export interface NormativeValidation {
  canCite: boolean;
  reason:  string;
  warning?: string;
}
