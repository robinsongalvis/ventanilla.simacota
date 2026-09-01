import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sellarTodasLasPaginas, SelloPDFError } from '@/lib/sello/generar-sello-pdf';
import type { EsquinaSello } from '@/lib/sello/posicion-sello';

/* ══════════════════════════════════════════════════════════════
   EL PAQUETE SELLADO — un solo PDF con la constancia de primera hoja y
   todos los documentos del expediente, cada página con su sello.

   Nace del ensayo del 1-sep-2026: la fila «Descargar documentos con sello»
   enlazaba a `/sellados`, una API que nunca existió. El propietario definió
   qué debía existir ahí: «un pdf listo ya con todos los documentos del
   usuario», con la constancia de radicación reutilizada como primera página.

   PURO SOBRE BYTES: esta función no toca Firestore ni Storage — recibe los
   bytes y los datos, devuelve bytes y dos listas. El IO vive en la ruta.
   Mismo reparto que `expedientes-licencias.ts` (decisión pura / ruta que
   orquesta), y lo que permite custodiarla con PDFs sintéticos.

   QUÉ EMPAQUETA Y QUÉ NO — dicho, no callado (ADR-0033 §4.6-bis):
     · PDF   → sellado en todas sus páginas (el mecanismo ya custodiado de
               `sellarTodasLasPaginas`) y añadido al paquete.
     · PNG/JPG → volcado a una página tamaño carta y sellado igual. El sello
               por documento declara 415 para imágenes; aquí SÍ se incluyen
               porque el paquete construye la página que a la imagen le falta.
               La asimetría es deliberada y queda escrita en ambos sitios.
     · Lo demás (ofimática, WEBP, sin archivo, sellado fallido) → NO se
               finge: va LISTADO EN LA CONSTANCIA bajo «No incluidos», con su
               motivo, y se descarga individualmente.

   SI NADA SE PUDO EMPAQUETAR, FALLA. Un paquete que es pura carátula
   afirmaría con el nombre del archivo algo que no contiene.
══════════════════════════════════════════════════════════════ */

const CARTA = { ancho: 612, alto: 792 } as const;
const MARGEN = 54;

export interface DatosConstanciaPaquete {
  numeroRadicado: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  descripcionTramite: string;
  /** ISO — fecha jurídica de la radicación (la de la actuación, inmutable). */
  desdeCuandoCorreElPlazo: string;
  requisitosVerificados: number;
  funcionarioNombre: string;
  /** Legible, ya formateada en zona Colombia por quien llama. */
  expedidaEnLegible: string;
}

export interface DocumentoParaPaquete {
  documentoId: string;
  nombre: string;
  mimeType: string | null;
  /** null = el binario no se pudo leer (se lista aparte con ese motivo). */
  bytes: Uint8Array | null;
}

export type MotivoAparte = 'FORMATO_NO_EMPAQUETABLE' | 'SIN_ARCHIVO' | 'NO_SE_PUDO_SELLAR';

export interface ResultadoPaqueteSellado {
  bytes: Uint8Array;
  totalPaginas: number;
  incluidos: { documentoId: string; nombre: string; paginas: number }[];
  aparte: { documentoId: string; nombre: string; motivo: MotivoAparte }[];
}

export class PaqueteSelladoError extends Error {
  constructor(
    public readonly codigo: 'SIN_DOCUMENTOS_EMPAQUETABLES',
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'PaqueteSelladoError';
  }
}

const MIMES_IMAGEN = new Set(['image/png', 'image/jpeg']);

/**
 * El CONTENIDO de la primera hoja, estructurado y PURO — la página se dibuja a
 * partir de esto y el custodio asevera a partir de esto: una sola fuente.
 * La forma imita al comprobante de radicación de ventanilla (pedido del
 * propietario, 1-sep-2026): membrete, caja del número, campos, secciones.
 */
