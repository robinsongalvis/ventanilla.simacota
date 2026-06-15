/* ══════════════════════════════════════════════════════════════
   Instrucciones por acción de SIMI.

   Cada acción tiene un texto que se concatena al prompt maestro y
   al contexto del radicado. Las instrucciones refuerzan la
   estructura obligatoria de salida y delimitan el alcance de la
   acción para que el modelo no se desvíe.

   Las acciones soportadas cubren los flujos del sprint:
   - RESUMIR_RADICADO        — resumen ejecutivo.
   - EXPLICAR_ESTADO         — interpretación del estado actual.
   - REVISAR_TERMINO         — análisis de cumplimiento legal.
   - SUGERIR_DEPENDENCIA     — para Recepción al asignar.
   - ANALIZAR_COMPETENCIA    — análisis de competencia (nuevo).
   - AYUDAR_A_RESPONDER      — apoyo integral (nuevo).
   - SUGERIR_RESPUESTA       — borrador de respuesta corto.
   - GENERAR_BORRADOR_OFICIO — borrador en formato oficio formal.
   - MEJORAR_RESPUESTA       — pule la respuesta del funcionario (nuevo).
   - VERIFICAR_CALIDAD       — clasifica APTA/AJUSTES/NO APTA (nuevo).
   - VALIDAR_RESPUESTA       — alias legacy de VERIFICAR_CALIDAD.
   - CONTINUAR_RESPUESTA     — completa una salida truncada (nuevo).
   - RESUMIR_TRAZABILIDAD    — cronología legible.
══════════════════════════════════════════════════════════════ */

export type AccionSimi =
  | 'RESUMIR_RADICADO'
  | 'EXPLICAR_ESTADO'
  | 'REVISAR_TERMINO'
  | 'SUGERIR_DEPENDENCIA'
  | 'ANALIZAR_COMPETENCIA'
  | 'AYUDAR_A_RESPONDER'
  | 'SUGERIR_RESPUESTA'
  | 'GENERAR_BORRADOR_OFICIO'
  | 'MEJORAR_RESPUESTA'
  | 'VERIFICAR_CALIDAD'
  | 'VALIDAR_RESPUESTA'
  | 'CONTINUAR_RESPUESTA'
  | 'RESUMIR_TRAZABILIDAD';

export const ACCIONES_SIMI_VALIDAS: ReadonlySet<AccionSimi> = new Set<AccionSimi>([
  'RESUMIR_RADICADO',
  'EXPLICAR_ESTADO',
  'REVISAR_TERMINO',
  'SUGERIR_DEPENDENCIA',
  'ANALIZAR_COMPETENCIA',
  'AYUDAR_A_RESPONDER',
  'SUGERIR_RESPUESTA',
  'GENERAR_BORRADOR_OFICIO',
  'MEJORAR_RESPUESTA',
  'VERIFICAR_CALIDAD',
  'VALIDAR_RESPUESTA',
  'CONTINUAR_RESPUESTA',
  'RESUMIR_TRAZABILIDAD',
]);

/** Acciones que NO requieren la estructura de 6 títulos obligatorios. */
const ACCIONES_BREVES: ReadonlySet<AccionSimi> = new Set<AccionSimi>([
  'RESUMIR_RADICADO',
  'EXPLICAR_ESTADO',
  'REVISAR_TERMINO',
  'RESUMIR_TRAZABILIDAD',
]);

export function requiereEstructuraCompleta(accion: AccionSimi): boolean {
  return !ACCIONES_BREVES.has(accion);
}

export interface InstruccionInput {
  accion:             AccionSimi;
  mensajeUsuario?:    string;
  respuestaBorrador?: string;
  ultimaSalidaPrevia?: string;
}

