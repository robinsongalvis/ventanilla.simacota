import type { ContextoIARadicado } from '../context-engine';
import { ejecutarAgentePlaneacion } from './planeacion.agent';
import { ejecutarAgenteGobierno } from './gobierno.agent';
import { ejecutarAgenteDesarrolloSocial } from './desarrollo-social.agent';

export interface RecomendacionCopiloto {
  agenteNombre: string;
  priorizacionSugerida: 'CRITICA' | 'PREVENTIVA' | 'ESTANDAR';
  motivoPrioridad: string;
  sugerenciasOperativas: string[];
  borradorRespuestaInterna: string;
  cuellosBotellaDetectados?: string | null;
  promptVersion: string;
  fechaGeneracion: string;
}

/**
 * Orquestador dinámico de Copilotos por Secretaría de la Fase 4.2.
 * Evalúa la dependencia actual del radicado e invoca al agente especializado correspondiente.
 */
export async function invocarCopilotoEspecializado(
  contexto: ContextoIARadicado,
  apiKey?: string
): Promise<RecomendacionCopiloto> {
  const dep = contexto.dependenciaActual;

  // 1. Agente de Planeación e Infraestructura
  if (dep === 'SEC_PLANEACION') {
    return ejecutarAgentePlaneacion(contexto, apiKey);
  }

  // 2. Agente de Gobierno y Convivencia
  if (
    [
      'SEC_GOBIERNO',
      'SUB_COMISARIA',
      'SUB_INSPECCION_POLICIA_URBANA',
      'SUB_INSPECCION_POLICIA_RURAL',
    ].includes(dep)
  ) {
    return ejecutarAgenteGobierno(contexto, apiKey);
  }

  // 3. Agente de Desarrollo Social y Sisbén
  if (
    [
      'SEC_DESARROLLO_SOCIAL',
      'SUB_SISBEN',
      'SUB_VICTIMAS',
      'SUB_PROGRAMAS',
    ].includes(dep)
  ) {
    return ejecutarAgenteDesarrolloSocial(contexto, apiKey);
  }

  // 4. Agente Genérico de Coordinación Municipal (Ventanilla Única / Hacienda / Despacho)
  const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';
  return {
    agenteNombre: 'Copiloto de Coordinación Municipal',
    priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
    motivoPrioridad: esCritico
      ? 'Tiempos al límite para trámite general en Simacota.'
      : 'Asunto administrativo general bajo plazos de respuesta normales.',
    sugerenciasOperativas: [
      'Revisar los anexos y radicado en el sistema de correspondencia física si aplica.',
      'Asegurarse de trasladar al funcionario idóneo en la oficina de destino si requiere resolución específica.',
      'Registrar notas del radicado en el historial de trazabilidad interna.',
    ],
    borradorRespuestaInterna: `Cordial saludo,\n\nHemos recibido de manera conforme su solicitud respecto a "${contexto.asunto}" bajo el número de radicado ${contexto.radicadoId}.\n\nSe ha procedido a direccionar y dar apertura al trámite correspondiente en nuestras dependencias municipales de Simacota. Estaremos contactándole dentro del término de respuesta legal para formalizar nuestra actuación.\n\nAtentamente,\nCoordinación de Ventanilla Única · Alcaldía de Simacota`,
    promptVersion: apiKey ? 'generic-municipal-agent-v1.0' : 'generic-municipal-agent-v1.0-mock',
    fechaGeneracion: new Date().toISOString(),
  };
}
