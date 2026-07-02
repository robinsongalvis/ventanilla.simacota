import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  calcularRectanguloSello,
  selloCabeEnPagina,
  SELLO_MARGEN_PT,
} from './posicion-sello';

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
 *
 * Estilo: fondo blanco semi-transparente (85% opacidad) con borde fino
 * verde institucional para dar contraste sin ser agresivo.
 */

export interface DatosSello {
  radicadoId:       string;
  fechaHoraLegible: string;
  /** PNG del logo. Opcional — si no llega, se omite y se ajusta el layout. */
  logoPng?:         Uint8Array | null;
}

export interface ResultadoSellado {
  bytes: Uint8Array;
  paginasEstampadas: number;
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

export async function sellarPrimeraPagina(
  bytesOriginal: Uint8Array,
  datos:         DatosSello,
): Promise<ResultadoSellado> {
  let doc: PDFDocument;
  try {
    // `ignoreEncryption: false` es el default. Si el PDF exige contraseña
    // de owner que prohíbe modificación, pdf-lib arroja: mapeamos a
    // SelloPDFError con código CIFRADO para respuesta legible del endpoint.
    doc = await PDFDocument.load(bytesOriginal);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/encrypt/i.test(msg)) {
      throw new SelloPDFError(
        'El PDF está protegido/cifrado y no puede sellarse.',
        'CIFRADO',
      );
    }
    throw new SelloPDFError(
      'El PDF está corrupto o no puede leerse.',
      'CORRUPTO',
    );
  }

  const paginas = doc.getPages();
  if (paginas.length === 0) {
    throw new SelloPDFError('El PDF no tiene páginas.', 'SIN_PAGINAS');
  }

  const primeraPagina = paginas[0];
  const { width: ancho, height: alto } = primeraPagina.getSize();
  const rect = calcularRectanguloSello({ ancho, alto });

  if (!selloCabeEnPagina(rect, { ancho, alto })) {
    throw new SelloPDFError(
      'La página es demasiado pequeña para estampar el sello.',
      'CABE',
    );
  }

  // Fuentes estándar (Helvetica está embebida en todos los readers,
  // no requiere subset — mantiene el output pequeño).
  const fuenteBold    = await doc.embedFont(StandardFonts.HelveticaBold);
  const fuenteRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteMono    = await doc.embedFont(StandardFonts.Courier);

  // Logo opcional.
  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (datos.logoPng && datos.logoPng.byteLength > 0) {
    try {
      logoImage = await doc.embedPng(datos.logoPng);
    } catch {
      // Si el PNG está corrupto, seguimos sin logo — el sello debe salir igual.
      logoImage = null;
    }
  }

  // Layout interno (coordenadas relativas al rect del sello).
  const padding = 6;
  const anchoContenido = rect.ancho - padding * 2;
  const altoLogo       = 26;
  const anchoLogo      = 26;
  const gapLogoTexto   = 6;

  // Fondo semi-transparente + borde institucional.
  primeraPagina.drawRectangle({
    x:      rect.x,
    y:      rect.y,
    width:  rect.ancho,
    height: rect.alto,
    color:       COLOR_FONDO,
    opacity:     0.85,
    borderColor: COLOR_VERDE_INST,
    borderWidth: 0.6,
  });

  // Logo (opcional).
  let cursorX = rect.x + padding;
  const cursorTopY = rect.y + rect.alto - padding;

  if (logoImage) {
    primeraPagina.drawImage(logoImage, {
      x:      cursorX,
      y:      cursorTopY - altoLogo,
      width:  anchoLogo,
      height: altoLogo,
    });
    cursorX += anchoLogo + gapLogoTexto;
  }

  // Textos del sello — el bloque de texto arranca a la derecha del logo.
  const textoAncho = rect.ancho - (cursorX - rect.x) - padding;

  // Línea 1: "RECIBIDO POR VENTANILLA ÚNICA"
  primeraPagina.drawText('RECIBIDO POR VENTANILLA ÚNICA', {
    x:    cursorX,
    y:    cursorTopY - 8,
    size: 6.5,
    font: fuenteBold,
    color: COLOR_VERDE_INST,
    maxWidth: textoAncho,
  });

  // Línea 2: número de radicado en mono.
  primeraPagina.drawText(datos.radicadoId, {
    x:    cursorX,
    y:    cursorTopY - 20,
    size: 8.5,
    font: fuenteMono,
    color: COLOR_TEXTO_OSCURO,
    maxWidth: textoAncho,
  });

  // Línea 3: fecha/hora.
  primeraPagina.drawText(datos.fechaHoraLegible, {
    x:    cursorX,
    y:    cursorTopY - 32,
    size: 6.5,
    font: fuenteRegular,
    color: COLOR_TEXTO_GRIS,
    maxWidth: textoAncho,
  });

  // Línea 4 (pie del sello): "Alcaldía Municipal de Simacota"
  primeraPagina.drawText('Alcaldía Municipal de Simacota', {
    x:    rect.x + padding,
    y:    rect.y + padding,
    size: 5.5,
    font: fuenteRegular,
    color: COLOR_TEXTO_GRIS,
    maxWidth: anchoContenido,
  });

  // Discard silencioso del margen interior — evita warnings de layout.
  void SELLO_MARGEN_PT;

  const salidaBytes = await doc.save({ useObjectStreams: false });

  return {
    bytes: salidaBytes,
    paginasEstampadas: 1,
  };
}
