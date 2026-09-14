/**
 * lib/motor-expedientes/acto-lsr/datos-acto-lsr.ts
 *
 * LO QUE EL ACTO NECESITA SABER — el contrato de datos dinámicos del
 * F-PGJ-002 (licencia de subdivisión rural), leído del documento real que
 * entregó el ingeniero.
 *
 * ── PARA QUÉ SIRVE ESTE TIPO ──────────────────────────────────────────────
 *
 * Para dos cosas, y la segunda importa tanto como la primera:
 *
 *  1. Decirle al generador qué recibe.
 *  2. Decirle al INTAKE qué tiene que capturar. Hoy el expediente guarda seis
 *     de estos datos; el resto no existe en ninguna parte del sistema. Esa
 *     distancia no se descubre al final, cuando alguien va a emitir: se ve
 *     aquí, en un tipo, y `desde-expediente.ts` la reporta campo por campo.
 *
 * ── LO QUE NO ENTRA, Y POR QUÉ ────────────────────────────────────────────
 *
 * El NÚMERO de la resolución no está aquí: vive en `ParametrosDelActo`, porque
 * no es un dato del expediente sino una decisión pendiente de Planeación.
 * Mezclarlo con lo demás lo haría parecer un campo más que alguien puede
 * rellenar, y es justo lo contrario.
 */

/** Un titular de la licencia. Son VARIOS: el acto real tiene tres. */
export interface TitularActo {
  nombre: string;
  /** C.C. o NIT, tal como se imprime. */
  documento: string;
}

/**
 * El profesional que firma los planos. El formato admite tres clases
 * —topógrafo, arquitecto, ingeniero— y el acto lo nombra por la suya: llamar
 * «topógrafo» a un arquitecto en un acto administrativo no es un detalle.
 */
export interface ProfesionalResponsable {
  nombre: string;
  clase: 'TOPOGRAFO' | 'ARQUITECTO' | 'INGENIERO';
  /** Matrícula profesional, p. ej. «L.P. No. 01-3399». */
  matricula: string;
}

/**
 * Un lote resultante de la subdivisión.
 *
 * `destino` NO se genera: es la redacción del técnico sobre el proyecto
 * productivo, y de ella depende que la excepción del art. 45 literal C de la
 * Ley 160 esté motivada. Un destino inventado motivaría una excepción falsa.
 */
export interface LoteResultante {
  numero: number;
  /** A quién queda adjudicado. Puede no coincidir con el orden de los titulares. */
  propietario: string;
  /** Área tal como debe imprimirse, p. ej. «1 HA 5775.0 M2» — sin normalizar (ver `DatosPredio.areaTexto`). */
  areaTexto: string;
  /** El proyecto productivo que justifica la excepción a la UAF. Texto del técnico. */
  destino: string;
  /** Cómo se garantiza el acceso al lote. Texto del técnico. */
  accesibilidad: string;
}

/** La escritura pública que soporta la propiedad. El acto la cita en letras. */
export interface EscrituraPublica {
  /** El número en cifras, p. ej. «255». */
  numero: string;
  /** Fecha de la escritura, ISO. */
  fecha: string;
  notaria: string;
  circulo: string;
}

/** Quién firma y quién notifica. El acto real los distingue. */
export interface FirmantesActo {
  /** Quien expide: Secretario(a) de Planeación e Infraestructura. */
  secretario: { nombre: string; cargo: string };
  /** Quien elabora y notifica: en el acto real, el Subsecretario. */
  notificador: { nombre: string; cargo: string };
}

/** Fechas del trámite. Todas ISO; ausentes mientras el hecho no haya ocurrido. */
export interface FechasDelActo {
  expedicion: string | null;
  /** Publicación / edicto a vecinos y terceros. */
  publicacionEdicto: string | null;
  notificacionPersonal: string | null;
  firmeza: string | null;
}

export interface DatosActoLsr {
  /** Nombre del predio, p. ej. «CAMPO ALEGRE». */
  nombrePredio: string | null;
  vereda: string | null;
  direccion: string | null;
  matriculaInmobiliaria: string | null;
  cedulaCatastral: string | null;
  /** Área total, verbatim. */
  areaTotalTexto: string | null;
  estrato: string | null;
  titulares: TitularActo[];
  profesional: ProfesionalResponsable | null;
  escritura: EscrituraPublica | null;
  lotes: LoteResultante[];
  /** Referencia del recibo de expensas de la Tesorería, p. ej. «M1 25-00009». */
  referenciaPagoExpensas: string | null;
  fechas: FechasDelActo;
  firmantes: FirmantesActo | null;
}

/**
 * Los campos SIN LOS CUALES el acto no se puede expedir, con el nombre que la
 * funcionaria entiende.
 *
 * No es la lista de «todo lo que sería bonito tener»: es la de lo que, si
 * falta, deja el documento diciendo una falsedad o un hueco. Se declara aquí,
 * como dato, para que la validación no sea una escalera de `if` que alguien
 * amplía a medias.
 */
export const CAMPOS_OBLIGATORIOS_ACTO: readonly { campo: keyof DatosActoLsr | 'lotes' | 'titulares'; comoSeLlama: string; porQue: string }[] = [
  { campo: 'nombrePredio', comoSeLlama: 'Nombre del predio', porQue: 'El acto identifica el inmueble por su nombre en cinco párrafos.' },
  { campo: 'vereda', comoSeLlama: 'Vereda', porQue: 'Sin ella no se puede determinar la Unidad Agrícola Familiar aplicable.' },
  { campo: 'matriculaInmobiliaria', comoSeLlama: 'Matrícula inmobiliaria', porQue: 'Es la identificación registral del predio; sin ella el acto no recae sobre nada verificable.' },
  { campo: 'areaTotalTexto', comoSeLlama: 'Área total del predio', porQue: 'El cuadro de áreas debe cuadrar contra ella.' },
  { campo: 'titulares', comoSeLlama: 'Titulares de la licencia', porQue: 'La licencia se concede a nombre de personas determinadas, y se les notifica una por una.' },
  { campo: 'profesional', comoSeLlama: 'Profesional responsable', porQue: 'El acto lo declara responsable de las contravenciones urbanísticas.' },
  { campo: 'escritura', comoSeLlama: 'Escritura pública', porQue: 'El artículo primero la cita con su número, notaría y círculo.' },
  { campo: 'lotes', comoSeLlama: 'Lotes resultantes', porQue: 'Sin ellos no hay subdivisión que aprobar ni cuadro de áreas que imprimir.' },
  { campo: 'referenciaPagoExpensas', comoSeLlama: 'Referencia de pago de expensas', porQue: 'El artículo de tarifas la cita; sin ella no consta que se pagó.' },
  { campo: 'firmantes', comoSeLlama: 'Firmantes', porQue: 'Un acto administrativo sin firmante identificado no es un acto administrativo.' },
];

/** Un juego de datos vacío — el punto de partida honesto, sin campos inventados. */
export function datosVacios(): DatosActoLsr {
  return {
    nombrePredio: null, vereda: null, direccion: null, matriculaInmobiliaria: null,
    cedulaCatastral: null, areaTotalTexto: null, estrato: null,
    titulares: [], profesional: null, escritura: null, lotes: [],
    referenciaPagoExpensas: null,
    fechas: { expedicion: null, publicacionEdicto: null, notificacionPersonal: null, firmeza: null },
    firmantes: null,
  };
}
