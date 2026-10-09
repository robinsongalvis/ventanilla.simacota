/**
 * lib/motor-expedientes/acto-construccion/datos-acto-construccion.ts
 *
 * CAPA 2 — DINÁMICA. El contrato de datos de la resolución de licencia de
 * construcción: lo que el acto tiene que saber del expediente para poder
 * redactarse, con el nombre que la funcionaria entiende.
 *
 * ── LA DIFERENCIA CON EL F-PGJ-002 (SUBDIVISIÓN) ──────────────────────────
 *
 * En subdivisión pudimos transcribir el acto real que entregó el ingeniero, y
 * de él salieron uno a uno los campos. Aquí NO tenemos el formato: Planeación
 * todavía no lo ha entregado. Por eso este contrato NO pretende ser la lista
 * cerrada de todo lo que el documento final imprimirá —eso depende del formato
 * que falta—, sino la lista de lo que HOY sabemos que una resolución de
 * construcción necesita, separando con honestidad:
 *
 *   · lo que el expediente YA puede dar (titular, predio, modalidades);
 *   · lo que NO existe en ningún campo del sistema y hay que capturar
 *     (área construida, número de pisos, uso, valor de la obra, el
 *     profesional responsable) — marcado, no rellenado.
 *
 * Esa segunda lista es el trabajo de intake que la resolución exige, y aparece
 * aquí, en un tipo, en vez de descubrirse el día que alguien pulse «generar».
 * `desde-expediente-construccion.ts` la reporta campo por campo.
 *
 * ── LO QUE NO ENTRA, Y POR QUÉ ────────────────────────────────────────────
 *
 * El NÚMERO de la resolución no está aquí: vive en `ParametrosActoConstruccion`
 * (`./decisiones-pendientes-construccion.ts`), porque no es un dato del
 * expediente sino un consecutivo que se emite bajo una serie ya decidida pero
 * todavía sin abrir en producción. Y el TEXTO de los artículos tampoco: ese es
 * el formato que falta, no un dato que alguien rellene.
 *
 * ── ALCANCE DECLARADO (ADR-0033 §4.6-bis) ─────────────────────────────────
 *
 * Esto DECLARA qué recibe el generador y qué debe capturar el intake. NO
 * captura nada, NO rellena ausencias y NO decide el formato del documento.
 */

/** Un titular de la licencia. Puede haber varios (copropiedad, sucesión). */
export interface TitularConstruccion {
  nombre: string;
  /** C.C. o NIT, tal como se imprime. */
  documento: string;
}

/**
 * El profesional que firma el proyecto y se hace responsable de él. En
 * construcción el acto lo nombra por su clase —arquitecto o ingeniero— y por su
 * matrícula profesional; llamarlo por la clase equivocada en un acto
 * administrativo no es un detalle menor.
 */
export interface ProfesionalConstruccion {
  nombre: string;
  clase: 'ARQUITECTO' | 'INGENIERO';
  /** Matrícula profesional, p. ej. «A.P. No. 68-0000». */
  matricula: string;
}

/** La escritura pública que soporta la propiedad del predio. */
export interface EscrituraConstruccion {
  numero: string;
  /** Fecha de la escritura, ISO. */
  fecha: string;
  notaria: string;
  circulo: string;
}

/**
 * LOS DATOS TÉCNICOS DE LA OBRA — los que HOY no existen en el sistema.
 *
 * Ninguno de estos campos tiene lugar donde guardarse en el expediente actual
 * (`lib/motor-expedientes/tipos.ts` — `DatosPredio` solo trae dirección,
 * barrio/vereda, matrícula y área en texto; no hay área construida, ni pisos,
 * ni uso, ni valor de obra). Se declaran aquí, agrupados y explícitos, porque
 * una resolución de construcción los cita —el área que autoriza, los pisos que
 * aprueba, el uso al que destina, el valor sobre el que liquida expensas— y sin
 * ellos el acto tendría huecos en su parte resolutiva.
 *
 * Se modelan como texto/opcionales y NO se infieren de nada: la ausencia
 * significa «no se capturó», que no es cero ni «no aplica».
 */
export interface DatosTecnicosObra {
  /** Área a construir / intervenir, verbatim (p. ej. «120,50 m²»). NO numérico: ver `DatosPredio.areaTexto`. */
  areaIntervenidaTexto: string | null;
  /** Número de pisos que autoriza la licencia. */
  numeroPisos: number | null;
  /** Uso o destino de la edificación (vivienda, comercio, mixto…), texto del proyecto. */
  usoDestino: string | null;
  /** Valor de la obra declarado, verbatim — base de la liquidación de expensas. */
  valorObraTexto: string | null;
  /** Sistema estructural (mampostería confinada, pórticos…), texto del proyecto. */
  sistemaEstructural: string | null;
}

