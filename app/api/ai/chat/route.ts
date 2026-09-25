import { NextResponse } from 'next/server';
import { SIMI_SYSTEM_PROMPT } from '@/lib/ai/prompts/simi';
import { registrarLogIA } from '@/lib/ai/telemetry';
import { ejecutarConResiliencia } from '@/lib/ai/resilience';
import { evaluarAccesoIA } from '@/lib/ai/guard-publico-ia';
import type { DatosExtraidos } from '@/src/types/simi';

/* ══════════════════════════════════════════════════════════════
   TIPOS
══════════════════════════════════════════════════════════════ */

interface MensajeGemini {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface ChatRequestBody {
  /** Historial de mensajes del chat */
  messages: Array<{
    role: 'user' | 'assistant' | 'model';
    content: string;
  }>;
  /**
   * Contexto del formulario actual — qué campos ya están llenos.
   * Permite a SIMI saber qué falta y personalizar su guía.
   * Opcional: si no se envía, SIMI no sabe el estado del formulario.
   */
  contextoFormulario?: Partial<DatosExtraidos>;
}

interface RespuestaChat {
  role: 'assistant';
  content: string;
}

/* ══════════════════════════════════════════════════════════════
   FALLBACK LOCAL (sin Gemini o circuito abierto)
══════════════════════════════════════════════════════════════ */

function generarRespuestaFallback(
  messages: ChatRequestBody['messages'],
  esFallbackError = false,
): RespuestaChat {
  const ultimoMensaje = messages[messages.length - 1]?.content?.toLowerCase() ?? '';

  let respuesta =
    '¡Hola! Bienvenido a la Ventanilla Única de Simacota. ' +
    '¿En qué le puedo ayudar? Si quiere radicar rápido, use el botón 📎 para escanear su documento.';

  if (ultimoMensaje.includes('agua') || ultimoMensaje.includes('acueducto')) {
    respuesta =
      'Eso va para **Planeación e Infraestructura**. ' +
      'Adjunte una foto del daño si puede y use el botón 📎 para escanear su cédula — así llena el formulario más rápido.';
  } else if (ultimoMensaje.includes('sisben') || ultimoMensaje.includes('encuesta')) {
    respuesta =
      'Para SISBEN, radique directo a la **Oficina SISBEN**. ' +
      'Tenga lista su cédula y use el botón 📎 para escanearla.';
  } else if (ultimoMensaje.includes('escanear') || ultimoMensaje.includes('foto') || ultimoMensaje.includes('cedula') || ultimoMensaje.includes('cédula')) {
    respuesta =
      'Use el botón **📎** junto al campo de texto para adjuntar la foto de su cédula o carta. ' +
      'SIMI llenará el formulario por usted en segundos.';
  } else if (messages.length > 1) {
    respuesta =
      'Entendido. ¿Quiere que le ayude a redactar el asunto, ' +
      'o prefiere usar el botón 📎 para escanear su documento?';
  }

  if (esFallbackError) {
    respuesta =
      '[Mantenimiento momentáneo] ' + respuesta +
      ' Estamos restableciendo el servicio. Intente en unos segundos.';
  }

  return { role: 'assistant', content: respuesta };
}

/* ══════════════════════════════════════════════════════════════
   ROUTE HANDLER — POST /api/ai/chat
══════════════════════════════════════════════════════════════ */

export async function POST(request: Request): Promise<NextResponse<RespuestaChat>> {
  const inicio = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  let body: ChatRequestBody = { messages: [] };

  // C-1: guard compartido (origen + rate limit en Firestore).
  const acceso = await evaluarAccesoIA(request, 'chat');
  if (!acceso.permitido) {
    return NextResponse.json(
      {
        role: 'assistant',
        content: acceso.motivo === 'ORIGEN'
          ? 'No fue posible procesar la solicitud desde este origen.'
          : 'SIMI recibió muchas solicitudes seguidas desde esta conexión. ' +
            'Espere un momento e intente nuevamente para continuar con la atención.',
      },
      {
        status: acceso.status ?? 429,
        headers: acceso.retryAfterSeconds ? { 'Retry-After': String(acceso.retryAfterSeconds) } : {},
      },
    );
  }

  try {
    body = (await request.json()) as ChatRequestBody;
    const { messages, contextoFormulario } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        generarRespuestaFallback([]),
        { status: 400 },
      );
    }

