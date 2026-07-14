export type OrigenRadicado = 'WEB' | 'FISICO_ESCANER';

export type EstadoRadicado =
  | 'PENDIENTE'
  | 'EN_REVISION'
  | 'EN_PROCESO'
  | 'RESUELTO'
  | 'DEVUELTO'
  | 'RECHAZADO'
  /** BM-B33 — requerimiento de subsanación notificado: activo con el término legal SUSPENDIDO. */
  | 'EN_SUBSANACION'
  /** BM-B33 — desistimiento tácito confirmado por acto motivado (cierre). */
  | 'DESISTIDO';

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
  | 'TIPO_SOLICITUD_RECLASIFICADO'
  | 'NOTIFICACION_WHATSAPP'
  | 'NOTIFICACION_CORREO_ENVIADA'
  | 'NOTIFICACION_CORREO_FALLIDA'
  | 'NOTIFICACION_OMITIDA_DUPLICADA'
  | 'NOTIFICACION_GESTIONADA_MANUALMENTE'
  /** Sprint 1.5 — el solicitante no aportó uno o más datos básicos (correo, teléfono, documento o dirección). */
  | 'DATOS_NO_APORTADOS_MARCADOS'
  /** Sprint Ventanilla Operativa 2 — la funcionaria envió la constancia de radicación al correo del solicitante. */
  | 'CONSTANCIA_ENVIADA_CORREO'
  /** Sprint Ventanilla Operativa 3 — la funcionaria generó una copia sellada de un documento PDF del radicado. */
  | 'DOCUMENTO_SELLADO'
  /** Sprint Cierre del mostrador — el ciudadano aportó posteriormente datos de contacto que faltaban. */
  | 'DATOS_COMPLETADOS'
  /** Sprint Radicación de salida — se despachó un oficio de salida amarrado a este radicado. */
  | 'OFICIO_SALIDA_REGISTRADO'
  /** BM-B33 — se emitió un requerimiento de subsanación (Ley 1755 Art. 17). */
  | 'REQUERIMIENTO_SUBSANACION'
  /** BM-B33 — el requerimiento fue notificado al ciudadano: el término se SUSPENDE. */
  | 'SUBSANACION_NOTIFICADA'
  /** BM-B33 — el ciudadano solicitó prórroga del plazo de subsanación. */
  | 'PRORROGA_SUBSANACION'
  /** BM-B33 — el ciudadano subsanó y el funcionario reactivó el término. */
  | 'SUBSANACION_RECIBIDA'
  /** BM-B33 — el cron propone desistimiento tácito (no archiva). */
  | 'DESISTIMIENTO_TACITO_PROPUESTO'
  /** BM-B33 — el funcionario confirmó el desistimiento por acto motivado. */
  | 'DESISTIMIENTO_TACITO_CONFIRMADO';

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
