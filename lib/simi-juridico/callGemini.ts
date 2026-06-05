/**
 * Helper para llamar a Gemini desde el módulo jurídico.
 * Reutiliza el patrón de resiliencia existente del proyecto.
 */

import { ejecutarConResiliencia } from '@/lib/ai/resilience';

interface GeminiJuridicoOptions {
  systemPrompt: string;
  userPrompt:   string;
  /**
   * Si true, espera JSON estructurado y lo parsea.
   * Si false, devuelve texto libre.
   */
  expectJson:   boolean;
}

/**
 * Llama a la API de Gemini con el system prompt y user prompt dados.
 * Retorna el texto o JSON parseado según `expectJson`.
 */
export async function callGeminiJuridico<T = string>(
  opts: GeminiJuridicoOptions,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING: Falta configurar GEMINI_API_KEY en Vercel.');

  const payload = {
    system_instruction: { parts: [{ text: opts.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: opts.userPrompt }] }],
    generationConfig: {
      temperature:     0.3,   // Más determinístico para análisis jurídico
      maxOutputTokens: 4096,
      ...(opts.expectJson
        ? { responseMimeType: 'application/json' }
        : {}),
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const result = await ejecutarConResiliencia(
    'gemini-juridico',
    async () => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
          signal:  AbortSignal.timeout(45_000),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`GEMINI_ERROR: Gemini HTTP ${response.status}: ${err.slice(0, 200)}`);
      }

      const data = await response.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) throw new Error('GEMINI_ERROR: Gemini devolvió respuesta vacía.');
      return text;
    },
  ).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('GEMINI_ERROR')) throw new Error(message);
    throw new Error(`GEMINI_ERROR: No fue posible conectar con Gemini. ${message}`);
  });

  if (opts.expectJson) {
    try {
      // Limpiar posible markdown ```json ... ```
      const clean = (result as string)
        .replace(/^```json\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      return JSON.parse(clean) as T;
    } catch {
      throw new Error('La IA no devolvió JSON válido. Reintente o reformule la consulta.');
    }
  }

  return result as T;
}
