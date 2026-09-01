import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { sellarPrimeraPagina, SelloPDFError, tamanoQueCabe } from '@/lib/sello/generar-sello-pdf';

/* ══════════════════════════════════════════════════════════════
   Sprint Ventanilla Operativa 3 — generación real del sello.

   Estos tests crean PDFs de prueba con pdf-lib, invocan el sellado
   real, y verifican que el resultado sea un PDF válido con la misma
   cantidad de páginas. NO tocan Storage ni Firestore.
══════════════════════════════════════════════════════════════ */

async function crearPdfDePrueba(numeroPaginas: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < numeroPaginas; i += 1) {
    doc.addPage([612, 792]); // Carta portrait
  }
  return doc.save();
}

describe('Sprint Op 3 — sellarPrimeraPagina', () => {
  /* 1 */
  it('sella un PDF de 1 página y devuelve bytes válidos con magic PDF', async () => {
    const original = await crearPdfDePrueba(1);
    const resultado = await sellarPrimeraPagina(original, {
      radicadoId:       '1-OFICIO-2026-00000042',
      fechaHoraLegible: '2 jul 2026 · 08:15',
    });

    expect(resultado.bytes.byteLength).toBeGreaterThan(0);
    expect(resultado.paginasEstampadas).toBe(1);
    // Magic bytes de PDF: %PDF-
    const cabecera = new TextDecoder().decode(resultado.bytes.slice(0, 5));
    expect(cabecera).toBe('%PDF-');
  });

  /* 2 */
  it('preserva el número de páginas original', async () => {
    const original = await crearPdfDePrueba(3);
    const resultado = await sellarPrimeraPagina(original, {
      radicadoId:       '1-OFICIO-2026-00000043',
      fechaHoraLegible: '2 jul 2026 · 08:16',
    });

    const selladoDoc = await PDFDocument.load(resultado.bytes);
    expect(selladoDoc.getPageCount()).toBe(3);
  });

  /* 3 — sello solo en la primera página. Sanity check: cargar el
     sellado y verificar que solo hay contenido nuevo en la página 0.
     Verificación indirecta: los bytes crecen respecto al original
     por el contenido del sello. */
  it('el sellado agrega bytes al PDF original (contenido del sello)', async () => {
    const original = await crearPdfDePrueba(1);
    const resultado = await sellarPrimeraPagina(original, {
      radicadoId:       '1-OFICIO-2026-00000044',
      fechaHoraLegible: '2 jul 2026 · 08:17',
    });
    expect(resultado.bytes.byteLength).toBeGreaterThan(original.byteLength);
  });

  /* 4 — bytes corruptos deben fallar limpio con SelloPDFError. */
  it('rechaza bytes que no son un PDF válido con SelloPDFError', async () => {
    const noEsPdf = new TextEncoder().encode('esto no es un pdf');
    await expect(sellarPrimeraPagina(noEsPdf, {
      radicadoId:       '1-OFICIO-2026-00000045',
      fechaHoraLegible: '2 jul 2026 · 08:18',
    })).rejects.toThrow(SelloPDFError);
  });
});

/* ══════════════════════════════════════════════════════════════
   tamanoQueCabe — ninguna línea del sello se parte ni se pisa (1-sep-2026).

   El defecto que la exige: el sello usaba `maxWidth` de pdf-lib, que NO
   encoge — PARTE la línea en dos, y la segunda mitad aterrizaba sobre la
   fila de abajo («ÚNICA» pisando la fecha, en la muestra que el propietario
   rechazó). La mutación realista es quitar el ajuste («la guarda es
   redundante, siempre cabe») devolviendo el tamaño base.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA: que el tamaño devuelto
   haga caber el texto medido con la métrica real de la fuente, y que un texto
   que ya cabe no se toque. NO mira: el dibujo (posiciones de las filas) ni el
   contenido del sello (custodiado aparte).
══════════════════════════════════════════════════════════════ */
describe('tamanoQueCabe — el ajuste que evita la línea partida', () => {
  it('el título real del sello, junto al escudo, cabe en UNA línea', async () => {
    const doc = await PDFDocument.create();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    // 109 pt = 150 de sello − 12 de padding − 24 de escudo − 5 de gap.
    const size = tamanoQueCabe(bold, 'RECIBIDO POR VENTANILLA ÚNICA', 6.5, 109);
    expect(bold.widthOfTextAtSize('RECIBIDO POR VENTANILLA ÚNICA', size)).toBeLessThanOrEqual(109);
    expect(size).toBeGreaterThan(5.5); // se encoge décimas, no se vuelve ilegible
  });

  it('un texto que ya cabe conserva su tamaño base exacto', async () => {
    const doc = await PDFDocument.create();
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    expect(tamanoQueCabe(reg, 'corto', 6.5, 200)).toBe(6.5);
  });

  it('un texto desbordado vuelve medido POR DEBAJO del ancho disponible', async () => {
    const doc = await PDFDocument.create();
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    const largo = 'una fecha larguísima que jamás cabría en el sello de ninguna manera';
    const size = tamanoQueCabe(reg, largo, 6.5, 109);
    expect(size).toBeLessThan(6.5);
    expect(reg.widthOfTextAtSize(largo, size)).toBeLessThanOrEqual(109 + 1e-9);
  });
});
