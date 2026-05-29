/**
 * Tipos del Agente SIMI — Ventanilla Única de Simacota
 *
 * Contrato de datos para la extracción Zero-Data-Entry mediante Vision AI.
 * Todos los campos son nullable porque el modelo puede no encontrar
 * el dato en el documento (imagen borrosa, recorte parcial, etc.).
 */

/* ══════════════════════════════════════════════════════════════
   CONTRATO DE EXTRACCIÓN (4 campos del formulario público)
══════════════════════════════════════════════════════════════ */

/**
 * Datos extraídos de un documento por Vision AI.
 * Mapeados 1:1 con los campos del formulario público de radicación.
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
 * Estructura del JSON que Gemini debe devolver con responseMimeType="application/json".
 * Coincide con DatosExtraidos — es el esquema que se fuerza mediante responseSchema.
 */
export interface GeminiExtraccionSchema {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  descripcion: string | null;
}
