import type {
  AccionAuditoria,
  EstadoRadicado,
  OrigenRadicado,
  Prioridad,
  TenantId,
  ZonaGeografica,
} from './radicado';
import type { TipoSolicitudId, UnidadTermino } from '@/lib/tiempos-radicado';

export type TipoPersona = 'NATURAL' | 'JURIDICA';
export type TipoDocumento = 'CC' | 'CE' | 'NIT' | 'PASAPORTE' | 'OTRO';
export type MedioRecepcion = 'OFICIO_FISICO' | 'EMAIL' | 'WEB' | 'PRESENCIAL';

export interface UbicacionSolicitante {
  pais: string;
  departamento: string;
  municipio: string;
}

export interface SolicitanteRadicado {
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombreCompleto: string;
  razonSocial?: string | null;
  /** Null cuando el solicitante no proveyó el dato (Firestore no acepta undefined) */
  email?: string | null;
  /** Null cuando el solicitante no proveyó el dato (Firestore no acepta undefined) */
  telefono?: string | null;
  /** Null cuando el solicitante no proveyó el dato (Firestore no acepta undefined) */
  direccion?: string | null;
  ubicacion: UbicacionSolicitante;
}

export interface ControlRadicacion {
  radicadoId: string;
  consecutivo: number;
  fechaRadicado: string;
  horaRadicado: string;
  medioRecepcion: MedioRecepcion;
  origen: OrigenRadicado;
}

export interface TerminoLegal {
  tipoSolicitudId: TipoSolicitudId;
  tipoSolicitudNombre: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
  fechaVencimiento: string;
  prorrogasAplicadas: number;
}

export interface ArchivoRadicado {
  nombre: string;
  url?: string | null;
  path: string;
  tipo: string;
  tamanioKB: number;
  orden: number;
}

export interface TrazabilidadRadicado {
  eventoId?: string;
  fecha: string;
  accion: AccionAuditoria | 'TRASLADO' | 'PRORROGA';
  actorUid: string;
  actorNombre: string;
  oficinaOrigen?: TenantId;
  oficinaDestino?: TenantId;
  funcionarioDestinoUid?: string;
  nota: string;
  metadata?: Record<string, unknown>;
}

export interface AnalisisIA {
  resumenEjecutivo:       string;
  etiquetasSemanticas:    string[];
  dependenciaSugerida:    TenantId;
  confianzaClasificacion: number; // 0.0 a 1.0
  fechaAnalisis:          string;
  promptVersion?:         string;
}

export interface FeedbackIA {
  usuarioId:        string;
  actorNombre:      string;
  puntuacion:       'POSITIVO' | 'CORREGIDO' | 'NEGATIVO'; // 👍, ✏️, ❌
  motivoCorreccion?: string | null;
  fecha:            string;
}

export interface RespuestaOficial {
  /** Ruta en Storage: respuestas/{radicadoId}/{timestamp_filename} */
  archivoPath:   string;
  archivoNombre: string;
  nota:          string;
  fecha:         string;        // ISO
  actorUid:      string;
  actorNombre:   string;
}

export interface VentanillaRadicado {
  radicadoId: string;
  estadoActual: EstadoRadicado | 'ASIGNADO' | 'POR_VENCER' | 'VENCIDO' | 'PRORROGA';
  ultimaActualizacion: string;
  prioridad: Prioridad;
  solicitante: SolicitanteRadicado;
  control: ControlRadicacion;
  termino: TerminoLegal;
  clasificacion: {
    oficinaDestino: TenantId;
    funcionarioResponsableUid?: string;
    zonaGeografica: ZonaGeografica;
  };
  detalle: {
    asunto: string;
    descripcion: string;
    numeroFolios: number;
    /** Null cuando no se especificaron anexos (Firestore no acepta undefined) */
    anexosDescripcion?: string | null;
  };
  archivos: ArchivoRadicado[];
  analisisIa?:       AnalisisIA;
  feedbackIa?:       FeedbackIA;
  respuestaOficial?: RespuestaOficial | null;
}


export interface UsuarioInterno {
  uid: string;
  email: string;
  nombre: string;
  rol: 'ADMIN' | 'FUNCIONARIO' | 'RECEPCIONISTA' | 'JEFE_DEPENDENCIA' | 'CONTROL_INTERNO';
  tenantId: TenantId;
  activo: boolean;
}

export interface AuditoriaOverride {
  auditoriaId: string;
  radicadoId: string;
  timestamp: string;
  promptVersion: string;
  clasificacionOriginal?: string | null;
  clasificacionFinal?: string | null;
  confianzaIA?: number | null;
  resumenIA?: string | null;
  resumenEditado?: string | null;
  etiquetasIA: string[];
  etiquetasFinales: string[];
  accionFuncionario: 'MODIFICADO' | 'ACEPTADO';
  motivoCorreccion: string;
}
