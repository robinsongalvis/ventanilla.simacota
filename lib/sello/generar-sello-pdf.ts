import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  calcularRectanguloSelloEnEsquina,
  encajarEnCaja,
  type EsquinaSello,
  selloCabeEnPagina,
  selloEsLegible,
} from './posicion-sello';

/**
 * Versión del DIBUJO del sello. Las rutas que materializan copias derivadas la
 * incluyen en su clave: subirla invalida todo render viejo de golpe. Historia:
 * v4 = esquina elegible + logo compartido; v5 = escudo cuadrado sin deformar y
 * líneas medidas que no se pisan (la muestra del 1-sep las mostró chocando);
 * v6 = folio «Página N de M» en el sellado multipágina (decisión del
 * propietario, 1-sep) — ventanilla primera-página queda igual; v7 = la línea
 * «Exp.» del ADR-0041, cuando el expediente lleva número propio.
 */
export const VERSION_RENDER_SELLO = '7';

/**
 * Sprint Ventanilla Operativa 3 — sellado digital de PDF.
 *
 * Recibe los bytes de un PDF original y devuelve los bytes de una
 * COPIA sellada. El original nunca se modifica. Se estampa solo en la
 * primera página, en la esquina superior izquierda.
 *
 * Contenido del sello (decisión de UX congelada):
 *   - Logo pequeño de la Alcaldía (opcional; si no llega, se omite).
 *   - "Recibido por Ventanilla Única"
 *   - Número de radicado (monospace, destacado).
 *   - Fecha y hora en formato humano (zona América/Bogotá).
 *   - "Alcaldía Municipal de Simacota"
 *   - «Página N de M» SOLO en el sellado multipágina (decisión del
 *     propietario, 1-sep-2026): en el papel de licencias se nota si a la
 *     copia le falta una hoja. El sello de primera página (ventanilla)
 *     conserva el contenido congelado original, sin folio.
 *
 * Estilo: fondo blanco semi-transparente (85% opacidad) con borde fino
 * verde institucional para dar contraste sin ser agresivo.
 */

export interface DatosSello {
  /** El número de ENTRADA — el que el rótulo del sello promete. */
  radicadoId:       string;
  /**
   * El `68745-…` del expediente (ADR-0041). Opcional: la PR #315 descartó esta
   * línea con razón —entonces los dos números eran el mismo objeto y habría
   * impreso el mismo dato dos veces—; vuelve ahora que tiene contenido propio.
   */
  numeroExpediente?: string | null;
  fechaHoraLegible: string;
  /** PNG del logo. Opcional — si no llega, se omite y se ajusta el layout. */
  logoPng?:         Uint8Array | null;
  /** Esquina de la marca (selector del paquete, 1-sep-2026). Default SUP_IZQ — la decisión original. */
  esquina?:         EsquinaSello;
}

export interface ResultadoSellado {
  bytes: Uint8Array;
  paginasEstampadas: number;
}

/** Resultado del sellado multipágina. */
export interface ResultadoSelladoTotal extends ResultadoSellado {
  /** Números de página (base 1) que NO admitieron el sello. Vacío = todas. */
  paginasSinSello: number[];
  totalPaginas: number;
}

export class SelloPDFError extends Error {
  constructor(message: string, public readonly codigo: 'CIFRADO' | 'CORRUPTO' | 'SIN_PAGINAS' | 'CABE') {
    super(message);
    this.name = 'SelloPDFError';
  }
}

/** Colores institucionales del sello (RGB 0..1 como espera pdf-lib). */
const COLOR_VERDE_INST   = rgb(0.078, 0.325, 0.176); // #14532D
const COLOR_TEXTO_OSCURO = rgb(0.122, 0.161, 0.200); // #1F2933
const COLOR_TEXTO_GRIS   = rgb(0.400, 0.439, 0.522); // #667085
const COLOR_FONDO        = rgb(1, 1, 1);              // blanco

