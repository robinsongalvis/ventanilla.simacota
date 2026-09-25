/**
 * Tipos del Módulo SIMI Jurídico-Administrativo
 * Ventanilla Única Inteligente — Alcaldía de Simacota
 *
 * SIMI Jurídico apoya, orienta, proyecta y advierte riesgos.
 * No reemplaza la revisión, aprobación ni firma del funcionario competente.
 */

/* ══════════════════════════════════════════════════════════════
   MODOS DE OPERACIÓN
══════════════════════════════════════════════════════════════ */

export type SimiModoJuridico =
  | 'analizar_solicitud'
  | 'proyectar_respuesta'
  | 'revisar_borrador'
  | 'fundamento_normativo'
  | 'riesgo_juridico'
  | 'lenguaje_claro'
  | 'checklist_mipg'
  | 'traslado_competencia'
  | 'solicitud_aclaracion'
  | 'datos_personales'
  | 'escalar_juridica';

/* ══════════════════════════════════════════════════════════════
   NIVELES DE RIESGO
══════════════════════════════════════════════════════════════ */

export type NivelRiesgoJuridico = 'bajo' | 'medio' | 'alto';

export type EstadoNorma =
  | 'vigente'
  | 'parcialmente_vigente'
  | 'pendiente_verificacion'
  | 'interna_validada'
  | 'interna_no_validada'
  | 'derogada';

export type NivelConfianza = 'alto' | 'medio' | 'bajo';

/* ══════════════════════════════════════════════════════════════
   ANÁLISIS DE SOLICITUD (Módulo 1)
══════════════════════════════════════════════════════════════ */

export interface NormativaSugerida {
  titulo:           string;
  tipoNorma:        string;
  numero?:          string;
  anio?:            string;
  fuente?:          string;
  estado:           EstadoNorma;
  aplicabilidad:    string;
  notaValidacion:   string;
  nivelConfianza:   NivelConfianza;
}

export interface ChecklistMipg {
  claridad:                 boolean;
  respuestaFondo:           boolean;
  oportunidad:              boolean;
  trazabilidad:             boolean;
  competencia:              boolean | 'pendiente';
  proteccionDatos:          boolean | 'pendiente';
  gestionDocumental:        boolean;
  requiereRevisionJuridica: boolean;
  observaciones:            string[];
}

export interface SimiAnalisisJuridico {
  tipoSolicitudPrincipal:     string;
  tiposSecundarios:           string[];
  temaCentral:                string;
  dependenciaSugerida:        string;
  motivoDependencia:          string;
  terminoProbable:            string;
  fechaLimiteProbable?:       string;
  nivelRiesgo:                NivelRiesgoJuridico;
  datosFaltantes:             string[];
  requiereTraslado:           boolean;
  requiereAclaracion:         boolean;
  requiereRevisionJuridica:   boolean;
  rutaInternaRecomendada:     string;
  fundamentosNormativos:      NormativaSugerida[];
  checklistMipg:              ChecklistMipg;
  mensajeSemaforo:            string;
  advertenciasPersonalData:   string[];
}

/* ══════════════════════════════════════════════════════════════
   REVISIÓN DE BORRADOR (Módulo 6 — Modo Abogado Revisor)
══════════════════════════════════════════════════════════════ */

export interface SimiRevisionBorrador {
  diagnostico:               string;
  riesgosDetectados:         string[];
  mejorasSugeridas:          string[];
  versionMejorada?:          string;
  nivelRiesgo:               NivelRiesgoJuridico;
  nivelConfianza:            NivelConfianza;
  requiereRevisionJuridica:  boolean;
  recomendacionFinal:        string;
  checklistMipg:             ChecklistMipg;
}

/* ══════════════════════════════════════════════════════════════
   LENGUAJE CLARO (Módulo 7)
══════════════════════════════════════════════════════════════ */

export interface SimiLenguajeClaro {
  versionOriginalResumida: string;
  versionLenguajeClaro:    string;
  cambiosRealizados:       string[];
  advertenciasPrecision:   string[];
  recomendacionRevision:   string;
}

/* ══════════════════════════════════════════════════════════════
   RESULTADO GENÉRICO (envuelve todos los modos)
══════════════════════════════════════════════════════════════ */

export type SimiResultadoJuridico =
  | { modo: 'analizar_solicitud';    resultado: SimiAnalisisJuridico }
  | { modo: 'proyectar_respuesta';   resultado: string }  // borrador texto
  | { modo: 'revisar_borrador';      resultado: SimiRevisionBorrador }
  | { modo: 'lenguaje_claro';        resultado: SimiLenguajeClaro }
  | { modo: 'checklist_mipg';        resultado: ChecklistMipg }
  | { modo: 'fundamento_normativo';  resultado: NormativaSugerida[] }
  | { modo: 'riesgo_juridico';       resultado: { nivel: NivelRiesgoJuridico; mensaje: string; factores: string[] } }
  | { modo: 'traslado_competencia';  resultado: string }
  | { modo: 'solicitud_aclaracion';  resultado: string }
  | { modo: 'datos_personales';      resultado: { detectados: string[]; advertencia: string } }
  | { modo: 'escalar_juridica';      resultado: { motivo: string; instrucciones: string } };

/* ══════════════════════════════════════════════════════════════
   AUDITORÍA (Módulo 14 — Colección simi_juridico_auditoria)
══════════════════════════════════════════════════════════════ */

export interface SimiJuridicoAuditoria {
  id?:                        string;   // auto-generated
  radicadoId:                 string;
  usuarioId:                  string;
  usuarioNombre:              string;
  rol:                        string;
  fechaHora:                  string;   // ISO-8601
  modo:                       SimiModoJuridico;
  nivelRiesgo:                NivelRiesgoJuridico | null;
  requiereRevisionJuridica:   boolean;
  dependenciaSugerida?:       string;
  terminoProbable?:           string;
  fuentesConsultadas:         Pick<NormativaSugerida, 'titulo' | 'estado' | 'nivelConfianza'>[];
  resultadoResumen:           string;
  usadoEnRespuestaFinal:      boolean;
  editadoPorFuncionario:      boolean;
  aprobado:                   boolean;
  observaciones?:             string;
}

/* ══════════════════════════════════════════════════════════════
   PAYLOAD DE LA API
══════════════════════════════════════════════════════════════ */

export interface SimiJuridicoPayload {
  radicadoId:     string;
  modo:           SimiModoJuridico;
  textoSolicitud?: string;
  borrador?:       string;
  contexto?:       string;
}

export interface SimiJuridicoResponse {
  ok:              boolean;
  modo:            SimiModoJuridico;
  resultado:       SimiResultadoJuridico['resultado'];
  nivelRiesgo?:    NivelRiesgoJuridico;
  advertencias:    string[];
  fraseFinal:      string;
  error?:          string;
}