export function contenidoConstanciaPaquete(
  datos: DatosConstanciaPaquete,
  incluidos: ResultadoPaqueteSellado['incluidos'],
  aparte: ResultadoPaqueteSellado['aparte'],
): {
  entidad: string;
  subtitulo: string;
  titulo: string;
  numeroEtiqueta: string;
  numero: string;
  campos: [string, string][];
  solicitante: [string, string][];
  incluidosTitulo: string;
  incluidosLineas: string[];
  aparteTitulo: string | null;
  aparteLineas: string[];
  notaFinal: string;
} {
  const motivoDe = (m: MotivoAparte) =>
    m === 'FORMATO_NO_EMPAQUETABLE' ? 'formato sin sello equivalente'
    : m === 'SIN_ARCHIVO' ? 'sin archivo legible'
    : 'no fue posible sellarlo';
  return {
    entidad: 'ALCALDÍA MUNICIPAL DE SIMACOTA',
    subtitulo: 'Ventanilla Única Digital · Secretaría de Planeación',
    titulo: 'CONSTANCIA DE RADICACIÓN — PAQUETE DE COPIAS SELLADAS',
    numeroEtiqueta: 'N.° DE RADICADO',
    numero: datos.numeroRadicado,
    campos: [
      ['Trámite:', datos.descripcionTramite],
      ['Radicado en debida forma:', datos.desdeCuandoCorreElPlazo.slice(0, 10)],
      ['Requisitos verificados:', String(datos.requisitosVerificados)],
      ['Funcionario:', datos.funcionarioNombre],
      ['Copia sellada expedida:', datos.expedidaEnLegible],
    ],
    solicitante: [
      ['Nombre:', datos.solicitanteNombre],
      ['Documento:', datos.solicitanteDocumento],
    ],
    incluidosTitulo: `DOCUMENTOS INCLUIDOS (${incluidos.length}) — CADA PÁGINA CON SU SELLO`,
    incluidosLineas: incluidos.map((d, i) => `${i + 1}. ${d.nombre} — ${d.paginas} pág.`),
    aparteTitulo: aparte.length > 0 ? 'NO INCLUIDOS — SE DESCARGAN INDIVIDUALMENTE' : null,
    aparteLineas: aparte.map((d) => `· ${d.nombre} (${motivoDe(d.motivo)})`),
    notaFinal: 'Copia derivada del expediente digital. El original es el expediente; esta copia se regenera al pedirla.',
  };
}

/** Compatibilidad para el custodio: las líneas planas SON el contenido estructurado, aplanado. */
export function lineasConstanciaPaquete(
  datos: DatosConstanciaPaquete,
  incluidos: ResultadoPaqueteSellado['incluidos'],
  aparte: ResultadoPaqueteSellado['aparte'],
): { titulo: string; lineas: string[] } {
  const c = contenidoConstanciaPaquete(datos, incluidos, aparte);
  return {
    titulo: c.titulo,
    lineas: [
      c.entidad,
      c.subtitulo,
      `${c.numeroEtiqueta} ${c.numero}`,
      ...c.campos.map(([e, v]) => `${e} ${v}`),
      ...c.solicitante.map(([e, v]) => `${e} ${v}`),
      c.incluidosTitulo,
      ...c.incluidosLineas,
      ...(c.aparteTitulo ? [c.aparteTitulo, ...c.aparteLineas] : []),
      c.notaFinal,
    ],
  };
}

/** Una imagen se vuelve UNA página carta, centrada y contenida, lista para el sello. */
async function paginaDesdeImagen(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const img = mimeType === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const pagina = doc.addPage([CARTA.ancho, CARTA.alto]);
  const maxAncho = CARTA.ancho - MARGEN * 2;
  const maxAlto = CARTA.alto - MARGEN * 2;
  const escala = Math.min(maxAncho / img.width, maxAlto / img.height, 1);
  const w = img.width * escala;
  const h = img.height * escala;
  pagina.drawImage(img, { x: (CARTA.ancho - w) / 2, y: (CARTA.alto - h) / 2, width: w, height: h });
  return doc.save();
}