interface FuentesSello {
  bold: Awaited<ReturnType<PDFDocument['embedFont']>>;
  regular: Awaited<ReturnType<PDFDocument['embedFont']>>;
  mono: Awaited<ReturnType<PDFDocument['embedFont']>>;
}

/** Folio del sello: «Página n de de» — solo existe en el sellado multipágina. */
export interface FolioSello {
  n: number;
  de: number;
}

export interface FilaSello {
  texto: string;
  /** Distancia de la BASE de la fila al borde superior interno del sello (pt). */
  dy: number;
  tamano: number;
  fuente: keyof FuentesSello;
  color: 'verde' | 'oscuro' | 'gris';
}

/**
 * LA FUENTE ÚNICA de las filas del sello — la misma de la que se dibuja
 * (patrón de `lineasConstanciaPaquete`: pdf-lib no lee texto, así que el
 * custodio asevera sobre esta función y el dibujo la consume tal cual).
 *
 * El folio «Página N de M» lo pidió el propietario (1-sep-2026) para el
 * papel de licencias: si a la copia impresa le falta una hoja, se nota.
 * Solo aparece cuando el llamador sella MULTIPÁGINA — el sello de ventanilla
 * (primera página, contenido congelado del sprint Op 3) queda EXACTO.
 */
export function filasSello(datos: DatosSello, folio?: FolioSello): FilaSello[] {
  const conExpediente = Boolean(datos.numeroExpediente);
  return [
    /* EL CALENDARIO VERTICAL, medido para el caso MÁXIMO (cinco filas: con
       expediente y con folio). Cada `dy` deja por debajo al menos el tamaño de
       la fila que baja, y la última cabe sobre el pie sin rozarlo — la cuenta
       está en `SELLO_MIN_ALTO_PT`. Cuando faltan filas, las de abajo suben:
       el sello de ventanilla (tres filas) conserva EXACTAMENTE su forma. */
    { texto: 'RECIBIDO POR VENTANILLA ÚNICA', dy: 8, tamano: 6.5, fuente: 'bold', color: 'verde' },
    { texto: datos.radicadoId, dy: conExpediente ? 19 : 20, tamano: 8.5, fuente: 'mono', color: 'oscuro' },
    ...(conExpediente
      ? [{ texto: `Exp. ${datos.numeroExpediente}`, dy: 29, tamano: 6.5, fuente: 'mono' as const, color: 'oscuro' as const }]
      : []),
    { texto: datos.fechaHoraLegible, dy: conExpediente ? 38 : 32, tamano: 6.5, fuente: 'regular', color: 'gris' },
    ...(folio
      ? [{ texto: `Página ${folio.n} de ${folio.de}`, dy: conExpediente ? 46 : 41, tamano: 6, fuente: 'regular' as const, color: 'gris' as const }]
      : []),
  ];
}

/**
 * El tamaño con el que `texto` cabe en UNA línea de `anchoMax` puntos.
 * Devuelve el tamaño base si ya cabe; si no, lo reduce en proporción exacta.
 * Nunca amplía. Exportada para que su custodio la vea fallar.
 */
export function tamanoQueCabe(
  font: FuentesSello[keyof FuentesSello],
  texto: string,
  tamanoBase: number,
  anchoMax: number,
): number {
  const medida = font.widthOfTextAtSize(texto, tamanoBase);
  return medida <= anchoMax ? tamanoBase : tamanoBase * (anchoMax / medida);
}

/**
 * Estampa el sello en UNA página. Devuelve `false` —sin lanzar— cuando la
 * página es demasiado pequeña para admitirlo.
 *
 * Que devuelva un booleano en vez de lanzar es la diferencia entre sellar un
 * documento de 40 páginas y perderlo entero porque la 37 era un recorte: el
 * llamador decide qué hacer con la página que no cupo, y en el modo multipágina
 * la respuesta es «sellar las demás y decir cuál faltó».
 */
