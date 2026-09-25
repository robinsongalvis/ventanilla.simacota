/**
 * Tipos del Dashboard de Control Interno — Sprint 5
 */

export interface MetricasDependencia {
  tenantId:    string;
  nombre:      string;
  total:       number;
  respondidos: number;
  vencidos:    number;
  porVencer:   number;
  riesgoAlto:  number;
  tasaOportunidad: number;  // %
}

export interface ControlInternoDashboardData {
  periodo: { desde: string; hasta: string };

  /* PQRSD globales */
  totalRecibidos:          number;
  respondidosEnTermino:    number;
  vencidos:                number;
  porVencer:               number;
  promedioDiasRespuesta:   number | null;
  tasaOportunidadGlobal:   number;  // %

  /* Aprobaciones */
  borradoresGenerados:     number;
  aprobadosSinCambios:     number;
  devueltos:               number;
  escaladosJuridica:       number;
  pendientesJefe:          number;
  pendientesJuridica:      number;

  /* Tipos de solicitud */
  solicitudesIncompletas:  number;
  trasladosCompetencia:    number;
  casosRiesgoAlto:         number;

  /* SIMI */
  consultasSimi:           number;
  alertasGeneradas:        number;

  /* Por dependencia */
  porDependencia: MetricasDependencia[];
}

export type AlertaTipoDeadline =
  | 'vencimiento_5_dias'
  | 'vencimiento_3_dias'
  | 'vencimiento_1_dia'
  | 'vencido'
  | 'riesgo_alto_sin_revision'
  | 'pendiente_jefe'
  | 'pendiente_juridica'
  | 'devuelto_sin_ajuste';

export interface AlertaVencimiento {
  id?:           string;
  radicadoId:    string;
  tenantId:      string;
  tipo:          AlertaTipoDeadline;
  diasRestantes: number;
  prioridad:     'critica' | 'alta' | 'media';
  enviada:       boolean;
  fechaAlerta:   string;  // ISO — para evitar duplicados del mismo día
  createdAt?:    string;
}
