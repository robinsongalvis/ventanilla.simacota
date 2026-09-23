/**
 * lib/motor-expedientes/acto-construccion/decisiones-pendientes-construccion.ts
 *
 * CAPA 4 — PENDIENTES. Todo lo que depende del formato real de la resolución
 * de construcción —que Planeación aún no ha entregado— o de un concepto que no
 * tenemos, declarado como dato: qué falta, quién lo decide, qué bloquea.
 *
 * ── POR QUÉ UN CATÁLOGO Y NO SEIS `TODO` ──────────────────────────────────
 *
 * Igual que en subdivisión: un `TODO` no se consulta desde una pantalla, no
 * sale en un informe y no impide que alguien rellene el hueco con lo primero
 * que se le ocurra. Esto es un dato. El día que lleguen las respuestas, el
 * trabajo es rellenar estos valores —no buscar dónde iban.
 *
 * ── LO QUE AQUÍ **NO** ES PENDIENTE (Y EN SUBDIVISIÓN SÍ LO ERA) ───────────
 *
 *  · El ORIGEN de la vigencia. En subdivisión quedó pendiente si los meses
 *    corren desde la expedición o desde la firmeza; en construcción la norma lo
 *    fija en la FIRMEZA (art. 2.2.6.1.2.4.1) y el motor ya lo ejecuta. No hay
 *    nada que preguntar.
 *  · La SERIE y el FORMATO del número. Ya se decidieron (serie por modalidad,
 *    «LC No. 001-2026», `../acto-lsr/serie-acto-lsr.ts`). Lo único que falta es
 *    ABRIR el contador en producción, y eso lo hace el propietario — no es una
 *    decisión de diseño, es un paso operativo.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECLARA qué falta y quién lo decide. NO decide ninguno, ni ofrece un
 * valor por defecto para ninguno.
 */

/** Quién resuelve cada pendiente. */
export type DecideQuien = 'PLANEACION' | 'JURIDICA' | 'PLANEACION_O_JURIDICA';

export interface PendienteConstruccion {
  id: string;
  pregunta: string;
  decide: DecideQuien;
  /** Qué parte del acto queda en blanco mientras no haya respuesta. */
  bloquea: string;
  /** La evidencia que tenemos hoy, y por qué no basta para decidir sola. */
  evidencia: string;
}

