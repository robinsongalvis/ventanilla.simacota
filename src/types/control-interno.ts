/**
 * Tipos del módulo profesional de Control Interno.
 *
 * Control Interno NO modifica radicados. Vigila, audita, alerta,
 * documenta hallazgos y solicita planes de mejora a las dependencias.
 */

import type { TenantId } from './radicado';
import type { RolInterno } from '@/lib/hooks/useAuth';

/* ══════════════════════════════════════════════════════════════
   RIESGOS
══════════════════════════════════════════════════════════════ */

export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';

export type MotivoRiesgo =
  | 'VENCIDO'
  | 'POR_VENCER'
  | 'SIN_RESPONSABLE'
  | 'SIN_TRAZABILIDAD'
  | 'DEVUELTO_VARIAS_VECES'
  | 'CON_PRORROGA'
  | 'RESUELTO_FUERA_TERMINO'
  | 'NOTIFICACION_FALLIDA'
  | 'ANONIMO_RESERVADO'
  | 'TIPO_URGENTE'
  | 'DEPENDENCIA_CONGESTIONADA';

export interface EvaluacionRiesgo {
  radicadoId:   string;
  nivel:        NivelRiesgo;
  /** Puntaje numérico para ordenar (mayor = más riesgoso) */
  puntaje:      number;
  motivos:      MotivoRiesgo[];
  /** Acción sugerida en lenguaje natural */
  accion:       string;
}

/* ══════════════════════════════════════════════════════════════
   ALERTAS
══════════════════════════════════════════════════════════════ */

export type TipoAlertaControlInterno =
  | 'RADICADO_VENCIDO'
  | 'RADICADO_POR_VENCER'
  | 'SIN_RESPONSABLE'
  | 'SIN_TRAZABILIDAD'
  | 'RESPUESTA_FUERA_TERMINO'
  | 'NOTIFICACION_FALLIDA'
  | 'DEPENDENCIA_CONGESTIONADA'
  | 'TIPO_URGENTE_SIN_ATENDER'
  | 'PRORROGA_SIN_JUSTIFICACION'
  // SIMI patrones — señales transversales que anticipan problemas:
  | 'CIUDADANO_REINCIDENTE'
  | 'DEVOLUCIONES_ACUMULADAS';

export type EstadoAlerta = 'ABIERTA' | 'GESTIONADA' | 'DESCARTADA';

export interface AlertaControlInterno {
  id?:               string;
  tipo:              TipoAlertaControlInterno;
  nivel:             NivelRiesgo;
  radicadoId:        string | null;
  tenantId:          TenantId | null;
  responsableUid?:   string | null;
  responsableNombre?: string | null;
  motivo:            string;
  accionSugerida:    string;
  fecha:             string;  // ISO
  estado:            EstadoAlerta;
  /** Solo presente cuando estado != ABIERTA */
  gestionadaPor?:    { uid: string; nombre: string; fecha: string; nota?: string } | null;
  metadata?:         Record<string, unknown>;
}

/* ══════════════════════════════════════════════════════════════
   HALLAZGOS
══════════════════════════════════════════════════════════════ */

export type TipoHallazgo =
  | 'INCUMPLIMIENTO_TERMINO'
  | 'FALTA_TRAZABILIDAD'
  | 'FALTA_RESPONSABLE'
  | 'RESPUESTA_INCOMPLETA'
  | 'SOPORTE_INSUFICIENTE'
  | 'NOTIFICACION_FALLIDA_NO_GESTIONADA'
  | 'CLASIFICACION_INCORRECTA'
  | 'DEPENDENCIA_RIESGO_OPERATIVO'
  | 'REINCIDENCIA'
  | 'OTRO';

export type EstadoHallazgo = 'ABIERTO' | 'EN_GESTION' | 'CERRADO';

export interface HallazgoControlInterno {
  id?:              string;
  radicadoId:       string | null;
  tenantId:         TenantId;
  responsableUid?:  string | null;
  responsableNombre?: string | null;
  tipo:             TipoHallazgo;
  nivel:            NivelRiesgo;
  descripcion:      string;
  evidencia?:       string | null;
  accionRecomendada?: string | null;
  fechaSeguimiento?:  string | null;
  fecha:            string;
  creadoPor:        { uid: string; nombre: string; rol: RolInterno };
  estado:           EstadoHallazgo;
  observaciones:    HallazgoObservacion[];
  planMejoraId?:    string | null;
  cierre?:          { fecha: string; uid: string; nombre: string; justificacion: string } | null;
}

export interface HallazgoObservacion {
  fecha:  string;
  uid:    string;
  nombre: string;
  rol:    RolInterno;
  texto:  string;
}

/* ══════════════════════════════════════════════════════════════
   PLANES DE MEJORA
══════════════════════════════════════════════════════════════ */

export type EstadoPlanMejora = 'PENDIENTE' | 'EN_EJECUCION' | 'CUMPLIDO' | 'VENCIDO';

export interface PlanMejora {
  id?:                  string;
  hallazgoId:           string;
  tenantId:             TenantId;
  accionCorrectiva:     string;
  responsableUid:       string;
  responsableNombre:    string;
  fechaCompromiso:      string;        // ISO date (YYYY-MM-DD)
  estado:               EstadoPlanMejora;
  evidenciaRequerida:   string;
  observaciones:        string | null;
  fechaCreacion:        string;
  creadoPor:            { uid: string; nombre: string; rol: RolInterno };
  avances:              PlanMejoraAvance[];
  cierre?:              { fecha: string; uid: string; nombre: string; resultado: 'CUMPLIDO' | 'INCUMPLIDO'; justificacion: string } | null;
}

