import { NextResponse } from 'next/server';
import { SIMI_SYSTEM_PROMPT } from '@/lib/ai/prompts/simi';
import { registrarLogIA } from '@/lib/ai/telemetry';

export async function POST(request: Request) {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere el historial de mensajes.' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined. SimiChat will run in fallback mock mode.');
      
      const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
      let mockReply = '¡Hola, mano! Qué gusto saludarlo por acá en la Ventanilla Única de Simacota. Cuénteme, ¿en qué le puedo colaborar sumercé?';

      if (lastUserMsg.includes('agua') || lastUserMsg.includes('acueducto') || lastUserMsg.includes('tubo')) {
        mockReply = 'Entiendo perfectamente, mano. Eso del agua es prioridad para la vereda. Le sugiero radicar una solicitud dirigida a la *Secretaría de Planeación e Infraestructura*. Describa bien dónde es el daño (cuál vereda y sector) y si puede, tómele una fotico para anexarla en el formulario. ¡Así le resuelven más rápido!';
      } else if (lastUserMsg.includes('sisben') || lastUserMsg.includes('encuesta')) {
        mockReply = '¡Hola! Para temas de encuestas, puntajes o actualizaciones de datos, debe radicar una PQRS dirigida a la *Oficina del SISBEN*. Sumercé debe anexar una fotocopia legible de su cédula y, si es por cambio de vivienda, un recibo de servicios. ¿Desea que le ayude a redactar la solicitud?';
      } else if (lastUserMsg.includes('luz') || lastUserMsg.includes('luminaria') || lastUserMsg.includes('alumbrado')) {
        mockReply = 'Ole, mano, el alumbrado público es clave para la seguridad en la vereda. Esta solicitud va directamente para la *Secretaría de Planeación*. Al momento de radicar en nuestro portal público, recuerde indicar el número del poste (si lo tiene escrito en la placa amarilla) o la referencia exacta de la casa vecina para que los técnicos vayan a la fija. ¡Es muy fácil!';
      } else if (lastUserMsg.includes('gracias') || lastUserMsg.includes('bueno')) {
        mockReply = '¡Con muchísimo gusto, sumercé! Para eso estamos aquí los simacotenses, para darnos una mano. Si tiene otra duda o ya está listo para radicar, me avisa. ¡Dios lo guarde, mano!';
      } else if (messages.length > 1) {
        mockReply = 'Excelente explicación, mano. Para radicar este caso, le recomiendo elegir la opción del formulario según lo que conversamos y redactar el asunto de forma corta. ¿Desea que lo guíe sobre qué documentos anexar, o prefiere que le resuma los requisitos?';
      }

      const latenciaMs = Date.now() - start;
      await registrarLogIA({
        endpoint: 'chat',
        latenciaMs,
        fallbackActivo: true,
        promptVersion: 'simi-chat-v1.0-mock',
      });

      return NextResponse.json({
        role: 'assistant',
        content: mockReply,
      });
    }

    // Convert OpenAI/standard chat format to Gemini API format
    const geminiContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [
        {
          text: m.content,
        },
      ],
    }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      contents: geminiContents,
      systemInstruction: {
        parts: [
          {
            text: SIMI_SYSTEM_PROMPT,
          },
        ],
      },
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const resData = await response.json();
    const replyText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      throw new Error('No se recibió texto de respuesta del asistente de Gemini.');
    }

    const latenciaMs = Date.now() - start;
    await registrarLogIA({
      endpoint: 'chat',
      latenciaMs,
      fallbackActivo: false,
      promptVersion: 'simi-chat-v1.0',
    });

    return NextResponse.json({
      role: 'assistant',
      content: replyText,
    });
  } catch (error: unknown) {
    const latenciaMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/chat:', msg);

    await registrarLogIA({
      endpoint: 'chat',
      latenciaMs,
      error: msg,
      fallbackActivo: !apiKey,
      promptVersion: apiKey ? 'simi-chat-v1.0' : 'simi-chat-v1.0-mock',
    });

    return NextResponse.json(
      { error: 'Error interno en el asistente SimiChat.', detalles: msg },
      { status: 500 }
    );
  }
}
