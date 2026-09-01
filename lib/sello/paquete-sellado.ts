import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sellarTodasLasPaginas, SelloPDFError } from '@/lib/sello/generar-sello-pdf';

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
 * Las líneas de la primera hoja, como función PURA — la página se dibuja a
 * partir de esto y el custodio las asevera a partir de esto: una sola fuente.
 * El texto refleja la constancia de radicación existente (misma fuente
 * jurídica: la actuación de radicación) más las dos listas propias del paquete.
 */
export function lineasConstanciaPaquete(
  datos: DatosConstanciaPaquete,
  incluidos: ResultadoPaqueteSellado['incluidos'],
  aparte: ResultadoPaqueteSellado['aparte'],
): { titulo: string; lineas: string[] } {
  const lineas = [
    'Alcaldía Municipal de Simacota · Secretaría de Planeación',
    '',
    `Radicado: ${datos.numeroRadicado}`,
    `Solicitante: ${datos.solicitanteNombre} — ${datos.solicitanteDocumento}`,
    `Trámite: ${datos.descripcionTramite}`,
    `Radicado en legal y debida forma el: ${datos.desdeCuandoCorreElPlazo.slice(0, 10)}`,
    `Requisitos verificados: ${datos.requisitosVerificados}`,
    `Funcionario: ${datos.funcionarioNombre}`,
    `Copia sellada expedida: ${datos.expedidaEnLegible}`,
    '',
    `Documentos incluidos en este paquete (${incluidos.length}), cada página con su sello:`,
    ...incluidos.map((d, i) => `  ${i + 1}. ${d.nombre} — ${d.paginas} pág.`),
  ];
  if (aparte.length > 0) {
    lineas.push('', 'No incluidos — se descargan individualmente:');
    for (const d of aparte) {
      const motivo =
        d.motivo === 'FORMATO_NO_EMPAQUETABLE' ? 'formato sin sello equivalente'
        : d.motivo === 'SIN_ARCHIVO' ? 'sin archivo legible'
        : 'no fue posible sellarlo';
      lineas.push(`  · ${d.nombre} (${motivo})`);
    }
  }
  lineas.push('', 'Copia derivada del expediente digital. El original es el expediente; esta copia se regenera al pedirla.');
  return { titulo: 'CONSTANCIA DE RADICACIÓN — PAQUETE DE COPIAS SELLADAS', lineas };
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
  sello: { radicadoId: string; fechaHoraLegible: string; logoPng?: Uint8Array | null };
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

  // ── la primera hoja, a partir de las MISMAS listas que se devuelven ──────
  const paquete = await PDFDocument.create();
  const fuente = await paquete.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await paquete.embedFont(StandardFonts.HelveticaBold);
  const portada = paquete.addPage([CARTA.ancho, CARTA.alto]);
  const { titulo, lineas } = lineasConstanciaPaquete(entrada.constancia, incluidos, aparte);

  /* El ESCUDO encabeza la carátula — el propietario cazó la hoja «en blanco,
     muy fea» del primer render: un papel institucional sin escudo no se ve
     institucional. Mismo PNG que estampan los sellos de página. */
  let y = CARTA.alto - MARGEN;
  if (entrada.sello.logoPng && entrada.sello.logoPng.byteLength > 0) {
    try {
      const escudo = await paquete.embedPng(entrada.sello.logoPng);
      const altoEscudo = 64;
      const anchoEscudo = (escudo.width / escudo.height) * altoEscudo;
      portada.drawImage(escudo, { x: (CARTA.ancho - anchoEscudo) / 2, y: y - altoEscudo, width: anchoEscudo, height: altoEscudo });
      y -= altoEscudo + 18;
    } catch { /* PNG corrupto: la carátula sale sin escudo, como el sello lo tolera */ }
  }
  portada.drawText(titulo, { x: MARGEN, y: y - 14, size: 12, font: fuenteNegrita, color: rgb(0.07, 0.15, 0.1) });
  portada.drawLine({ start: { x: MARGEN, y: y - 24 }, end: { x: CARTA.ancho - MARGEN, y: y - 24 }, thickness: 1.2, color: rgb(0.08, 0.27, 0.18) });
  y = y - 48;
  for (const linea of lineas) {
    portada.drawText(linea.slice(0, 110), { x: MARGEN, y, size: 10, font: fuente, color: rgb(0.13, 0.17, 0.14) });
    y -= 15;
    if (y < MARGEN) break; // una constancia no debería desbordar; si pasa, se trunca visiblemente al pie
  }

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