/** Fechas del trámite. Todas ISO; ausentes mientras el hecho no haya ocurrido. */
export interface FechasActoConstruccion {
  expedicion: string | null;
  notificacionPersonal: string | null;
  /**
   * FIRMEZA del acto (CPACA art. 87). En construcción la vigencia corre desde
   * aquí —no desde la expedición—, y eso NO es una decisión pendiente: lo fija
   * el D.1077/2015 art. 2.2.6.1.2.4.1 (ver `reglas-acto-construccion.ts`).
   */
  firmeza: string | null;
}

/** Quién firma y quién notifica. */
export interface FirmantesActoConstruccion {
  secretario: { nombre: string; cargo: string };
  notificador: { nombre: string; cargo: string };
}

export interface DatosActoConstruccion {
  /**
   * Las modalidades de la licencia (obra nueva, ampliación, demolición…). Es
   * una LISTA: el art. 2.2.6.1.1.7 par. 1 permite combinar varias en una misma
   * licencia. Los códigos son los de `MODALIDADES_CONSTRUCCION`
   * (`../catalogo-subtipos-normativo.ts`), validados por
   * `../modalidad-construccion.ts`. La ausencia («nunca se capturó») NO es
   * «obra nueva».
   */
  modalidades: string[];
  nombrePredio: string | null;
  direccion: string | null;
  barrioVereda: string | null;
  matriculaInmobiliaria: string | null;
  cedulaCatastral: string | null;
  areaPredioTexto: string | null;
  titulares: TitularConstruccion[];
  profesional: ProfesionalConstruccion | null;
  escritura: EscrituraConstruccion | null;
  obra: DatosTecnicosObra;
  /** Referencia del recibo de expensas de la Tesorería. */
  referenciaPagoExpensas: string | null;
  fechas: FechasActoConstruccion;
  firmantes: FirmantesActoConstruccion | null;
}

/**
 * Los campos SIN LOS CUALES el acto no se puede expedir, con el nombre que la
 * funcionaria entiende y el porqué. No es «todo lo que sería bonito tener»: es
 * lo que, si falta, deja el documento con un hueco en su parte resolutiva.
 *
 * OJO: esta lista NO puede estar completa mientras Planeación no entregue el
 * formato — puede que el acto real exija datos que aún no imaginamos. Por eso
 * es la lista MÍNIMA conocida, y así lo dice `generar-acto-construccion.ts`
 * cuando la usa.
 */
export const CAMPOS_OBLIGATORIOS_CONSTRUCCION: readonly {
  campo: string;
  comoSeLlama: string;
  porQue: string;
}[] = [
  { campo: 'modalidades', comoSeLlama: 'Modalidad(es) de la licencia', porQue: 'De la modalidad dependen los requisitos, la vigencia y buena parte de la parte resolutiva; sin ella el acto no sabe qué autoriza.' },
  { campo: 'nombrePredio', comoSeLlama: 'Identificación del predio', porQue: 'El acto identifica el inmueble sobre el que recae la licencia.' },
  { campo: 'matriculaInmobiliaria', comoSeLlama: 'Matrícula inmobiliaria', porQue: 'Es la identificación registral; sin ella el acto no recae sobre nada verificable.' },
  { campo: 'titulares', comoSeLlama: 'Titulares de la licencia', porQue: 'La licencia se concede a nombre de personas determinadas, y se les notifica una por una.' },
  { campo: 'profesional', comoSeLlama: 'Profesional responsable', porQue: 'El acto lo declara responsable del proyecto y de las contravenciones urbanísticas (art. 2.2.6.1.2.3.6).' },
  { campo: 'obra.areaIntervenidaTexto', comoSeLlama: 'Área a construir / intervenir', porQue: 'La parte resolutiva autoriza un área determinada; sin ella no consta qué se aprueba.' },
  { campo: 'obra.numeroPisos', comoSeLlama: 'Número de pisos', porQue: 'La licencia aprueba una altura; el acto la enuncia.' },
  { campo: 'obra.usoDestino', comoSeLlama: 'Uso o destino de la edificación', porQue: 'El acto destina la edificación a un uso; de él dependen normas urbanísticas aplicables.' },
  { campo: 'referenciaPagoExpensas', comoSeLlama: 'Referencia de pago de expensas', porQue: 'El acto deja constancia del pago; sin ella no consta que se liquidó.' },
  { campo: 'firmantes', comoSeLlama: 'Firmantes', porQue: 'Un acto administrativo sin firmante identificado no es un acto administrativo.' },
];

/** Un juego de datos vacío — el punto de partida honesto, sin campos inventados. */
export function datosVaciosConstruccion(): DatosActoConstruccion {
  return {
    modalidades: [],
    nombrePredio: null, direccion: null, barrioVereda: null,
    matriculaInmobiliaria: null, cedulaCatastral: null, areaPredioTexto: null,
    titulares: [], profesional: null, escritura: null,
    obra: { areaIntervenidaTexto: null, numeroPisos: null, usoDestino: null, valorObraTexto: null, sistemaEstructural: null },
    referenciaPagoExpensas: null,
    fechas: { expedicion: null, notificacionPersonal: null, firmeza: null },
    firmantes: null,
  };
}