export interface PlanMejoraAvance {
  fecha:        string;
  uid:          string;
  nombre:       string;
  rol:          RolInterno;
  texto:        string;
  evidenciaUrl?: string | null;
}

/* ══════════════════════════════════════════════════════════════
   PANORAMA GENERAL — KPIs
══════════════════════════════════════════════════════════════ */

export type SemaforoKpi = 'VERDE' | 'AMARILLO' | 'ROJO';

export interface KpiControlInterno {
  clave:        string;
  label:        string;
  valor:        number | string;
  semaforo:     SemaforoKpi;
  descripcion:  string;
  accion?:      string;
}

export interface PanoramaControlInterno {
  periodo:      { desde: string; hasta: string };
  kpis:         KpiControlInterno[];
  /** Dependencia con más vencidos en el período */
  peorDependencia?: { tenantId: TenantId; nombre: string; vencidos: number } | null;
  /** Dependencia con mejor tasa de cumplimiento */
  mejorDependencia?: { tenantId: TenantId; nombre: string; cumplimiento: number } | null;
}

/* ══════════════════════════════════════════════════════════════
   DESEMPEÑO POR DEPENDENCIA
══════════════════════════════════════════════════════════════ */

export interface DesempenoDependencia {
  tenantId:               TenantId;
  nombre:                 string;
  total:                  number;
  resueltos:              number;
  vencidos:               number;
  porVencer:              number;
  cumplimientoPct:        number;
  promedioDiasRespuesta:  number | null;
  sinResponsable:         number;
  hallazgosAbiertos:      number;
  planesMejoraAbiertos:   number;
  notificacionesFallidas: number;
  nivelRiesgo:            NivelRiesgo;
}

/* ══════════════════════════════════════════════════════════════
   TRAZABILIDAD — EVENTOS DE CONTROL INTERNO
══════════════════════════════════════════════════════════════ */

export type EventoControlInternoTipo =
  | 'CONTROL_INTERNO_OBSERVACION'
  | 'CONTROL_INTERNO_HALLAZGO_CREADO'
  | 'CONTROL_INTERNO_HALLAZGO_CERRADO'
  | 'CONTROL_INTERNO_PLAN_MEJORA_SOLICITADO'
  | 'CONTROL_INTERNO_PLAN_MEJORA_ACTUALIZADO'
  | 'CONTROL_INTERNO_PLAN_MEJORA_CERRADO'
  | 'CONTROL_INTERNO_ALERTA_REVISADA'
  | 'CONTROL_INTERNO_REPORTE_EXPORTADO';

export interface EventoControlInterno {
  id?:           string;
  tipo:          EventoControlInternoTipo;
  fecha:         string;
  actorUid:      string;
  actorNombre:   string;
  actorRol:      RolInterno;
  radicadoId?:   string | null;
  tenantId?:     TenantId | null;
  metadata?:     Record<string, unknown>;
}

/* ══════════════════════════════════════════════════════════════
   ETIQUETAS HUMANAS
══════════════════════════════════════════════════════════════ */

export const LABEL_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  BAJO:    'Bajo',
  MEDIO:   'Medio',
  ALTO:    'Alto',
  CRITICO: 'Crítico',
};

export const LABEL_TIPO_HALLAZGO: Record<TipoHallazgo, string> = {
  INCUMPLIMIENTO_TERMINO:             'Incumplimiento de término',
  FALTA_TRAZABILIDAD:                 'Falta de trazabilidad',
  FALTA_RESPONSABLE:                  'Falta de responsable',
  RESPUESTA_INCOMPLETA:               'Respuesta incompleta',
  SOPORTE_INSUFICIENTE:               'Soporte insuficiente',
  NOTIFICACION_FALLIDA_NO_GESTIONADA: 'Notificación fallida no gestionada',
  CLASIFICACION_INCORRECTA:           'Clasificación incorrecta',
  DEPENDENCIA_RIESGO_OPERATIVO:       'Dependencia con riesgo operativo',
  REINCIDENCIA:                       'Reincidencia',
  OTRO:                               'Otro',
};

export const LABEL_TIPO_ALERTA: Record<TipoAlertaControlInterno, string> = {
  RADICADO_VENCIDO:           'Radicado vencido',
  RADICADO_POR_VENCER:        'Radicado por vencer',
  SIN_RESPONSABLE:            'Sin responsable',
  SIN_TRAZABILIDAD:           'Sin trazabilidad reciente',
  RESPUESTA_FUERA_TERMINO:    'Respuesta fuera de término',
  NOTIFICACION_FALLIDA:       'Notificación fallida',
  DEPENDENCIA_CONGESTIONADA:  'Dependencia congestionada',
  TIPO_URGENTE_SIN_ATENDER:   'Tipo urgente sin atender',
  PRORROGA_SIN_JUSTIFICACION: 'Prórroga sin justificación suficiente',
  CIUDADANO_REINCIDENTE:      'Ciudadano con varios casos activos',
  DEVOLUCIONES_ACUMULADAS:    'Devoluciones acumuladas en la dependencia',
};

export const LABEL_ESTADO_HALLAZGO: Record<EstadoHallazgo, string> = {
  ABIERTO:    'Abierto',
  EN_GESTION: 'En gestión',
  CERRADO:    'Cerrado',
};

export const LABEL_ESTADO_PLAN: Record<EstadoPlanMejora, string> = {
  PENDIENTE:    'Pendiente',
  EN_EJECUCION: 'En ejecución',
  CUMPLIDO:     'Cumplido',
  VENCIDO:      'Vencido',
};