function estamparEnPagina(
  pagina: ReturnType<PDFDocument['getPages']>[number],
  datos: DatosSello,
  fuentes: FuentesSello,
  logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null,
  folio?: FolioSello,
): boolean {
  const { width: ancho, height: alto } = pagina.getSize();
  const rect = calcularRectanguloSelloEnEsquina({ ancho, alto }, datos.esquina ?? 'SUP_IZQ');
  /* Dos comprobaciones, y la segunda es la que de verdad ocurre: el sello se
     ENCOGE para caber, así que «no cabe» casi nunca pasa — lo que pasa es que
     cabe ilegible. Estampar un sello que nadie puede leer y contarlo como
     estampado sería el silencio que este proyecto persigue. */
  if (!selloCabeEnPagina(rect, { ancho, alto })) return false;
  if (!selloEsLegible(rect)) return false;

  const padding = 6;
  const ladoEscudo = 24;
  const gapLogoTexto = 5;

  pagina.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.ancho,
    height: rect.alto,
    color: COLOR_FONDO,
    opacity: 0.85,
    borderColor: COLOR_VERDE_INST,
    borderWidth: 0.6,
  });

  let cursorX = rect.x + padding;
  const cursorTopY = rect.y + rect.alto - padding;

  if (logoImage) {
    // Sin deformar: el cuadro es fijo, la imagen se encaja y se centra en él.
    const encajado = encajarEnCaja(
      { ancho: logoImage.width, alto: logoImage.height },
      { ancho: ladoEscudo, alto: ladoEscudo },
      { ampliar: true },
    );
    pagina.drawImage(logoImage, {
      x: cursorX + (ladoEscudo - encajado.ancho) / 2,
      y: cursorTopY - ladoEscudo + (ladoEscudo - encajado.alto) / 2,
      width: encajado.ancho,
      height: encajado.alto,
    });
    cursorX += ladoEscudo + gapLogoTexto;
  }

  /* Cada línea se MIDE y se encoge hasta caber en una sola: `maxWidth` de
     pdf-lib parte en dos la línea que no cabe y la segunda mitad aterriza
     sobre la fila de abajo (la muestra del 1-sep salió con «ÚNICA» pisando
     la fecha). Encoger décimas de punto es invisible; dos líneas montadas
     son ilegibles. */
  const textoAncho = rect.x + rect.ancho - padding - cursorX;
  const COLORES = { verde: COLOR_VERDE_INST, oscuro: COLOR_TEXTO_OSCURO, gris: COLOR_TEXTO_GRIS } as const;

  for (const fila of filasSello(datos, folio)) {
    const font = fuentes[fila.fuente];
    pagina.drawText(fila.texto, {
      x: cursorX,
      y: cursorTopY - fila.dy,
      size: tamanoQueCabe(font, fila.texto, fila.tamano, textoAncho),
      font,
      color: COLORES[fila.color],
    });
  }

  const pie = 'Alcaldía Municipal de Simacota';
  pagina.drawText(pie, {
    x: rect.x + padding,
    y: rect.y + padding,
    size: tamanoQueCabe(fuentes.regular, pie, 5.5, rect.ancho - padding * 2),
    font: fuentes.regular,
    color: COLOR_TEXTO_GRIS,
  });

  return true;
}

