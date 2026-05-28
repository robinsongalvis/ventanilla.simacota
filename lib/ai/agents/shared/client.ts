import { PROMPT_SHARED_AGENT_INSTRUCTIONS } from './prompts';

/**
 * Helper compartido para realizar la llamada HTTP a Gemini con formato JSON estricto
 */
export async function llamarGeminiAgente(
  promptEspecializado: string,
  contextoJSON: string,
  apiKey: string
): Promise<any> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Datos contextuales del Radicado en formato JSON:\n${contextoJSON}`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: `${PROMPT_SHARED_AGENT_INSTRUCTIONS}\n\n${promptEspecializado}`,
        },
      ],
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          priorizacionSugerida: {
            type: 'STRING',
            enum: ['CRITICA', 'PREVENTIVA', 'ESTANDAR'],
          },
          motivoPrioridad: {
            type: 'STRING',
          },
          sugerenciasOperativas: {
            type: 'ARRAY',
            items: { type: 'STRING' },
          },
          borradorRespuestaInterna: {
            type: 'STRING',
          },
          cuellosBotellaDetectados: {
            type: 'STRING',
            description: 'Cuellos de botella detectados en la dependencia actual o territorialmente.',
          },
        },
        required: [
          'priorizacionSugerida',
          'motivoPrioridad',
          'sugerenciasOperativas',
          'borradorRespuestaInterna',
        ],
      },
    },
  };

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Agente falló: ${response.status} - ${errText}`);
  }

  const resData = await response.json();
  const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new Error('No se recibió texto de respuesta del agente de Gemini.');
  }

  return JSON.parse(responseText);
}