export async function construirPaqueteSellado(entrada: {
  constancia: DatosConstanciaPaquete;
  documentos: DocumentoParaPaquete[];
  /** `logoPng` es el ESCUDO cuadrado del sello estampado. */
  sello: { radicadoId: string; fechaHoraLegible: string; logoPng?: Uint8Array | null; esquina?: EsquinaSello };
  /** El lockup horizontal para el membrete de la carátula. Si no llega, se usa el del sello. */
  logoPortadaPng?: Uint8Array | null;
}): Promise<ResultadoPaqueteSellado> {
  const incluidos: ResultadoPaqueteSellado['incluidos'] = [];
  const aparte: ResultadoPaqueteSellado['aparte'] = [];
  const cuerposSellados: Uint8Array[] = [];

  for (const d of entrada.documentos) {
    if (!d.bytes) {
      aparte.push({ documentoId: d.documentoId, nombre: d.nombre, motivo: 'SIN_ARCHIVO' });
      continue;
    }
    const esPdf = d.mimeType === 'application/pdf';
    const esImagen = d.mimeType !== null && MIMES_IMAGEN.has(d.mimeType);
    if (!esPdf && !esImagen) {
      aparte.push({ documentoId: d.documentoId, nombre: d.nombre, motivo: 'FORMATO_NO_EMPAQUETABLE' });
      continue;
    }
    try {
      const base = esPdf ? d.bytes : await paginaDesdeImagen(d.bytes, d.mimeType as string);
      const sellado = await sellarTodasLasPaginas(base, entrada.sello);
      cuerposSellados.push(sellado.bytes);
      incluidos.push({ documentoId: d.documentoId, nombre: d.nombre, paginas: sellado.totalPaginas });
    } catch (error) {
      /* Un documento ilegible o insellable NO tumba el paquete de los demás:
         queda declarado en la carátula. `SelloPDFError` incluido — su contrato
         («sin un solo sello, falla») se respeta POR documento. */
      if (!(error instanceof SelloPDFError) && !(error instanceof Error)) throw error;
      aparte.push({ documentoId: d.documentoId, nombre: d.nombre, motivo: 'NO_SE_PUDO_SELLAR' });
    }
  }

  if (incluidos.length === 0) {
    throw new PaqueteSelladoError(
      'SIN_DOCUMENTOS_EMPAQUETABLES',
      'Ninguno de los documentos del expediente se pudo empaquetar con sello. '
      + 'Un paquete que fuera pura carátula afirmaría con el nombre algo que no contiene.',
    );
  }

  // ── la primera hoja: el lenguaje visual del comprobante de ventanilla ────
  const paquete = await PDFDocument.create();
  const helv = await paquete.embedFont(StandardFonts.Helvetica);
  const helvB = await paquete.embedFont(StandardFonts.HelveticaBold);
  const mono = await paquete.embedFont(StandardFonts.Courier);
  const monoB = await paquete.embedFont(StandardFonts.CourierBold);

  const VERDE = rgb(0.078, 0.325, 0.176);   // #14532D
  const VERDE_TINTE = rgb(0.925, 0.957, 0.925);
  const GRIS = rgb(0.4, 0.44, 0.41);
  const TINTA = rgb(0.13, 0.17, 0.14);

  const c = contenidoConstanciaPaquete(entrada.constancia, incluidos, aparte);
  let portada = paquete.addPage([CARTA.ancho, CARTA.alto]);
  let y = CARTA.alto - MARGEN;

  const centrado = (texto: string, size: number, font = helv, color = TINTA) => {
    const ancho = font.widthOfTextAtSize(texto, size);
    portada.drawText(texto, { x: (CARTA.ancho - ancho) / 2, y, size, font, color });
    y -= size + 6;
  };
  const punteada = () => {
    for (let x = MARGEN; x < CARTA.ancho - MARGEN; x += 9) {
      portada.drawLine({ start: { x, y }, end: { x: x + 4, y }, thickness: 0.7, color: GRIS });
    }
    y -= 16;
  };
  /* Salto de página para las listas largas: truncar en silencio afirmaría un
     contenido menor que el real. */
  const asegurarEspacio = (necesario: number) => {
    if (y - necesario < MARGEN) {
      portada = paquete.addPage([CARTA.ancho, CARTA.alto]);
      y = CARTA.alto - MARGEN;
    }
  };

  // Membrete
  const logoMembrete = entrada.logoPortadaPng ?? entrada.sello.logoPng;
  if (logoMembrete && logoMembrete.byteLength > 0) {
    try {
      const escudo = await paquete.embedPng(logoMembrete);
      const altoEscudo = 56;
      const anchoEscudo = (escudo.width / escudo.height) * altoEscudo;
      portada.drawImage(escudo, { x: (CARTA.ancho - anchoEscudo) / 2, y: y - altoEscudo, width: anchoEscudo, height: altoEscudo });
      y -= altoEscudo + 14;
    } catch { /* PNG corrupto: membrete sin escudo, como el sello lo tolera */ }
  }
  centrado(c.entidad, 13, helvB, VERDE);
  centrado(c.subtitulo, 9, helv, GRIS);
  y -= 8;
  centrado(c.titulo, 11, monoB, TINTA);
  y -= 4;
  punteada();

  // La caja del número, como en el comprobante
  const altoCaja = 52;
  portada.drawRectangle({ x: MARGEN, y: y - altoCaja, width: CARTA.ancho - MARGEN * 2, height: altoCaja, color: VERDE_TINTE, borderColor: VERDE, borderWidth: 1 });
  const et = c.numeroEtiqueta;
  const etAncho = helv.widthOfTextAtSize(et, 8);
  portada.drawText(et, { x: (CARTA.ancho - etAncho) / 2, y: y - 16, size: 8, font: helv, color: GRIS });
  const numAncho = monoB.widthOfTextAtSize(c.numero, 17);
  portada.drawText(c.numero, { x: (CARTA.ancho - numAncho) / 2, y: y - 38, size: 17, font: monoB, color: VERDE });
  y -= altoCaja + 18;

  // Campos etiqueta/valor (etiqueta gris, valor en mono — el estilo del comprobante)
  const fila = (etiqueta: string, valor: string) => {
    asegurarEspacio(16);
    portada.drawText(etiqueta, { x: MARGEN, y, size: 9, font: helv, color: GRIS });
    portada.drawText(valor.slice(0, 62), { x: MARGEN + 170, y, size: 10, font: mono, color: TINTA });
    y -= 16;
  };
  for (const [e, v] of c.campos) fila(e, v);
  y -= 4; punteada();

  portada.drawText('DATOS DEL SOLICITANTE', { x: MARGEN, y, size: 9, font: helvB, color: GRIS });
  y -= 16;
  for (const [e, v] of c.solicitante) fila(e, v);
  y -= 4; punteada();

  const seccionLista = (titulo: string, lineas: string[]) => {
    asegurarEspacio(30);
    portada.drawText(titulo, { x: MARGEN, y, size: 9, font: helvB, color: VERDE });
    y -= 15;
    for (const linea of lineas) {
      asegurarEspacio(13);
      portada.drawText(linea.slice(0, 92), { x: MARGEN + 8, y, size: 9, font: mono, color: TINTA });
      y -= 13;
    }
    y -= 8;
  };
  seccionLista(c.incluidosTitulo, c.incluidosLineas);
  if (c.aparteTitulo) seccionLista(c.aparteTitulo, c.aparteLineas);

  asegurarEspacio(24);
  punteada();
  portada.drawText(c.notaFinal.slice(0, 110), { x: MARGEN, y, size: 8, font: helv, color: GRIS });

  for (const bytes of cuerposSellados) {
    const cuerpo = await PDFDocument.load(bytes);
    const paginas = await paquete.copyPages(cuerpo, cuerpo.getPageIndices());
    for (const p of paginas) paquete.addPage(p);
  }

  return {
    bytes: await paquete.save(),
    totalPaginas: paquete.getPageCount(),
    incluidos,
    aparte,
  };
}