    /* ── Fallback sin API key ── */
    if (!apiKey) {
      console.warn('[chat] GEMINI_API_KEY no definida — modo mock.');
      const fallback = generarRespuestaFallback(messages);
      await registrarLogIA({
        endpoint: 'chat',
        latenciaMs: Date.now() - inicio,
        fallbackActivo: true,
        promptVersion: 'simi-chat-v2.0-mock',
      });
      return NextResponse.json(fallback);
    }

    /* ── Construcción del system prompt enriquecido con contexto del formulario ── */
    let systemPromptFinal = SIMI_SYSTEM_PROMPT;

    if (contextoFormulario) {
      const camposLlenos = (
        Object.entries(contextoFormulario) as Array<[keyof DatosExtraidos, string | null]>
      )
        .filter(([, valor]) => valor !== null && valor !== '')
        .map(([campo]) => campo);

      const camposVacios = (
        ['nombre', 'email', 'telefono', 'descripcion'] as Array<keyof DatosExtraidos>
      ).filter((c) => !camposLlenos.includes(c));

      if (camposLlenos.length > 0 || camposVacios.length > 0) {
        systemPromptFinal +=
          `\n\nCONTEXTO ACTUAL DEL FORMULARIO:` +
          (camposLlenos.length > 0
            ? `\n- Campos ya llenos: ${camposLlenos.join(', ')}.`
            : '') +
          (camposVacios.length > 0
            ? `\n- Campos pendientes: ${camposVacios.join(', ')}. Guía al ciudadano a completarlos.`
            : '\n- ¡El formulario está completo! Anima al ciudadano a enviarlo.');
      }
    }

    /* ── Conversión al formato de Gemini (role: 'model' en vez de 'assistant') ── */
    const contenidosGemini: MensajeGemini[] = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash` +
      `:generateContent?key=${apiKey}`;

    const geminiBody = {
      contents: contenidosGemini,
      systemInstruction: {
        parts: [{ text: systemPromptFinal }],
      },
      generationConfig: {
        maxOutputTokens: 400, // Respuestas cortas (modo ejecución rápida)
        temperature: 0.6,    // Balance entre creatividad y precisión
      },
    };

    /* ── Llamada con resiliencia ── */
    const response = await ejecutarConResiliencia(
      'GeminiChat',
      async () => {
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini Chat error ${res.status}: ${errText}`);
        }

        return res;
      },
      {
        retries: 2,
        baseDelayMs: 1000,
        configBreaker: {
          maxFailures: 5,
          cooldownMs: 60_000,
        },
      },
    );

    const resData = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const textRespuesta = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textRespuesta) {
      throw new Error('Gemini Chat no devolvió texto en la respuesta.');
    }

    await registrarLogIA({
      endpoint: 'chat',
      latenciaMs: Date.now() - inicio,
      fallbackActivo: false,
      promptVersion: 'simi-chat-v2.0',
    });

    return NextResponse.json<RespuestaChat>({
      role: 'assistant',
      content: textRespuesta,
    });

  } catch (error: unknown) {
    const latenciaMs = Date.now() - inicio;
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[chat] Error — activando degradación progresiva:', msg);

    const fallback = generarRespuestaFallback(body.messages, true);

    await registrarLogIA({
      endpoint: 'chat',
      latenciaMs,
      error: msg,
      fallbackActivo: true,
      promptVersion: 'simi-chat-v2.0-fallback-error',
    });

    return NextResponse.json(fallback);
  }
}
