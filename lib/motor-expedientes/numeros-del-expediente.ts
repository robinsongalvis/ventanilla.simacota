/**
 * LOS DOS NÚMEROS DE UN EXPEDIENTE DE LICENCIAS (ADR-0041).
 *
 * Un expediente vive con dos números que significan cosas distintas:
 *
 *   · el de ENTRADA — `1-110-AAAAMM-XXXXXXXX`, el radicado de ventanilla:
 *     la constancia de que la solicitud entró y el ancla del término
 *     (ADR-0034). Es el que el ciudadano tiene en la mano.
 *   · el del EXPEDIENTE — `68745-0-AA-CCCC`, la serie de Planeación que
 *     continúa el libro del ingeniero. Es el que se habla en la Secretaría.
 *
 * Hoy los dos son el MISMO objeto: tras el pivote del 26-ago, `numeroExpediente`
 * carga el 1-110 con `serieId: 'radicados'`. El ADR-0041 los separa de nuevo, y
 * este módulo existe para que las superficies —papel, correo, pantalla— dejen de
 * leer «el número» a secas y pasen a pedir EL QUE NECESITAN, por su significado.
 *
 * Escrito en el paso 1 del ADR: con los datos de hoy, todo llamador obtiene
 * exactamente el mismo valor que obtenía antes (no-op verificable). Lo que
 * cambia es que el día que los números se separen, cada superficie ya estará
 * pidiendo el correcto.
 *
 * ALCANCE (ADR-0033 §4.6-bis). Esto SABE: qué número es de entrada, qué rótulo
 * le corresponde a cada serie. Esto NO sabe: de dónde salen los números
 * (`emitir-numero-expediente.ts`), ni cómo se formatean (`numero-expediente.ts`,
 * `radicado-institucional.ts`), ni si el expediente tiene derecho a tenerlos.
 */

/** Lo mínimo que necesitan estas funciones — no acopla al documento entero. */
export interface NumerosDelExpediente {
  numeroExpediente?: { numero: string; serieId: string } | null;
  /**
   * Id del radicado de ventanilla vinculado. NO es una llave opaca: el
   * documento vive en `ventanilla_radicados/{radicadoId}` y el id ES el número
   * `1-110-…` (`formatearRadicadoInstitucional`). Nulo cuando el expediente
   * nació sin vínculo; en legados puede traer formas `1-WEB-`/`EXT-…`.
   */
  radicadoId?: string | null;
  /** El espejo del `1-110-…` escrito por el acto de radicar (ADR-0041 §3.1). */
  numeroRadicadoEntrada?: string | null;
}

/**
 * El número de ENTRADA del expediente — el `1-110-…` que el ciudadano tiene.
 *
 * Precedencia: el vínculo manda. La caída a `numeroExpediente` existe porque
 * HOY ese campo carga exactamente el mismo 1-110 para los expedientes ya
 * radicados sin vínculo digital — sin ella, esos perderían su número al
 * cambiar los llamadores, que es justo lo que el paso 1 debe evitar.
 *
 * PRECEDENCIA (paso 4, 2-sep-2026): manda el ESPEJO, que el acto de radicar
 * escribe y que existe también para el expediente sin vínculo digital; luego
 * el vínculo. La caída a `numeroExpediente` sobrevive SOLO para los
 * expedientes radicados ANTES de que el espejo existiera —cuyo campo carga un
 * 1-110 de la serie `radicados`— y por eso comprueba la serie: el día que ahí
 * viva un 68745, devolverlo sería la mentira que este módulo evita.
 */
export function numeroDeEntrada(exp: NumerosDelExpediente): string | null {
  if (exp.numeroRadicadoEntrada) return exp.numeroRadicadoEntrada;
  if (exp.radicadoId) return exp.radicadoId;
  const propio = exp.numeroExpediente;
  if (propio && esSerieDeEntrada(propio.serieId)) return propio.numero;
  return null;
}

/** `true` si la serie emite números de VENTANILLA (entrada), no de expediente. */
export function esSerieDeEntrada(serieId: string | null | undefined): boolean {
  return serieId === 'radicados';
}

/**
 * `true` si el número pertenece a una serie LEGAL — la que se le puede decir a
 * un ciudadano porque alguien podrá encontrar el trámite con ella.
 *
 * `demo` y `e2e-stage` no lo son: existen para que nadie confunda un ensayo con
 * un acto. Un número ausente tampoco lo es, y esa es la diferencia que el gate
 * de comunicaciones no sabía hacer (cortaba por el prefijo `DEMO-`, así que un
 * expediente SIN número se le escapaba).
 */
export function esNumeroLegal(numeroExpediente: { numero: string; serieId: string } | null | undefined): boolean {
  if (!numeroExpediente?.numero) return false;
  return !SERIES_NO_LEGALES.has(numeroExpediente.serieId);
}

const SERIES_NO_LEGALES = new Set(['demo', 'e2e-stage']);

/**
 * El rótulo con el que se presenta un número, según la serie que lo emitió.
 *
 * Rotular por SERIE y no por posición es lo que permite que un documento viejo
 * —cuyo `numeroExpediente` carga un 1-110— siga diciendo «Radicado» para
 * siempre, sin reescribir un solo dato (AGN 060: no se renumera). El día que
 * los expedientes nuevos lleven el 68745, la misma función dirá «Expediente»
 * para ellos, en la misma pantalla, sin ramificar en cada superficie.
 */
export function rotuloDeSerie(serieId: string | null | undefined): string {
  switch (serieId) {
    case 'radicados':
      return 'Radicado';
    case 'expedientes':
    case 'historico-consecutivo-planeacion':
      return 'Expediente';
    case 'demo':
    case 'e2e-stage':
      return 'N.º de demostración';
    default:
      // Serie desconocida (dato legado o de una fuente futura): se rotula
      // neutro en vez de inventarle una identidad que no consta.
      return 'Número';
  }
}