export function instruccionParaAccion(input: InstruccionInput): string {
  const { accion, mensajeUsuario, respuestaBorrador, ultimaSalidaPrevia } = input;

  const indicacion = mensajeUsuario?.trim()
    ? `\nIndicación adicional del funcionario: ${mensajeUsuario.trim()}`
    : '';

  switch (accion) {
    case 'RESUMIR_RADICADO':
      return [
        'INSTRUCCIÓN: Genera un resumen ejecutivo del radicado.',
        'Incluye: qué solicita el ciudadano, tipo PQRSD, dependencia actual, estado, fecha límite, puntos clave e información faltante.',
        'Máximo 200 palabras. Tono institucional.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'EXPLICAR_ESTADO':
      return [
        'INSTRUCCIÓN: Explica el estado actual del radicado en lenguaje administrativo claro.',
        'Indica qué significa el estado, qué acciones se esperan, y quién es el responsable.',
        'Si está vencido o por vencer, destácalo de forma explícita.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'REVISAR_TERMINO':
      return [
        'INSTRUCCIÓN: Analiza el cumplimiento del término legal del radicado.',
        'Indica fecha de radicación, fecha de vencimiento, días hábiles restantes, prórrogas, y recomendaciones para cumplir el plazo.',
        'Si está vencido, indica las implicaciones MIPG.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'SUGERIR_DEPENDENCIA':
      return [
        'INSTRUCCIÓN: Basándote en el asunto, la descripción y la evaluación automática de competencia,',
        'sugiere cuál dependencia debería atender el caso si la asignación actual no es correcta.',
        'Justifica brevemente. Si la asignación actual es adecuada (nivel ALTO), dilo y no recomiendes cambio.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'ANALIZAR_COMPETENCIA':
      return [
        'INSTRUCCIÓN: Analiza si la dependencia asignada es competente para responder esta solicitud.',
        'Usa la EVALUACIÓN AUTOMÁTICA DE COMPETENCIA del contexto como insumo.',
        'En la sección "Análisis de competencia" del formato obligatorio incluye:',
        '- Si la dependencia parece competente.',
        '- Nivel de confianza (ALTO/MEDIO/BAJO/DUDOSO).',
        '- Razón.',
        '- Dependencia sugerida si aplica.',
        '- Si requiere escalamiento o revisión jurídica.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'AYUDAR_A_RESPONDER':
      return [
        'INSTRUCCIÓN: Apoyo integral al funcionario para preparar la respuesta.',
        'Debes producir (en este orden, usando los títulos obligatorios):',
        '1) Resumen — qué solicita el ciudadano, en una o dos frases.',
        '2) Análisis de competencia — si la dependencia es competente.',
        '3) Puntos a responder — bullets con cada punto sustantivo de la solicitud que la respuesta debe abordar.',
        '4) Borrador sugerido — texto plano en estilo institucional, listo para que el funcionario edite y convierta en oficio.',
        '5) Advertencias — datos faltantes, riesgos jurídicos, supuestos.',
        '6) Siguiente acción recomendada.',
        'NO inventes hechos ni normas. Si falta información, dilo.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'SUGERIR_RESPUESTA':
      return [
        'INSTRUCCIÓN: Sugiere una respuesta preliminar para esta solicitud.',
        'La respuesta debe ser institucional, respetuosa y de fondo.',
        'Esto es un BORRADOR para revisión del funcionario — NO una respuesta oficial.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'GENERAR_BORRADOR_OFICIO':
      return [
        'INSTRUCCIÓN: Genera el cuerpo SUSTANTIVO de la respuesta para que el funcionario lo pegue en la plantilla institucional del sistema (`Generar plantilla` en el panel de respuesta).',
        'NO repitas el encabezado, ciudad/fecha, destinatario, asunto, saludo, cierre ni firma — esos los compone el builder oficio-institucional del sistema.',
        'Solo entrega el cuerpo (texto plano), suficiente como respuesta de fondo.',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'MEJORAR_RESPUESTA':
      return [
        'INSTRUCCIÓN: El funcionario escribió la siguiente respuesta y quiere mejorarla.',
        '"""',
        respuestaBorrador ?? '(no proporcionada)',
        '"""',
        'Tareas:',
        '- Corregir redacción.',
        '- Hacerla más clara, precisa e institucional.',
        '- Verificar que responda de fondo a la solicitud.',
        '- NO cambiar el sentido de la decisión administrativa del funcionario.',
        '- NO inventar hechos nuevos ni normas.',
        'Devuelve EXACTAMENTE estas dos secciones (con estos títulos):',
        '',
        'Versión mejorada:',
        '[texto pulido completo, sin recortes]',
        '',
        'Cambios realizados:',
        '- [bullet uno]',
        '- [bullet dos]',
        '',
        'Advertencias:',
        '- [si no hay, escribe "Ninguna"]',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'VERIFICAR_CALIDAD':
    case 'VALIDAR_RESPUESTA':
      return [
        'INSTRUCCIÓN: Evalúa la calidad de la respuesta borrador del funcionario y clasifícala.',
        '"""',
        respuestaBorrador ?? '(no proporcionada)',
        '"""',
        'Devuelve EXACTAMENTE este formato:',
        '',
        'Resultado: APTA | APTA CON AJUSTES | NO APTA',
        '',
        'Criterios evaluados:',
        '- Claridad: [comentario corto]',
        '- Precisión: [comentario corto]',
        '- Congruencia con la solicitud: [comentario corto]',
        '- Respuesta de fondo: [comentario corto]',
        '- Tono institucional: [comentario corto]',
        '- Datos sensibles: [comentario corto — verifica que no expone PII si el radicado es anónimo/reservado]',
        '- Riesgo jurídico: [comentario corto]',
        '- Competencia: [comentario corto]',
        '',
        'Recomendaciones puntuales:',
        '- [bullet por cada ajuste sugerido]',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'CONTINUAR_RESPUESTA':
      return [
        'INSTRUCCIÓN: La salida anterior quedó incompleta o truncada.',
        'Continúa exactamente desde donde se cortó, SIN repetir el contenido anterior y SIN reescribirlo desde cero.',
        'Mantén la estructura, el tono y el formato. Cierra con la sección final que faltaba (no dejes nada abierto).',
        '',
        'ÚLTIMA SALIDA PREVIA (referencia, no la repitas):',
        '"""',
        ultimaSalidaPrevia ?? '(no disponible)',
        '"""',
        indicacion,
      ].filter(Boolean).join('\n');

    case 'RESUMIR_TRAZABILIDAD':
      return [
        'INSTRUCCIÓN: Genera un resumen cronológico de la trazabilidad del radicado.',
        'Para cada evento relevante, indica qué ocurrió, quién lo hizo y cuándo.',
        'Destaca tiempos entre eventos y posibles demoras.',
        indicacion,
      ].filter(Boolean).join('\n');
  }
}

/**
 * Heurística para detectar si la salida del modelo quedó truncada.
 *
 * El cliente puede usarla además de `finishReason === 'MAX_TOKENS'`
 * para mostrar el botón "Continuar respuesta".
 */
export function pareceSalidaTruncada(texto: string): boolean {
  if (!texto) return false;
  const ult = texto.trimEnd();
  if (ult.length === 0) return false;
  const ultChar = ult.slice(-1);
  // Última oración sin puntuación final + sin nota de cierre del sistema
  if (!/[.!?»"')\]]/.test(ultChar) && !ult.endsWith('[Respuesta cerrada hasta aquí. El funcionario puede solicitar continuar.]')) {
    return true;
  }
  // Sección abierta sin contenido (último título sin línea siguiente)
  const ultimasLineas = ult.split('\n').slice(-3).map((l) => l.trim()).filter(Boolean);
  const titulosObligatorios = new Set([
    'Resumen', 'Análisis de competencia', 'Puntos a responder',
    'Borrador sugerido', 'Advertencias', 'Siguiente acción recomendada',
  ]);
  for (const linea of ultimasLineas) {
    if (titulosObligatorios.has(linea.replace(/:$/, ''))) return true;
  }
  return false;
}
