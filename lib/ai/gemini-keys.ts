/**
 * Rotación de claves de Gemini.
 *
 * El plan gratuito de Gemini tiene una cuota diaria/por minuto que se
 * agota con uso real; cuando pasa, Gemini responde HTTP 429
 * ("RESOURCE_EXHAUSTED / exceeded your current quota"). Tener más de
 * una clave permite que, cuando la primera se agota, el sistema rote a
 * la siguiente y siga funcionando.
 *
 * Las claves NUNCA viven en el código: se leen de variables de entorno
 * configuradas en Vercel. Orden de preferencia:
 *   1. GEMINI_API_KEY        (principal)
 *   2. GEMINI_API_KEY_2      (respaldo)
 *   3. GEMINI_API_KEYS       (lista separada por comas, para N claves)
 *
 * Función pura: no conoce ninguna clave; solo lee el entorno.
 */

export function obtenerClavesGemini(): string[] {
  const crudas = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    ...(process.env.GEMINI_API_KEYS?.split(',') ?? []),
  ];

  const vistas = new Set<string>();
  const claves: string[] = [];
  for (const c of crudas) {
    const clave = c?.trim();
    if (clave && !vistas.has(clave)) {
      vistas.add(clave);
      claves.push(clave);
    }
  }
  return claves;
}

/**
 * Detecta si un error de Gemini es por cuota agotada (429) — el caso
 * en el que vale la pena rotar a otra clave. Otros errores (red,
 * bloqueo de seguridad, JSON inválido) no se resuelven cambiando clave.
 */
export function esErrorDeCuota(mensaje: string): boolean {
  const m = mensaje.toLowerCase();
  return m.includes('429')
    || m.includes('resource_exhausted')
    || m.includes('exceeded your current quota')
    || m.includes('quota');
}
