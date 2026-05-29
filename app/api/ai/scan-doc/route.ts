import { NextResponse } from 'next/server';
import { SIMI_DATA_EXTRACTION_PROMPT } from '@/lib/ai/prompts/simi';
import { ejecutarConResiliencia } from '@/lib/ai/resilience';
import { registrarLogIA } from '@/lib/ai/telemetry';
import type {
  ResultadoExtraccion,
  DatosExtraidos,
  GeminiExtraccionSchema,
} from '@/src/types/simi';

/* ══════════════════════════════════════════════════════════════
   CONSTANTES
══════════════════════════════════════════════════════════════ */

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — límite del escáner de SIMI

const MIME_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

/** Modelos soportados en orden de preferencia */
const GEMINI_VISION_MODEL = 'gemini-2.5-flash';

/* ══════════════════════════════════════════════════════════════
   GEMINI API — STRUCTURED OUTPUT SCHEMA
   Fuerza application/json nativo: sin bloques markdown,
   sin texto libre, sin ```json``` wrappers.
══════════════════════════════════════════════════════════════ */

/**
 * Schema de respuesta compatible con la API de Gemini.
 * Mapeado 1:1 con GeminiExtraccionSchema / DatosExtraidos.
 *
 * `nullable: true` garantiza que el modelo use `null` (no omita el campo)
 * cuando no encuentra el dato — crítico para Firestore null-safety.
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    tipo_documento_adjunto: {
      type: 'STRING',
      nullable: true,
      description:
        'Clasifica el documento en una o dos palabras (ej. "Carta formal", "Cédula de Ciudadanía", "Factura"). null si no es determinable.',
    },
    nombre_completo: {
      type: 'STRING',
      nullable: true,
      description:
        'Nombre completo de la persona natural o razón social de la empresa. null si no se detecta con certeza.',
    },
    documento_identidad: {
      type: 'STRING',
      nullable: true,
      description:
        'Número de cédula, NIT o pasaporte. Solo dígitos, sin puntos ni comas. null si no aparece.',
    },
    telefono_contacto: {
      type: 'STRING',
      nullable: true,
      description:
        'Número de teléfono, solo dígitos, sin espacios ni guiones. null si no aparece.',
    },
    correo_electronico: {
      type: 'STRING',
      nullable: true,
      description:
        'Dirección de correo electrónico en minúsculas. null si no aparece en el documento.',
    },
    asunto_resumido: {
      type: 'STRING',
      nullable: true,
      description:
        'Motivo principal de la solicitud en máximo 120 caracteres. null si el documento es ilegible.',
    },
    dependencia_sugerida: {
      type: 'STRING',
      nullable: true,
      description:
        'Dependencia que debe atender el trámite. Solo una de: "Planeación e Infraestructura", "Desarrollo Social", "Inspección de Policía", "UMATA", "Secretaría de Hacienda". null si no está seguro.',
    },
  },
  required: [
    'tipo_documento_adjunto',
    'nombre_completo',
    'documento_identidad',
    'telefono_contacto',
    'correo_electronico',
    'asunto_resumido',
    'dependencia_sugerida',
  ],
} as const;

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

/**
 * Convierte un ArrayBuffer a string base64 compatible con Gemini inlineData.
 * Usa Buffer de Node.js (disponible en Next.js Route Handlers).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Determina cuáles campos del JSON extraído tienen valor real (no null/vacío).
 */
function calcularCamposEncontrados(
  datos: DatosExtraidos,
): ReadonlyArray<keyof DatosExtraidos> {
  return (Object.keys(datos) as Array<keyof DatosExtraidos>).filter(
    (key) => datos[key] !== null && datos[key] !== '',
  );
}

/**
 * Parsea y valida el JSON devuelto por Gemini contra GeminiExtraccionSchema.
 * Garantiza que todos los campos requeridos existan (aunque sean null).
 * Si Gemini omite un campo (no debería ocurrir con responseSchema), lo normaliza a null.
 */
