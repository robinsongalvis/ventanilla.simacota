import type { ContextoIARadicado } from '../context-engine';
import type { RecomendacionCopiloto } from './index';
import { PROMPT_PLANEACION } from './shared/prompts';
import { llamarGeminiAgente } from './shared/client';

export async function ejecutarAgentePlaneacion(
  contexto: ContextoIARadicado,
  apiKey?: string
): Promise<RecomendacionCopiloto> {
  const agenteNombre = 'Copiloto de Planeación e Infraestructura';
  const promptVersion = apiKey ? 'planeacion-agent-v1.0' : 'planeacion-agent-v1.0-mock';

  if (!apiKey) {
    // FALLBACK MOCK LOCAL
    const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';
    
    return {
      agenteNombre,
      priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
      motivoPrioridad: esCritico
        ? 'Plazo legal vencido/crítico o saturación severa en el equipo de Planeación.'
        : 'Plazo legal dentro de los parámetros estándar. Permite programar visita regular.',
      sugerenciasOperativas: [
        'Programar inspección física en campo por el ingeniero supervisor para evaluar el sector.',
        'Verificar el inventario de maquinaria pesada municipal si se requiere reparación de vía veredal.',
        'Cruzar datos con el operador local de acueducto rural si el radicado reporta fallas en suministro de agua.',
      ],
      borradorRespuestaInterna: `Cordial saludo,\n\nEn atención a su solicitud respecto a "${contexto.asunto}" registrada bajo el radicado número ${contexto.radicadoId}, la Secretaría de Planeación e Infraestructura de Simacota se permite informarle que hemos procedido a incluir su caso dentro del cronograma de visitas técnicas y de inspección en campo para esta semana.\n\nUna vez realicemos el diagnóstico en sitio, procederemos a coordinar las labores operativas correspondientes en beneficio de su comunidad.\n\nAtentamente,\nSecretaría de Planeación e Infraestructura · Alcaldía de Simacota`,
      promptVersion,
      fechaGeneracion: new Date().toISOString(),
    };
  }

  // Llamada productiva a Gemini wrapped in try-catch to enable graceful fallback degradation
  try {
    const resultado = await llamarGeminiAgente(
      PROMPT_PLANEACION,
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
    console.error(`[Resilience - Planeacion] Copiloto falló (usando fallback local):`, errorMsg);
    
    // Degradación progresiva: Retornar mock local pero con anotación de fallback
    const esCritico = contexto.diasHabilesRestantes <= 2 || contexto.nivelSaturacionOficina === 'CRITICO';
    return {
      agenteNombre,
      priorizacionSugerida: esCritico ? 'CRITICA' : 'ESTANDAR',
      motivoPrioridad: `${esCritico ? 'Plazo legal crítico o saturación severa.' : 'Plazo estándar.'} (Inferencia local por contingencia de red/IA)`,
      sugerenciasOperativas: [
        'Programar inspección física en campo por el ingeniero supervisor para evaluar el sector.',
        'Verificar el inventario de maquinaria pesada municipal si se requiere reparación de vía veredal.',
        'Cruzar datos con el operador local de acueducto rural si el radicado reporta fallas en suministro de agua.',
      ],
      borradorRespuestaInterna: `Cordial saludo,\n\nEn atención a su solicitud respecto a "${contexto.asunto}" registrada bajo el radicado número ${contexto.radicadoId}, la Secretaría de Planeación e Infraestructura de Simacota se permite informarle que hemos procedido a incluir su caso dentro del cronograma de visitas técnicas y de inspección en campo para esta semana.\n\nUna vez realicemos el diagnóstico en sitio, procederemos a coordinar las labores operativas correspondientes en beneficio de su comunidad.\n\nAtentamente,\nSecretaría de Planeación e Infraestructura · Alcaldía de Simacota`,
      promptVersion: 'planeacion-agent-v1.0-fallback',
      fechaGeneracion: new Date().toISOString(),
    };
  }
}
