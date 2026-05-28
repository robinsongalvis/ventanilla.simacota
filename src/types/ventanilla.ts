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
  razonSocial?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
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
  url: string;
  path: string;
  tipo: string;
  tamanioKB: number;
  orden: number;
}

export interface TrazabilidadRadicado {
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

export interface VentanillaRadicado {
  radicadoId: string;
  estadoActual: EstadoRadicado | 'ASIGNADO' | 'POR_VENCER' | 'VENCIDO' | 'PRORROGA';
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
    anexosDescripcion?: string;
  };
  archivos: ArchivoRadicado[];
  trazabilidad: TrazabilidadRadicado[];
  analisisIa?: AnalisisIA;
  feedbackIa?: FeedbackIA;
}


export interface UsuarioInterno {
  uid: string;
  email: string;
  nombre: string;
  rol: 'ADMIN' | 'FUNCIONARIO' | 'RECEPCIONISTA';
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