function normalizarExtraccion(raw: unknown): DatosExtraidos {
  // Gemini con responseMimeType="application/json" devuelve un objeto parseado
  // directamente — no viene como string. Pero si por algún motivo viene como
  // string (fallback de versiones más antiguas), lo parseamos manualmente.
  const parsed: GeminiExtraccionSchema =
    typeof raw === 'string'
      ? (JSON.parse(raw) as GeminiExtraccionSchema)
      : (raw as GeminiExtraccionSchema);

  return {
    nombre:               parsed.nombre_completo        ?? null,
    email:                parsed.correo_electronico     ?? null,
    telefono:             parsed.telefono_contacto      ?? null,
    descripcion:          parsed.asunto_resumido        ?? null,
    tipo_documento:       parsed.tipo_documento_adjunto ?? null,
    documento_identidad:  parsed.documento_identidad   ?? null,
    dependencia_sugerida: parsed.dependencia_sugerida  ?? null,
  };
}

/**
 * Fallback cuando Gemini no está disponible (API key ausente o circuito abierto).
 */
function crearFallbackExtraccion(motivo: string): ResultadoExtraccion {
  return {
    exito: false,
    datos: null,
    camposEncontrados: [],
    mensajeError: motivo,
  };
}

/* ══════════════════════════════════════════════════════════════
   ROUTE HANDLER — POST /api/ai/scan-doc
══════════════════════════════════════════════════════════════ */

/**
 * Endpoint de extracción Vision AI Zero-Data-Entry para SIMI.
 *
 * Flujo:
 * 1. Recibe multipart/form-data con campo "archivo" (imagen o PDF).
 * 2. Valida tipo MIME y tamaño.
 * 3. Convierte a base64 (inlineData de Gemini).
 * 4. Llama Gemini Vision con responseSchema + responseMimeType="application/json".
 * 5. Parsea el JSON nativo — sin limpieza de markdown.
 * 6. Devuelve ResultadoExtraccion con discriminante `exito`.
 *
 * Manejo de errores progresivo:
 * - Sin API key → fallback inmediato con mensaje amigable.
 * - Circuito abierto → fallback inmediato con mensaje de mantenimiento.
 * - Imagen ilegible → Gemini devuelve todos null → mensaje orientativo.
 * - Error de red → reintento automático (Circuit Breaker de resiliencia.ts).
 */
