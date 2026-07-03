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

export type TipoPersona =
  | 'NATURAL'
  | 'JURIDICA'
  | 'ENTIDAD_PUBLICA'
  | 'COMUNICACION_INSTITUCIONAL'
  | 'NO_IDENTIFICADO';

export type TipoDocumento = 'CC' | 'CE' | 'NIT' | 'PASAPORTE' | 'OTRO';
export type MedioRecepcion = 'OFICIO_FISICO' | 'EMAIL' | 'WEB' | 'PRESENCIAL';
/** Canal por el que el ciudadano prefiere recibir la respuesta */
export type CanalRespuesta = 'CORREO' | 'PRESENCIAL' | 'TELEFONO' | 'DIRECCION_FISICA';

/**
 * Sprint Ventanilla Operativa 1 — clasificación operativa del ingreso.
 * `origenIngreso` describe POR DÓNDE llegó la solicitud; `tipoEntrada`
 * describe QUÉ es lo que llegó. Ambos son opcionales para compatibilidad
 * con radicados históricos.
 */
export type OrigenIngreso =
  | 'PQRSD_WEB_OFICIAL'
  | 'CORREO_INSTITUCIONAL'
  | 'VENTANILLA_FISICA'
  | 'ENTREGA_PRESENCIAL'
  | 'OFICIO_EXTERNO'
  | 'COMUNICACION_INSTITUCIONAL'
  | 'OTRO';

export type TipoEntrada =
  | 'PQRSD'
  | 'CORRESPONDENCIA_RECIBIDA'
  | 'OFICIO_INSTITUCIONAL'
  | 'SOLICITUD_CIUDADANA'
  | 'COMUNICACION_ENTIDAD_PUBLICA'
  | 'COMUNICACION_INTERNA'
  | 'OTRO';

/**
 * Registra explícitamente qué datos NO aportó el solicitante. Permite
 * radicar sin inventar información y deja evidencia auditable de las
 * decisiones de Ventanilla.
 */
export interface DatosNoAportados {
  documento?: boolean;
  telefono?: boolean;
  correo?: boolean;
  direccion?: boolean;
}

export interface UbicacionSolicitante {
  pais: string;
  departamento: string;
  municipio: string;
  /** Barrio opcional para radicación de correspondencia y comunicaciones. */
  barrio?: string | null;
}

export interface SolicitanteRadicado {
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombreCompleto: string;
  razonSocial?: string | null;
  /** Null cuando el solicitante no proveyó el dato (Firestore no acepta undefined) */
  email?: string | null;
  /**
   * @deprecated Usar `telefonoMovil` / `telefonoFijo` en radicados nuevos.
   * Se mantiene para compatibilidad con radicados históricos.
   */
  telefono?: string | null;
  /** Sprint Ventanilla Operativa 1 — teléfono móvil separado. */
  telefonoMovil?: string | null;
  /** Sprint Ventanilla Operativa 1 — teléfono fijo separado. */
  telefonoFijo?: string | null;
  /** Null cuando el solicitante no proveyó el dato (Firestore no acepta undefined) */
  direccion?: string | null;
  ubicacion: UbicacionSolicitante;
  /**
   * Sprint Ventanilla Operativa 1 — registra explícitamente qué datos NO
   * aportó el solicitante. Ausencia = todos aportados (o histórico previo
   * al sprint).
   */
  datosNoAportados?: DatosNoAportados;
}

export interface ControlRadicacion {
  radicadoId: string;
  consecutivo: number;
  fechaRadicado: string;
  horaRadicado: string;
  medioRecepcion: MedioRecepcion;
  origen: OrigenRadicado;
  /** Sprint Ventanilla Operativa 1 — origen operativo ampliado. */
  origenIngreso?: OrigenIngreso;
  /** Sprint Ventanilla Operativa 1 — clasificación del tipo de entrada. */
  tipoEntrada?: TipoEntrada;
}

export interface TerminoLegal {
  tipoSolicitudId: TipoSolicitudId;
  tipoSolicitudNombre: string;
  diasRespuesta: number;
  unidad: UnidadTermino;
  fechaVencimiento: string;
  prorrogasAplicadas: number;
}

/**
 * Sprint Ventanilla Operativa 3 — copia sellada de un archivo del
 * radicado. El archivo original NUNCA se modifica; esta estructura
 * apunta a la copia estampada guardada en `sellados/{radicadoId}/`.
 */
export interface SelloDocumento {
  /** Path en Storage de la copia sellada. */
  path: string;
  /** Nombre del archivo sellado (con prefijo/timestamp). */
  nombre: string;
  tamanioKB: number;
  /** Fecha ISO del sellado. */
  fecha: string;
  /** UID del funcionario que disparó el sellado. */
  actorUid: string;
  /** SHA-256 hex del archivo original (cadena de custodia). */
  hashOriginal: string;
  /** SHA-256 hex de la copia sellada (cadena de custodia). */
  hashSellado: string;
  paginasEstampadas: number;
}

export interface ArchivoRadicado {
  nombre: string;
  url?: string | null;
  path: string;
  tipo: string;
  tamanioKB: number;
  orden: number;
  /** Sprint Ventanilla Operativa 3 — copia sellada, si existe. */
  sellado?: SelloDocumento | null;
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
  /** Ruta en Storage: respuestas/{radicadoId}/{timestamp_filename}. Null cuando la respuesta no incluye PDF firmado. */
  archivoPath:   string | null;
  /** Nombre del PDF firmado. Null cuando la respuesta no incluye archivo. */
  archivoNombre: string | null;
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
  /** SHA-256 del código de consulta. El token original solo se entrega al radicar. */
  consultaTokenHash?: string;
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
    /** Sprint Ventanilla Operativa 1 — número de anexos entregados. */
    numeroAnexos?: number;
    /** Sprint Ventanilla Operativa 1 — observaciones sobre los anexos. */
    observacionesAnexos?: string | null;
  };
  archivos: ArchivoRadicado[];
  analisisIa?:       AnalisisIA;
  feedbackIa?:       FeedbackIA;
  respuestaOficial?: RespuestaOficial | null;
  /**
   * Bandera de alerta visual para el dashboard: indica que al menos un correo
   * institucional asociado a este radicado falló y aún no fue gestionado por
   * canal alternativo. Se pone en `true` al persistir un evento
   * `NOTIFICACION_CORREO_FALLIDA` y solo se baja a `false` cuando un
   * funcionario marca explícitamente la notificación como gestionada.
   */
  alertaNotificacionFallida?: boolean;
  /**
   * Sprint Cierre del mostrador — true cuando la constancia de radicación
   * ya fue enviada al correo del solicitante. La escribe el endpoint
   * enviar-constancia tras el envío exitoso; ausente = no enviada.
   * Alimenta el pendiente "Constancia sin enviar" del mostrador.
   */
  constanciaEnviadaCorreo?: boolean;
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
