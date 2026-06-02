/**
 * Tipos del Flujo de Aprobación Humana — SIMI Jurídico Sprint 2
 * Colección: simi_aprobaciones_respuesta
 */

import type { NivelRiesgoJuridico } from './simi-juridico';

export type ApprovalStatus =
  | 'borrador_generado'
  | 'pendiente_revision_jefe'
  | 'pendiente_revision_juridica'
  | 'devuelto_para_ajustes'
  | 'aprobado_por_jefe'
  | 'aprobado_por_juridica'
  | 'listo_para_envio'
  | 'enviado';

export interface ApprovalHistoryItem {
  estado:       ApprovalStatus;
  usuarioId:    string;
  usuarioNombre?: string;
  rol:          string;
  fecha:        string;
  observacion?: string;
}

export interface ApprovalFlow {
  id?:                      string;
  radicadoId:               string;
  respuestaId?:             string;
  simiAuditId?:             string;
  tenantId:                 string;
  estado:                   ApprovalStatus;
  nivelRiesgo:              NivelRiesgoJuridico;
  requiereRevisionJuridica: boolean;
  motivoRevision:           string[];
  aprobadoPor?:             string;
  aprobadoPorRol?:          string;
  fechaAprobacion?:         string;
  devueltoPor?:             string;
  motivoDevolucion?:        string;
  historial:                ApprovalHistoryItem[];
  createdAt?:               string;
  updatedAt?:               string;
}

/** Resultado de crear un flujo de aprobación */
export interface ApprovalFlowResult {
  approvalId:  string;
  estado:      ApprovalStatus;
  mensaje:     string;
  requiereRevisionJuridica: boolean;
  nivelRiesgo: NivelRiesgoJuridico;
}

/** Config para determinar el estado inicial */
export interface ApprovalRules {
  nivelRiesgo:              NivelRiesgoJuridico;
  tieneDatosSensibles:      boolean;
  tieneMenoresEdad:         boolean;
  esEnteControl:            boolean;
  esTutela:                 boolean;
  esRespuestaNegativa:      boolean;
  afectaDerechosFundamentales?: boolean;
}

/** Labels para mostrar en UI */
export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  borrador_generado:             'Borrador generado',
  pendiente_revision_jefe:       'Pendiente revisión — Jefe de dependencia',
  pendiente_revision_juridica:   'Pendiente revisión — Asesor jurídico',
  devuelto_para_ajustes:         'Devuelto para ajustes',
  aprobado_por_jefe:             'Aprobado — Jefe de dependencia',
  aprobado_por_juridica:         'Aprobado — Asesor jurídico',
  listo_para_envio:              'Listo para envío',
  enviado:                       'Enviado al ciudadano',
};

export const APPROVAL_STATUS_COLOR: Record<ApprovalStatus, string> = {
  borrador_generado:             'bg-gray-100 text-gray-600 border-gray-200',
  pendiente_revision_jefe:       'bg-yellow-50 text-yellow-700 border-yellow-200',
  pendiente_revision_juridica:   'bg-red-50 text-red-700 border-red-200',
  devuelto_para_ajustes:         'bg-orange-50 text-orange-700 border-orange-200',
  aprobado_por_jefe:             'bg-blue-50 text-blue-700 border-blue-200',
  aprobado_por_juridica:         'bg-green-50 text-green-700 border-green-200',
  listo_para_envio:              'bg-[#EEF4EE] text-[#14532D] border-[#D9E2D9]',
  enviado:                       'bg-[#EEF4EE] text-[#14532D] border-[#D9E2D9]',
};
