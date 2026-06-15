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

export type TipoPresentacionPqrsd = 'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA';

export type CanalRespuesta = 'CORREO' | 'PRESENCIAL' | 'TELEFONO' | 'DIRECCION_FISICA';

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
  | 'NOTIFICACION_WHATSAPP'
  | 'NOTIFICACION_CORREO_ENVIADA'
  | 'NOTIFICACION_CORREO_FALLIDA'
  | 'NOTIFICACION_OMITIDA_DUPLICADA'
  | 'NOTIFICACION_GESTIONADA_MANUALMENTE';

export interface AuditoriaEntry {
  fecha:    string;
  accion:   AccionAuditoria | string;   // string fallback for legacy entries
  actor:    string;
  nota:     string;
  metadata?: Record<string, unknown>;
}

export interface Archivo {
  nombre: string;
  url?: string | null;
  path?: string | null;
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
    direccion?: string;
  };
  clasificacionIA: ClasificacionIA | null;
  archivos: Archivo[];
  auditoria: AuditoriaEntry[];
  tipoSolicitudId?: string;
  tipoSolicitudNombre?: string;
  tipoPresentacion?: TipoPresentacionPqrsd;
  esAnonimo?: boolean;
  identidadReservada?: boolean;
  canalRespuesta?: CanalRespuesta;
}

/** Payload del formulario ciudadano antes de ser enriquecido por IA */
export interface FormRadicacionData {
  nombre: string;
  email: string;
  telefono: string;
  descripcion: string;
  archivo: File | null;
}
