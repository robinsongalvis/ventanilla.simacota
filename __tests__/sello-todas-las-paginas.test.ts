import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  sellarTodasLasPaginas,
  sellarPrimeraPagina,
  SelloPDFError,
} from '@/lib/sello/generar-sello-pdf';

/**
 * EL SELLO EN CADA PÁGINA — el patrón físico del mostrador llevado al PDF.
 *
 * La decisión que estas pruebas fijan es la de la página que NO admite el
 * sello: no se aborta el documento entero (perder cuarenta sellos por un
 * recorte es desproporcionado) pero tampoco pasa en silencio.
 */

const DATOS = {
  radicadoId: '1-110-202608-00000123',
  fechaHoraLegible: '27 de agosto de 2026, 3:14 p. m.',
};

/** `medidas` en puntos; una entrada por página. Carta = [612, 792]. */
async function pdfCon(medidas: [number, number][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const m of medidas) doc.addPage(m);
  return doc.save();
}

const CARTA: [number, number] = [612, 792];
/**
 * Una página en la que el sello CABRÍA —se encoge— pero quedaría ilegible.
 * 100 pt de ancho deja un sello de 76, por debajo del mínimo de 120 con el que
 * el número de radicado sale cortado.
 */
const RECORTE: [number, number] = [100, 300];

describe('sella todas las páginas', () => {
  it('un documento de cinco páginas recibe cinco sellos', async () => {
    const r = await sellarTodasLasPaginas(await pdfCon([CARTA, CARTA, CARTA, CARTA, CARTA]), DATOS);
    expect(r.paginasEstampadas).toBe(5);
    expect(r.totalPaginas).toBe(5);
    expect(r.paginasSinSello).toEqual([]);
  });

  it('el ORIGINAL no se toca: se devuelve una copia', async () => {
    /* El requisito literal: el original queda intacto en Storage, el sello solo
       aparece en la copia que sale. */
    const original = await pdfCon([CARTA, CARTA]);
    const copia = Uint8Array.from(original);
    const r = await sellarTodasLasPaginas(original, DATOS);
    expect(original, 'los bytes de entrada no pueden mutar').toEqual(copia);
    expect(r.bytes).not.toEqual(original);
  });

  it('la copia sigue siendo un PDF legible, con las mismas páginas', async () => {
    const r = await sellarTodasLasPaginas(await pdfCon([CARTA, CARTA, CARTA]), DATOS);
    const releida = await PDFDocument.load(r.bytes);
    expect(releida.getPages()).toHaveLength(3);
  });
});

describe('la página que no admite el sello', () => {
  it('NO tumba el documento entero — las demás sí se sellan', async () => {
    /* El castigo desproporcionado que esta decisión evita: perder el sello en
       cuatro páginas buenas porque la tercera era un recorte. */
    const r = await sellarTodasLasPaginas(await pdfCon([CARTA, CARTA, RECORTE, CARTA, CARTA]), DATOS);
    expect(r.paginasEstampadas).toBe(4);
    expect(r.totalPaginas).toBe(5);
  });

  it('y NO pasa en silencio: se dice cuál fue, en numeración humana', async () => {
    const r = await sellarTodasLasPaginas(await pdfCon([CARTA, CARTA, RECORTE, CARTA]), DATOS);
    expect(r.paginasSinSello, 'la tercera página, contada como la cuenta una persona').toEqual([3]);
  });

  it('varias sin sello se enumeran todas', async () => {
    const r = await sellarTodasLasPaginas(await pdfCon([RECORTE, CARTA, RECORTE]), DATOS);
    expect(r.paginasSinSello).toEqual([1, 3]);
    expect(r.paginasEstampadas).toBe(1);
  });

  it('si NINGUNA admite el sello, falla en vez de entregar una copia sin sellos', async () => {
    /* Una «copia sellada» sin un solo sello afirmaría con el nombre del archivo
       algo que el documento no dice. */
    await expect(sellarTodasLasPaginas(await pdfCon([RECORTE, RECORTE]), DATOS)).rejects.toThrow(SelloPDFError);
  });
});

describe('el contrato de ventanilla no cambió', () => {
  it('`sellarPrimeraPagina` sigue sellando una sola', async () => {
    /* Lo consume `POST /api/radicados/[radicadoId]/sellar-documento`. Extender
       el sello a todas las páginas NO podía cambiar lo que ya estaba en
       producción para los radicados. */
    const r = await sellarPrimeraPagina(await pdfCon([CARTA, CARTA, CARTA]), DATOS);
    expect(r.paginasEstampadas).toBe(1);
  });

  it('y sigue fallando si la primera no admite el sello', async () => {
    await expect(sellarPrimeraPagina(await pdfCon([RECORTE, CARTA]), DATOS)).rejects.toThrow(SelloPDFError);
  });
});

describe('los errores tipados siguen en pie', () => {
  it('un PDF corrupto se reconoce como tal', async () => {
    const basura = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(sellarTodasLasPaginas(basura, DATOS)).rejects.toMatchObject({ codigo: 'CORRUPTO' });
  });

  /* `SIN_PAGINAS` NO se cubre, y se dice por qué en vez de fingir que sí:
     `PDFDocument.create().save()` produce un PDF que al releerse trae UNA
     página, así que desde este constructor el estado es inalcanzable —lo
     comprobé antes de escribir esto—. La guarda sigue en el código como defensa
     ante un PDF hecho a mano, pero una prueba que no puede provocar el estado
     que asevera es de las que pasan por el motivo equivocado. */
});
