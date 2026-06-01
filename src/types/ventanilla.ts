import type {
  AccionAuditoria,
  EstadoRadicado,
  OrigenRadicado,
  Prioridad,
  TenantId,
  ZonaGeografica,
} from './radicado';
import type { TipoSolicitudId, UnidadTermino } from '@/lib/tiempos-radicado';
// type-only import — erased en runtime, seguro desde shared types
import type { RolInterno } from '@/lib/hooks/useAuth';

export type TipoPersona = 'NATURAL' | 'JURIDICA';
export type TipoDocumento = 'CC' | 'CE' | 'NIT' | 'PASAPORTE' | 'OTRO';
export type MedioRecepcion = 'OFICIO_FISICO' | 'EMAIL' | 'WEB' | 'PRESENCIAL';
/** Canal por el que el ciudadano prefiere recibir la respuesta */
export type CanalRespuesta = 'CORREO' | 'PRESENCIAL' | 'TELEFONO' | 'DIRECCION_FISICA';

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

/**
 * MIPG-2 — Snapshot inmutable del responsable funcional asignado.
 *
 * Los campos `funcionarioResponsable*` se capturan en el momento exacto de
 * la asignación y NO se actualizan si el usuario cambia de nombre, cargo o rol.
 * Esto garantiza la evidencia histórica requerida por MIPG.
 *
 * Compatibilidad hacia atrás: radicados anteriores solo tienen `funcionarioResponsableUid`.
 * El sistema los muestra como "No registrado (ver trazabilidad)".
 */
export interface ClasificacionRadicado {
  oficinaDestino:   TenantId;
  zonaGeografica:   ZonaGeografica;

  /** UID técnico de Firebase Auth — referencia permanente */
  funcionarioResponsableUid?:     string;
  /** Nombre completo al momento de la asignación */
  funcionarioResponsableNombre?:  string;
  /** Email institucional al momento de la asignación */
  funcionarioResponsableEmail?:   string;
  /** Rol bajo el que actuó */
  funcionarioResponsableRol?:     RolInterno;
  /** Cargo adicional si aplica (campo opcional en el perfil) */
  funcionarioResponsableCargo?:   string;
  /** ISO timestamp del momento exacto de la asignación del responsable */
  fechaAsignacionResponsable?:    string;
}

export interface VentanillaRadicado {
  radicadoId: string;
  estadoActual: EstadoRadicado | 'ASIGNADO' | 'POR_VENCER' | 'VENCIDO' | 'PRORROGA';
  ultimaActualizacion: string;
  prioridad: Prioridad;
  /**
   * MIPG — Requisito 8: evidencia de cumplimiento de término legal.
   *
   * Se persiste en Firestore al momento de resolver el radicado:
   *   true  → respondido dentro del plazo legal (incluyendo prórrogas)
   *   false → respondido fuera del plazo legal
   *   null/undefined → radicado aún activo, no resuelto
   *
   * Este valor es inmutable una vez escrito; el auditor de Control Interno
   * puede consultarlo en cualquier momento, incluso años después.
   */
  cumplioTermino?: boolean | null;
  /** PQRSD: solicitud presentada de forma anónima (Ley 1755/2015 art. 14) */
  esAnonimo?: boolean;
  /** PQRSD: presentación identificada, anónima o con identidad reservada */
  tipoPresentacion?: 'IDENTIFICADA' | 'ANONIMA' | 'RESERVADA';
  /** PQRSD: datos personales protegidos en vistas no autorizadas */
  identidadReservada?: boolean;
  /** Canal de respuesta preferido por el ciudadano */
  canalRespuesta?: CanalRespuesta | null;
  solicitante: SolicitanteRadicado;
  control: ControlRadicacion;
  termino: TerminoLegal;
  clasificacion: ClasificacionRadicado;
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
