import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { sellarPrimeraPagina, SelloPDFError } from '@/lib/sello/generar-sello-pdf';

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
