export type OrigenRadicado = 'WEB' | 'FISICO_ESCANER';

export type EstadoRadicado =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'EN_PROCESO'
  | 'RESUELTO'
  | 'DEVUELTO'
  | 'RECHAZADO';

export type Prioridad = 'ROJO' | 'NARANJA' | 'AMARILLO';

export type ZonaGeografica = 'ZONA_YARIGUIES' | 'CASCO_URBANO' | 'ZONA_RURAL';

export type TenantId =
  | 'DESPACHO_ALCALDE'
  | 'SEC_GOBIERNO'
  | 'SUB_INSPECCION_POLICIA_URBANA'
  | 'SUB_INSPECCION_POLICIA_RURAL'
  | 'SUB_COMISARIA'
  | 'SUB_VICTIMAS'
  | 'SEC_PLANEACION'
  | 'SUB_SISBEN'
  | 'SUB_RIESGOS_GRD'
  | 'SEC_DESARROLLO_SOCIAL'
  | 'SUB_PROGRAMAS'
  | 'SEC_HACIENDA'
  | 'SUB_HACIENDA_YARIGUIES'
  | 'SEC_AGRICULTURA_UMATA'
  | 'VENTANILLA_UNICA';

export type AccionAuditoria =
  | 'RADICACION'
  | 'CLASIFICACION_IA'
  | 'ASIGNACION'
  | 'CAMBIO_ESTADO'
  | 'RESPUESTA_FUNCIONARIO'
  | 'DEVOLUCION'
  | 'RECLASIFICACION'
  | 'NOTIFICACION_WHATSAPP';

export interface AuditoriaEntry {
  fecha:    string;
  accion:   AccionAuditoria | string;   // string fallback for legacy entries
  actor:    string;
  nota:     string;
  metadata?: Record<string, unknown>;
}

export interface Archivo {
  nombre: string;
  url: string;
}

export interface ClasificacionIA {
  oficinaDestino: TenantId;
  emailOficial: string;
  zonaGeografica: ZonaGeografica;
  resumenCaso: string;
  mensajeOriginal: string;
}

export interface Radicado {
  radicadoId: string;
  origen: OrigenRadicado;
  fechaCreacion: string;
  estadoActual: EstadoRadicado;
  prioridad: Prioridad;
  ciudadano: {
    nombre: string;
    email: string;
    telefono: string;
  };
  clasificacionIA: ClasificacionIA | null;
  archivos: Archivo[];
  auditoria: AuditoriaEntry[];
}

/** Payload del formulario ciudadano antes de ser enriquecido por IA */
export interface FormRadicacionData {
  nombre: string;
  email: string;
  telefono: string;
  descripcion: string;
  archivo: File | null;
}

/** Respuesta del webhook al radicado satisfactoriamente */
export interface WebhookResponse {
  success: boolean;
  radicadoId: string;
}
