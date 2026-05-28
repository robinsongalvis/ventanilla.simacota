import type { ContextoIARadicado } from '../context-engine';
import type { RecomendacionCopiloto } from './index';
import { PROMPT_DESARROLLO_SOCIAL } from './shared/prompts';
import { llamarGeminiAgente } from './shared/client';

export async function ejecutarAgenteDesarrolloSocial(
  contexto: ContextoIARadicado,
  apiKey?: string
): Promise<RecomendacionCopiloto> {
  const agenteNombre = 'Copiloto de Desarrollo Social y Bienestar';
  const promptVersion = apiKey ? 'desarrollo-agent-v1.0' : 'desarrollo-agent-v1.0-mock';

  if (!apiKey) {
    // FALLBACK MOCK LOCAL
    const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';

    return {
      agenteNombre,
      priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
      motivoPrioridad: esCritico
        ? 'Solicitud deSisbén o subsidios con tiempos vencidos o saturación en Desarrollo Social.'
        : 'Plazo legal regular para agendamiento de encuestas y validación de requisitos.',
      sugerenciasOperativas: [
        'Validar que el solicitante haya adjuntado copias claras de su cédula y del grupo familiar a encuestar.',
        'Incluir la dirección del predio dentro de la ruta semanal del encuestador del Sisbén.',
        'Verificar si el ciudadano aplica como beneficiario de los programas del Adulto Mayor o Renta Ciudadana.',
      ],
      borradorRespuestaInterna: `Cordial saludo,\n\nEn atención a su solicitud de trámites de Sisbén/bienestar sobre "${contexto.asunto}" registrada bajo el radicado número ${contexto.radicadoId}, la Secretaría de Desarrollo Social de Simacota se permite informarle que hemos recibido su requerimiento de manera exitosa.\n\nSu caso ha sido asignado a la oficina de Sisbén municipal para programar la visita del encuestador. Por favor, asegúrese de tener copias legibles de los documentos de identidad de su núcleo familiar al momento de la visita.\n\nAtentamente,\nSecretaría de Desarrollo Social · Alcaldía de Simacota`,
      promptVersion,
      fechaGeneracion: new Date().toISOString(),
    };
  }

  // Llamada productiva a Gemini wrapped in try-catch to enable graceful fallback degradation
  try {
    const resultado = await llamarGeminiAgente(
      PROMPT_DESARROLLO_SOCIAL,
      JSON.stringify(contexto),
      apiKey
    );

    return {
      ...resultado,
      agenteNombre,
      promptVersion,
      fechaGeneracion: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[Resilience - DesarrolloSocial] Copiloto falló (usando fallback local):`, error?.message || error);
    
    // Degradación progresiva: Retornar mock local pero con anotación de fallback
    const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';
    return {
      agenteNombre,
      priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
      motivoPrioridad: `${esCritico ? 'Solicitud Sisbén urgente o saturación severa.' : 'Plazo estándar.'} (Inferencia local por contingencia de red/IA)`,
      sugerenciasOperativas: [
        'Validar que el solicitante haya adjuntado copias claras de su cédula y del grupo familiar a encuestar.',
        'Incluir la dirección del predio dentro de la ruta semanal del encuestador del Sisbén.',
        'Verificar si el ciudadano aplica como beneficiario de los programas del Adulto Mayor o Renta Ciudadana.',
      ],
      borradorRespuestaInterna: `Cordial saludo,\n\nEn atención a su solicitud de trámites de Sisbén/bienestar sobre "${contexto.asunto}" registrada bajo el radicado número ${contexto.radicadoId}, la Secretaría de Desarrollo Social de Simacota se permite informarle que hemos recibido su requerimiento de manera exitosa.\n\nSu caso ha sido asignado a la oficina de Sisbén municipal para programar la visita del encuestador. Por favor, asegúrese de tener copias legibles de los documentos de identidad de su núcleo familiar al momento de la visita.\n\nAtentamente,\nSecretaría de Desarrollo Social · Alcaldía de Simacota`,
      promptVersion: 'desarrollo-agent-v1.0-fallback',
      fechaGeneracion: new Date().toISOString(),
    };
  }
}
