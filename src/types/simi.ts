/**
 * Tipos del Agente SIMI — Ventanilla Única de Simacota
 *
 * Contrato de datos para la extracción Zero-Data-Entry mediante Vision AI.
 * Todos los campos son nullable porque el modelo puede no encontrar
 * el dato en el documento (imagen borrosa, recorte parcial, etc.).
 */

/* ══════════════════════════════════════════════════════════════
   CONTRATO DE EXTRACCIÓN (7 campos — Vision AI v2.1)
══════════════════════════════════════════════════════════════ */

/**
 * Datos extraídos de un documento por Vision AI.
 * Los 4 primeros campos mapean 1:1 con el formulario público de radicación.
 * Los 3 últimos son metadatos de enrutamiento que se muestran en el chat.
 *
 * `null` = campo no encontrado en el documento (no confundir con cadena vacía).
 */
export interface DatosExtraidos {
  /** Nombre completo de la persona o razón social de la empresa */
  nombre: string | null;
  /** Correo electrónico de contacto */
  email: string | null;
  /** Número de celular colombiano (10 dígitos, sin espacios) */
  telefono: string | null;
  /** Descripción o asunto de la solicitud inferido del documento */
  descripcion: string | null;
  /** Tipo de documento detectado (ej. "Carta formal", "Cédula de Ciudadanía") */
  tipo_documento: string | null;
  /** Número de cédula, NIT o pasaporte — solo dígitos */
  documento_identidad: string | null;
  /** Dependencia sugerida según el contenido del documento */
  dependencia_sugerida: string | null;
}

/* ══════════════════════════════════════════════════════════════
   RESULTADO DEL ENDPOINT /api/ai/scan-doc
══════════════════════════════════════════════════════════════ */

/** Resultado exitoso: Vision AI encontró al menos un campo útil */
export interface ResultadoExtraccionExitosa {
  exito: true;
  datos: DatosExtraidos;
  /** Campos que sí fueron encontrados en el documento */
  camposEncontrados: ReadonlyArray<keyof DatosExtraidos>;
  /** Advertencias opcionales (ej: imagen de baja resolución pero legible) */
  advertencia: string | null;
}

/** Resultado fallido: documento ilegible, tipo incorrecto o error de red */
export interface ResultadoExtraccionFallida {
  exito: false;
  datos: null;
  camposEncontrados: [];
  /** Mensaje amigable para mostrar directamente en el chat de SIMI */
  mensajeError: string;
}

export type ResultadoExtraccion =
  | ResultadoExtraccionExitosa
  | ResultadoExtraccionFallida;

/* ══════════════════════════════════════════════════════════════
   CHAT — MENSAJES DEL ASISTENTE SIMI
══════════════════════════════════════════════════════════════ */

export type RolMensaje = 'user' | 'assistant';

export interface MensajeChat {
  readonly id: string;
  readonly rol: RolMensaje;
  readonly contenido: string;
  readonly timestamp: number;
  /** Si el mensaje es resultado de una extracción de documento */
  readonly esExtraccion?: boolean;
}

/* ══════════════════════════════════════════════════════════════
   ESTADO INTERNO DEL COMPONENTE SimiChat
══════════════════════════════════════════════════════════════ */

export type EstadoSimi =
  | 'IDLE'         // Esperando input del usuario
  | 'CARGANDO'     // Esperando respuesta del chat
  | 'ESCANEANDO'   // Procesando documento con Vision AI
  | 'ERROR';       // Error irrecuperable (se muestra en el chat)

/* ══════════════════════════════════════════════════════════════
   PAYLOAD DEL ENDPOINT /api/ai/scan-doc (Request)
══════════════════════════════════════════════════════════════ */

/**
 * El endpoint acepta multipart/form-data con este campo.
 * Definido aquí como documentación del contrato.
 */
export interface ScanDocFormData {
  /** Archivo de imagen (JPEG, PNG) o PDF — máx 4 MB */
  archivo: File;
}

/* ══════════════════════════════════════════════════════════════
   RESPUESTA INTERNA DE GEMINI VISION (estructura esperada)
   Usada solo para tipado interno del route handler.
══════════════════════════════════════════════════════════════ */

/**
 * Estructura del JSON que Gemini devuelve con responseMimeType="application/json".
 * Usa los nombres exactos del prompt v2.1 — normalizarExtraccion() los mapea a DatosExtraidos.
 */
export interface GeminiExtraccionSchema {
  tipo_documento_adjunto: string | null;
  nombre_completo: string | null;
  documento_identidad: string | null;
  telefono_contacto: string | null;
  correo_electronico: string | null;
  asunto_resumido: string | null;
  dependencia_sugerida: string | null;
}