export async function POST(request: Request): Promise<NextResponse<ResultadoExtraccion>> {
  const inicio = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  /* ── 1. Validación de API Key ── */
  if (!apiKey) {
    console.warn('[scan-doc] GEMINI_API_KEY no definida — modo fallback.');
    await registrarLogIA({
      endpoint: 'scan-doc',
      latenciaMs: Date.now() - inicio,
      fallbackActivo: true,
      promptVersion: 'simi-scan-v2.0-no-apikey',
    });
    return NextResponse.json(
      crearFallbackExtraccion(
        'El escáner de documentos no está disponible en este momento. ' +
        'Por favor, ingrese sus datos manualmente en el formulario.',
      ),
    );
  }

  /* ── 2. Parseo multipart/form-data ── */
  let archivo: File;
  try {
    const formData = await request.formData();
    const campo = formData.get('archivo');

    if (!campo || !(campo instanceof File)) {
      return NextResponse.json(
        crearFallbackExtraccion(
          'No recibí ningún archivo. Asegúrate de adjuntar una imagen o PDF.',
        ),
        { status: 400 },
      );
    }

    archivo = campo;
  } catch {
    return NextResponse.json(
      crearFallbackExtraccion(
        'No pude leer el archivo enviado. Intenta de nuevo con una imagen o PDF.',
      ),
      { status: 400 },
    );
  }

  /* ── 3. Validación de tipo MIME y tamaño ── */
  if (!MIME_PERMITIDOS.has(archivo.type)) {
    return NextResponse.json(
      crearFallbackExtraccion(
        `El archivo "${archivo.name}" no es compatible. ` +
        'Solo acepto imágenes (JPG, PNG, WEBP) o PDF.',
      ),
      { status: 415 },
    );
  }

  if (archivo.size > MAX_BYTES) {
    const mb = (archivo.size / (1024 * 1024)).toFixed(1);
    return NextResponse.json(
      crearFallbackExtraccion(
        `El archivo pesa ${mb} MB y supera el límite de 4 MB del escáner. ` +
        'Comprime la imagen o recorta el área del documento.',
      ),
      { status: 413 },
    );
  }

  /* ── 4. Conversión a base64 ── */
  const buffer = await archivo.arrayBuffer();
  const base64Data = arrayBufferToBase64(buffer);

  /* ── 5. Construcción del payload para Gemini Vision ── */
  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}` +
    `:generateContent?key=${apiKey}`;

  const geminiRequestBody = {
    // systemInstruction se aplica como parte del contenido en modo Vision
    systemInstruction: {
      parts: [{ text: SIMI_DATA_EXTRACTION_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          // Instrucción de usuario (mínima — el system prompt lleva el peso)
          {
            text: 'Extrae los datos del siguiente documento y devuelve el JSON estructurado.',
          },
          // Documento adjunto como inlineData (base64)
          {
            inlineData: {
              mimeType: archivo.type,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      // Fuerza JSON nativo — elimina necesidad de parsear/limpiar markdown
      responseMimeType: 'application/json',
      // Schema declarativo que Gemini valida en tiempo de generación
      responseSchema: RESPONSE_SCHEMA,
      // Temperatura 0 para máxima determinismo en extracción de datos
      temperature: 0,
      // Límite de tokens conservador: el JSON de 4 campos cabe en ~200 tokens
      maxOutputTokens: 300,
      // Sin top-p / top-k customización — deixar defaults para 0-shot
    },
  };

  /* ── 6. Llamada a Gemini con malla de resiliencia ── */
  try {
    const response = await ejecutarConResiliencia(
      'GeminiScanDoc',
      async () => {
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiRequestBody),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini Vision error ${res.status}: ${errText}`);
        }

        return res;
      },
      {
        retries: 1,           // Solo 1 reintento — el usuario ya está esperando
        baseDelayMs: 800,
        configBreaker: {
          maxFailures: 4,
          cooldownMs: 90_000, // 90s cooldown en modo escáner
        },
      },
    );

    /* ── 7. Extracción del JSON desde la respuesta de Gemini ── */
    const resData = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawPart = resData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawPart) {
      throw new Error('Gemini no devolvió contenido en candidates[0].content.parts[0].text');
    }

    // Con responseMimeType="application/json", Gemini devuelve el texto del
    // part como una cadena JSON válida. La parseamos aquí.
    const extractedRaw: unknown = JSON.parse(rawPart);
    const datos = normalizarExtraccion(extractedRaw);
    const camposEncontrados = calcularCamposEncontrados(datos);
    const latenciaMs = Date.now() - inicio;

    await registrarLogIA({
      endpoint: 'scan-doc',
      latenciaMs,
      fallbackActivo: false,
      promptVersion: 'simi-scan-v2.0',
    });

    /* ── 8. Respuesta según campos encontrados ── */

    // Si todos son null: documento ilegible (imagen borrosa, recorte vacío, etc.)
    if (camposEncontrados.length === 0) {
      return NextResponse.json<ResultadoExtraccion>({
        exito: false,
        datos: null,
        camposEncontrados: [],
        mensajeError:
          'No fue posible leer ningún dato del documento. ' +
          'Asegúrese de que la imagen esté bien iluminada y que el texto sea visible. ' +
          'Intente con otra foto o ingrese los datos manualmente.',
      });
    }

    // Éxito parcial o total
    return NextResponse.json<ResultadoExtraccion>({
      exito: true,
      datos,
      camposEncontrados,
      // Advertencia si solo se encontró 1 campo de 4
      advertencia:
        camposEncontrados.length === 1
          ? 'Solo encontré un dato. Verifica el resto de los campos del formulario.'
          : null,
    });

  } catch (error: unknown) {
    const latenciaMs = Date.now() - inicio;
    const msg = error instanceof Error ? error.message : String(error);

    console.error('[scan-doc] Error en extracción Vision AI:', msg);

    await registrarLogIA({
      endpoint: 'scan-doc',
      latenciaMs,
      error: msg,
      fallbackActivo: true,
      promptVersion: 'simi-scan-v2.0-error',
    });

    // Mensajes de error diferenciados por tipo de falla
    const estaCircuitoAbierto = msg.includes('OPEN');
    const mensajeError = estaCircuitoAbierto
      ? 'El escáner está en mantenimiento momentáneo (máx. 90 segundos). ' +
        'Por favor, ingrese sus datos manualmente por ahora.'
      : 'Ocurrió un error al analizar el documento. ' +
        'Intenta con otra imagen o ingresa los datos manualmente en el formulario.';

    return NextResponse.json<ResultadoExtraccion>(
      {
        exito: false,
        datos: null,
        camposEncontrados: [],
        mensajeError,
      },
      { status: 500 },
    );
  }
}
