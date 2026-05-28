import type { ContextoIARadicado } from '../context-engine';
import type { RecomendacionCopiloto } from './index';
import { PROMPT_GOBIERNO } from './shared/prompts';
import { llamarGeminiAgente } from './shared/client';

export async function ejecutarAgenteGobierno(
  contexto: ContextoIARadicado,
  apiKey?: string
): Promise<RecomendacionCopiloto> {
  const agenteNombre = 'Copiloto de Gobierno y Convivencia';
  const promptVersion = apiKey ? 'gobierno-agent-v1.0' : 'gobierno-agent-v1.0-mock';

  if (!apiKey) {
    // FALLBACK MOCK LOCAL
    const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';

    return {
      agenteNombre,
      priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
      motivoPrioridad: esCritico
        ? 'Conflicto civil reportado con plazos al límite o saturación de expedientes en Gobierno.'
        : 'Plazo legal idóneo para agendar audiencia de conciliación pacífica.',
      sugerenciasOperativas: [
        'Citar formalmente a las partes implicadas a una audiencia de conciliación amigable en la Inspección de Policía.',
        'Solicitar acompañamiento de la fuerza pública local si se reportan amenazas o invasiones de espacio público.',
        'Coordinar con la Junta de Acción Comunal (JAC) veredal para mediar en querellas de convivencia o linderos.',
      ],
      borradorRespuestaInterna: `Cordial saludo,\n\nEn atención a su solicitud de querella/convivencia relacionada con "${contexto.asunto}" registrada bajo el radicado número ${contexto.radicadoId}, la Secretaría de Gobierno y Convivencia de Simacota se permite informarle que hemos iniciado el trámite respectivo en los despachos de la Inspección de Policía.\n\nLe invitamos a acercarse a nuestras instalaciones para agendar la fecha formal de la primera audiencia de conciliación concertada en el marco de la Ley 1801 de 2016.\n\nAtentamente,\nSecretaría de Gobierno y Convivencia · Alcaldía de Simacota`,
      promptVersion,
      fechaGeneracion: new Date().toISOString(),
    };
  }

  // Llamada productiva a Gemini wrapped in try-catch to enable graceful fallback degradation
  try {
    const resultado = await llamarGeminiAgente(
      PROMPT_GOBIERNO,
      JSON.stringify(contexto),
      apiKey
    );

    return {
      ...resultado,
      agenteNombre,
      promptVersion,
      fechaGeneracion: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Resilience - Gobierno] Copiloto falló (usando fallback local):`, errorMsg);
    
    // Degradación progresiva: Retornar mock local pero con anotación de fallback
    const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';
    return {
      agenteNombre,
      priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
      motivoPrioridad: `${esCritico ? 'Conflicto civil urgente o saturación severa.' : 'Plazo estándar.'} (Inferencia local por contingencia de red/IA)`,
      sugerenciasOperativas: [
        'Citar formalmente a las partes implicadas a una audiencia de conciliación amigable en la Inspección de Policía.',
        'Solicitar acompañamiento de la fuerza pública local si se reportan amenazas o invasiones de espacio público.',
        'Coordinar con la Junta de Acción Comunal (JAC) veredal para mediar en querellas de convivencia o linderos.',
      ],
      borradorRespuestaInterna: `Cordial saludo,\n\nEn atención a su solicitud de querella/convivencia relacionada con "${contexto.asunto}" registrada bajo el radicado número ${contexto.radicadoId}, la Secretaría de Gobierno y Convivencia de Simacota se permite informarle que hemos iniciado el trámite respectivo en los despachos de la Inspección de Policía.\n\nLe invitamos a acercarse a nuestras instalaciones para agendar la fecha formal de la primera audiencia de conciliación concertada en el marco de la Ley 1801 de 2016.\n\nAtentamente,\nSecretaría de Gobierno y Convivencia · Alcaldía de Simacota`,
      promptVersion: 'gobierno-agent-v1.0-fallback',
      fechaGeneracion: new Date().toISOString(),
    };
  }
}