export const PENDIENTES_CONSTRUCCION: readonly PendienteConstruccion[] = [
  {
    id: 'FORMATO_RESOLUCION',
    pregunta: '¿Cuál es el formato oficial de la resolución de licencia de construcción (encabezado, artículos, orden, texto fijo)?',
    decide: 'PLANEACION',
    bloquea: 'Todo el cuerpo del acto. Sin el formato solo se puede armar el esqueleto y volcar los datos en huecos rotulados; no se puede expedir.',
    evidencia:
      'De subdivisión tenemos el acto real (F-PGJ-002) y por eso pudimos transcribirlo. De construcción tenemos el formato de '
      + 'REQUISITOS (F-PGD-009 v02), pero no el de la RESOLUCIÓN. Redactar los artículos por nuestra cuenta sería inventar el acto.',
  },
  {
    id: 'CONSIDERANDOS',
    pregunta: '¿Qué motivación de hecho y de derecho lleva el considerando (citas normativas, revisión del proyecto, concepto técnico)?',
    decide: 'PLANEACION_O_JURIDICA',
    bloquea: 'El cuerpo de los considerandos.',
    evidencia:
      'La motivación es contenido del acto y depende del formato y del expediente concreto. No se puede redactar sin el formato ni '
      + 'sin el concepto técnico de cada caso.',
  },
  {
    id: 'TARIFA_EXPENSAS_CONSTRUCCION',
    pregunta: '¿Cuál es la tarifa de expensas de la licencia de construcción (Acuerdo Municipal), y sobre qué base se liquida (área, valor de obra, estrato)?',
    decide: 'PLANEACION',
    bloquea: 'El artículo de expensas y su liquidación.',
    evidencia:
      'La tarifa de SUBDIVISIÓN está transcrita (Acuerdo 026 art. 194 ítem 10: cinco S.M.D.L.V. por lote). La de CONSTRUCCIÓN no está '
      + 'en el repositorio. Sin ella no se puede liquidar; poner una «parecida» sería inventar el cobro de un acto administrativo.',
  },
  {
    id: 'TEXTO_RECURSOS',
    pregunta: '¿Contra la resolución de construcción proceden reposición Y apelación, o solo reposición?',
    decide: 'JURIDICA',
    bloquea: 'El artículo de recursos y la advertencia del acta de notificación.',
    evidencia:
      'Precedente FUERTE de solo reposición: la mesa del 10-ago-2026 (en Simacota todo queda en la Secretaría de Planeación) y el acto '
      + 'de desistimiento que el sistema ya redacta. Es el mismo criterio que se ratificó para subdivisión el 14-sep-2026. Se confirma '
      + 'para construcción en vez de extender la ratificación de otra figura: enunciar mal los recursos vicia la notificación.',
  },
  {
    id: 'REQUISITOS_MODALIDADES',
    pregunta: '¿Cuáles son los requisitos de las 8 modalidades distintas de obra nueva (ampliación, adecuación, modificación, restauración, reforzamiento, demolición, cerramiento, reconstrucción)?',
    decide: 'PLANEACION',
    bloquea: 'La evaluación de completitud y la parte resolutiva de toda solicitud que no sea de obra nueva.',
    evidencia:
      'Solo obra nueva tiene formato de requisitos aportado y verificado (F-PGD-009 v02). Las otras ocho no tienen lista, y no comparten '
      + 'la de obra nueva (una demolición no pide proyecto arquitectónico). Ver `./requisitos-por-modalidad.ts`.',
  },
  {
    id: 'NOMBRES_MODALIDADES',
    pregunta: '¿Coinciden los nombres de las 9 modalidades con el texto oficial del art. 2.2.6.1.1.7?',
    decide: 'PLANEACION',
    bloquea: 'El rótulo de la modalidad en el acto y en los papeles del ciudadano.',
    evidencia:
      'La investigación normativa solo confirmó por cita textual la posición de demolición (numeral 7). Los otros ocho nombres vienen del '
      + 'orden estándar del decreto, sin cotejo contra la fuente (SUIN-Juriscol estuvo inaccesible). Ver `../catalogo-subtipos-normativo.ts`.',
  },
];

/**
 * Los valores que el generador RECIBE cuando existan. `null` = SIN DECIDIR /
 * SIN EMITIR — nunca «usa el más común».
 */
export interface ParametrosActoConstruccion {
  /**
   * El número ya emitido, tal cual debe imprimirse («LC No. 001-2026»). Lo
   * RECIBE el generador. La serie y el formato ya están decididos
   * (`../acto-lsr/serie-acto-lsr.ts`); lo que falta es abrir el contador en
   * producción, que es un paso del propietario, no de este módulo.
   */
  numeroResolucion: string | null;
  /** El texto literal del artículo de recursos, cuando Jurídica lo confirme. */
  textoRecursos: string | null;
  /**
   * ¿Planeación ya entregó el formato de la resolución? Mientras sea `false`,
   * el generador NUNCA da un acto por expedible: puede armar el esqueleto y
   * volcar los datos, pero no producir el documento final.
   */
  formatoEntregado: boolean;
}

/** Ningún parámetro decidido y sin formato — el estado de hoy, escrito una sola vez. */
export const SIN_DECIDIR_CONSTRUCCION: ParametrosActoConstruccion = {
  numeroResolucion: null,
  textoRecursos: null,
  formatoEntregado: false,
};

/** Qué pendientes siguen abiertos, dado un juego de parámetros. */
export function pendientesQueFaltan(p: ParametrosActoConstruccion): PendienteConstruccion[] {
  const abiertos = new Set<string>();
  /* El formato arrastra a los considerandos: sin formato no hay dónde ponerlos. */
  if (!p.formatoEntregado) abiertos.add('FORMATO_RESOLUCION').add('CONSIDERANDOS');
  if (!p.textoRecursos) abiertos.add('TEXTO_RECURSOS');
  /* Estos dos no dependen de los parámetros: son huecos del dominio que siguen
     abiertos hasta que Planeación los cierre, tenga o no formato el acto. */
  abiertos.add('TARIFA_EXPENSAS_CONSTRUCCION').add('REQUISITOS_MODALIDADES').add('NOMBRES_MODALIDADES');
  return PENDIENTES_CONSTRUCCION.filter((d) => abiertos.has(d.id));
}
