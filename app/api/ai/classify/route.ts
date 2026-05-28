import { NextResponse } from 'next/server';
import { CLASSIFIER_PROMPT, CLASSIFIER_SCHEMA } from '@/lib/ai/prompts/classifier';
import { registrarLogIA } from '@/lib/ai/telemetry';

export async function POST(request: Request) {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const { asunto, descripcion } = await request.json();

    if (!descripcion || descripcion.trim().length < 10) {
      return NextResponse.json(
        { error: 'La descripción es requerida (mínimo 10 caracteres).' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not defined in environment variables. Falling back to local mock classifier.');
      
      // Local semantic mock matcher based on common keywords
      const text = `${asunto || ''} ${descripcion}`.toLowerCase();
      let sugerencia = 'VENTANILLA_UNICA';
      const tags: string[] = [];

      if (text.includes('agua') || text.includes('tubo') || text.includes('fuga') || text.includes('acueducto')) {
        sugerencia = 'SEC_PLANEACION';
        tags.push('acueducto');
      } else if (text.includes('luminaria') || text.includes('postes') || text.includes('luz') || text.includes('alumbrado')) {
        sugerencia = 'SEC_PLANEACION';
        tags.push('alumbrado');
      } else if (text.includes('via') || text.includes('carretera') || text.includes('zanja') || text.includes('hueco')) {
        sugerencia = 'SEC_PLANEACION';
        tags.push('vias-rurales');
      } else if (text.includes('sisben') || text.includes('encuesta')) {
        sugerencia = 'SUB_SISBEN';
        tags.push('sisben');
      } else if (text.includes('subsidio') || text.includes('adulto mayor') || text.includes('familias en accion')) {
        sugerencia = 'SUB_PROGRAMAS';
        tags.push('programas-sociales');
      } else if (text.includes('violencia') || text.includes('familiar') || text.includes('menor') || text.includes('abuso')) {
        sugerencia = 'SUB_COMISARIA';
        tags.push('comisaria-familia');
      } else if (text.includes('animal') || text.includes('cultivo') || text.includes('plaga') || text.includes('finca')) {
        sugerencia = 'SEC_AGRICULTURA_UMATA';
        tags.push('agricultura');
      } else if (text.includes('desastre') || text.includes('derrumbe') || text.includes('inundacion') || text.includes('riesgo')) {
        sugerencia = 'SUB_RIESGOS_GRD';
        tags.push('gestion-del-riesgo');
      }

      if (text.includes('vereda') || text.includes('veredas') || text.includes('campo')) {
        tags.push('zona-rural');
      }

      const mockResponse = {
        dependenciaSugerida: sugerencia,
        confianzaClasificacion: 0.85,
        etiquetasSemanticas: tags.length > 0 ? tags : ['ciudadania'],
        resumenEjecutivo: `Ciudadano solicita asistencia/reporte sobre ${asunto || 'tema general'}.`,
        promptVersion: 'simi-classifier-v1.0-mock',
        fechaAnalisis: new Date().toISOString(),
      };

      const latenciaMs = Date.now() - start;
      await registrarLogIA({
        endpoint: 'classify',
        latenciaMs,
        fallbackActivo: true,
        promptVersion: 'simi-classifier-v1.0-mock',
      });

      return NextResponse.json(mockResponse);
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Asunto: ${asunto || 'Sin asunto'}\nDescripción: ${descripcion}`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: CLASSIFIER_PROMPT,
          },
        ],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: CLASSIFIER_SCHEMA,
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
    const responseText = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No se recibió texto de respuesta de la API de Gemini.');
    }

    const aiResult = JSON.parse(responseText);
    const latenciaMs = Date.now() - start;

    await registrarLogIA({
      endpoint: 'classify',
      latenciaMs,
      fallbackActivo: false,
      promptVersion: 'simi-classifier-v1.0',
    });

    return NextResponse.json({
      ...aiResult,
      promptVersion: 'simi-classifier-v1.0',
      fechaAnalisis: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const latenciaMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error en /api/ai/classify:', msg);

    await registrarLogIA({
      endpoint: 'classify',
      latenciaMs,
      error: msg,
      fallbackActivo: !apiKey,
      promptVersion: apiKey ? 'simi-classifier-v1.0' : 'simi-classifier-v1.0-mock',
    });

    return NextResponse.json(
      { error: 'Error interno en el clasificador de IA.', detalles: msg },
      { status: 500 }
    );
  }
}
