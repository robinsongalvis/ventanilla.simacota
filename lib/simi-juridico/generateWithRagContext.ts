/**
 * generateWithRagContext — Gemini con contexto jurídico inyectado (RAG).
 *
 * Inyecta solo fuentes permitidas (vigentes, validadas).
 * Instrucción explícita: Gemini no debe citar nada fuera del contexto.
 */

import { callGeminiJuridico } from './callGemini';
import { retrieveLegalContext } from './retrieveLegalContext';
import { SIMI_JURIDICO_SYSTEM_PROMPT } from './prompts';
import type { RagQueryParams } from '@/src/types/simi-rag';
import type { RagGenerationResult } from '@/src/types/simi-rag';

interface GenerateWithRagOptions {
  userPrompt:      string;
  ragParams:       RagQueryParams;
  expectJson:      boolean;
}

export async function generateWithRagContext<T = string>(
  opts: GenerateWithRagOptions,
): Promise<RagGenerationResult & { resultado: T }> {

  // 1. Recuperar contexto jurídico validado
  const context = await retrieveLegalContext(opts.ragParams);

  // 2. Construir system prompt con contexto inyectado
  const systemWithContext = context.contexto
    ? `${SIMI_JURIDICO_SYSTEM_PROMPT}

${context.contexto}

INSTRUCCIÓN OBLIGATORIA PARA ESTA RESPUESTA:
- Usa ÚNICAMENTE las fuentes del listado anterior como base normativa.
- Si una norma necesaria no aparece en el listado, indica: "Esta norma requiere verificación adicional y no está disponible en el normograma validado."
- No cites artículos que no estén respaldados por las fuentes del listado.
- Si el listado está vacío, indica que no se encontró base documental y la respuesta requerirá validación jurídica.`
    : SIMI_JURIDICO_SYSTEM_PROMPT;

  // 3. Llamar Gemini con contexto
  const resultado = await callGeminiJuridico<T>({
    systemPrompt: systemWithContext,
    userPrompt:   opts.userPrompt,
    expectJson:   opts.expectJson,
  });

  // 4. Combinar advertencias
  const advertencias = [
    ...context.advertencias,
    ...(context.fuentesPendientes.length > 0
      ? [`${context.fuentesPendientes.length} fuente(s) pendiente(s) de verificación no fueron usadas como fundamento.`]
      : []),
    ...(context.fuentesValidadas.length === 0
      ? ['Respuesta generada sin contexto documental validado. Requiere revisión jurídica.']
      : []),
  ];

  return {
    resultado,
    fuentesUsadas:     context.fuentesValidadas,
    fuentesPendientes: context.fuentesPendientes,
    advertencias,
    usedRag:           true,
  };
}