/** Carga el PDF y prepara fuentes y logo. Errores tipados, legibles por el endpoint. */
async function prepararDocumento(
  bytesOriginal: Uint8Array,
  datos: DatosSello,
): Promise<{ doc: PDFDocument; fuentes: FuentesSello; logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null }> {
  let doc: PDFDocument;
  try {
    // `ignoreEncryption: false` es el default. Si el PDF exige contraseña de
    // owner que prohíbe modificación, pdf-lib arroja: se mapea a CIFRADO.
    doc = await PDFDocument.load(bytesOriginal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/encrypt/i.test(msg)) {
      throw new SelloPDFError('El PDF está protegido/cifrado y no puede sellarse.', 'CIFRADO');
    }
    throw new SelloPDFError('El PDF está corrupto o no puede leerse.', 'CORRUPTO');
  }

  if (doc.getPages().length === 0) {
    throw new SelloPDFError('El PDF no tiene páginas.', 'SIN_PAGINAS');
  }

  const fuentes: FuentesSello = {
    // Helvetica y Courier están embebidas en todos los readers: no requieren
    // subset y mantienen pequeña la copia.
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    regular: await doc.embedFont(StandardFonts.Helvetica),
    mono: await doc.embedFont(StandardFonts.Courier),
  };

  let logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null = null;
  if (datos.logoPng && datos.logoPng.byteLength > 0) {
    try {
      logoImage = await doc.embedPng(datos.logoPng);
    } catch {
      // Si el PNG está corrupto seguimos sin logo — el sello debe salir igual.
      logoImage = null;
    }
  }

  return { doc, fuentes, logoImage };
}

/**
 * Sella SOLO la primera página. Contrato original del sprint Ventanilla
 * Operativa 3 — lo consume `POST /api/radicados/[radicadoId]/sellar-documento`
 * y su comportamiento NO cambia: si la primera página no admite el sello, falla.
 */
export async function sellarPrimeraPagina(
  bytesOriginal: Uint8Array,
  datos: DatosSello,
): Promise<ResultadoSellado> {
  const { doc, fuentes, logoImage } = await prepararDocumento(bytesOriginal, datos);
  const primeraPagina = doc.getPages()[0];

  if (!estamparEnPagina(primeraPagina, datos, fuentes, logoImage)) {
    throw new SelloPDFError('La página es demasiado pequeña para estampar un sello legible.', 'CABE');
  }

  return { bytes: await doc.save({ useObjectStreams: false }), paginasEstampadas: 1 };
}

/**
 * Sella TODAS las páginas que lo admitan.
 *
 * ── LA PÁGINA QUE NO CUPO ─────────────────────────────────────────────────
 *
 * No aborta el documento entero: perder cuarenta sellos porque la página 37 era
 * un recorte pequeño es un castigo desproporcionado. Pero tampoco pasa en
 * silencio — devuelve `paginasSinSello` para que quien entrega el papel pueda
 * decir cuáles quedaron sin estampar.
 *
 * POR QUÉ LA CONSTANCIA VA EN PANTALLA Y NO EN EL PAPEL: la página sin sello es,
 * por definición, la que no tiene sitio para uno. Escribirle encima la nota de
 * que no cabe sería el mismo problema con otro texto.
 *
 * SI NO SE PUDO SELLAR NINGUNA, falla. Entregar una «copia sellada» sin un solo
 * sello sería afirmar con el nombre del archivo algo que el documento no dice.
 */
export async function sellarTodasLasPaginas(
  bytesOriginal: Uint8Array,
  datos: DatosSello,
): Promise<ResultadoSelladoTotal> {
  const { doc, fuentes, logoImage } = await prepararDocumento(bytesOriginal, datos);
  const paginas = doc.getPages();

  const paginasSinSello: number[] = [];
  let estampadas = 0;

  for (let i = 0; i < paginas.length; i += 1) {
    // El folio va por página: «Página 3 de 28». Base 1 — lo lee una persona.
    if (estamparEnPagina(paginas[i], datos, fuentes, logoImage, { n: i + 1, de: paginas.length })) estampadas += 1;
    else paginasSinSello.push(i + 1);
  }

  if (estampadas === 0) {
    throw new SelloPDFError(
      'Ninguna página admite un sello legible: todas son más pequeñas que el espacio que necesita.',
      'CABE',
    );
  }

  return {
    bytes: await doc.save({ useObjectStreams: false }),
    paginasEstampadas: estampadas,
    paginasSinSello,
    totalPaginas: paginas.length,
  };
}
