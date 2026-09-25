import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  construirPaqueteSellado,
  lineasConstanciaPaquete,
  PaqueteSelladoError,
  type DatosConstanciaPaquete,
} from '@/lib/sello/paquete-sellado';

/* ══════════════════════════════════════════════════════════════
   EL PAQUETE SELLADO — custodio de la composición (1-sep-2026).

   Nace con la ruta /sellados, que el detalle enlazó desde su primer día sin
   que existiera. El propietario definió el paquete: un solo PDF, la
   constancia de primera hoja, todos los documentos sellados, y lo no
   empaquetable LISTADO en la constancia — no callado.

   Corre sobre PDFs SINTÉTICOS construidos aquí mismo con pdf-lib: el builder
   es puro sobre bytes (el IO vive en la ruta), así que se ejercita el
   mecanismo real de punta a punta — sellado incluido — sin Storage ni red.

   ALCANCE DECLARADO (ADR-0033 §4.6-bis). Esto MIRA:
     · el conteo de páginas del paquete (constancia + páginas selladas);
     · el reparto incluidos/aparte por tipo, CON su motivo;
     · que la constancia liste a los dos grupos (vía `lineasConstanciaPaquete`,
       la MISMA función de la que se dibuja la página — una sola fuente);
     · que un paquete sin nada empaquetable FALLE en vez de ser pura carátula.
   Esto NO mira: el dibujo del sello (custodiado en
   `sello-todas-las-paginas.test.ts` y `sello-pdf-generar.test.ts`), ni la
   ruta HTTP (auth, materialización, URL firmada — la existencia del route.ts
   la exige `acciones-papel-alcanzables.test.ts`), ni la extracción de texto
   del PDF final (pdf-lib no lee texto; por eso la constancia se asevera por
   su función de líneas y no por el binario).
══════════════════════════════════════════════════════════════ */

const SELLO = { radicadoId: '1-110-202609-00000002', fechaHoraLegible: '1 de septiembre de 2026, 8:00 a. m.' };

const CONSTANCIA: DatosConstanciaPaquete = {
  numeroRadicado: '1-110-202609-00000002',
  solicitanteNombre: 'andres',
  solicitanteDocumento: '123446432',
  descripcionTramite: 'Licencia de construcción',
  desdeCuandoCorreElPlazo: '2026-09-01T13:00:00.000Z',
  requisitosVerificados: 17,
  funcionarioNombre: 'Funcionaria de Planeación Lab',
  expedidaEnLegible: '1 de septiembre de 2026, 8:00 a. m.',
};

async function pdfSintetico(paginas: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([612, 792]);
  return doc.save();
}

/** PNG válido de 1×1 — suficiente para que pdf-lib lo embeba de verdad. */
const PNG_1X1 = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
));

describe('construirPaqueteSellado — la composición del paquete', () => {
  it('constancia + PDFs sellados + imagen vuelta página; lo demás, aparte con su motivo', async () => {
    const resultado = await construirPaqueteSellado({
      constancia: CONSTANCIA,
      sello: SELLO,
      documentos: [
        { documentoId: 'd1', nombre: 'Proyecto arquitectónico.pdf', mimeType: 'application/pdf', bytes: await pdfSintetico(2) },
        { documentoId: 'd2', nombre: 'Paz y salvo.pdf', mimeType: 'application/pdf', bytes: await pdfSintetico(1) },
        { documentoId: 'd3', nombre: 'Foto de la valla.png', mimeType: 'image/png', bytes: PNG_1X1 },
        { documentoId: 'd4', nombre: 'Memorial.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: await pdfSintetico(1) },
        { documentoId: 'd5', nombre: 'Escritura sin archivo.pdf', mimeType: 'application/pdf', bytes: null },
      ],
    });

    /* 1 constancia + 2 + 1 + 1 (la imagen es una página) = 5. Si alguien
       «simplifica» saltándose las imágenes, esta cuenta lo delata. */
    expect(resultado.totalPaginas, 'el paquete no trae las páginas que su composición suma').toBe(5);
    expect(resultado.incluidos.map((d) => d.documentoId)).toEqual(['d1', 'd2', 'd3']);
    expect(resultado.aparte).toEqual([
      { documentoId: 'd4', nombre: 'Memorial.docx', motivo: 'FORMATO_NO_EMPAQUETABLE' },
      { documentoId: 'd5', nombre: 'Escritura sin archivo.pdf', motivo: 'SIN_ARCHIVO' },
    ]);

    // El binario es un PDF de verdad, con ese mismo número de páginas.
    const releido = await PDFDocument.load(resultado.bytes);
    expect(releido.getPageCount()).toBe(5);
  });

  it('la constancia lista los incluidos Y los no incluidos — la misma función que dibuja la página', async () => {
    const resultado = await construirPaqueteSellado({
      constancia: CONSTANCIA,
      sello: SELLO,
      documentos: [
        { documentoId: 'd1', nombre: 'Único.pdf', mimeType: 'application/pdf', bytes: await pdfSintetico(1) },
        { documentoId: 'd4', nombre: 'Memorial.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: await pdfSintetico(1) },
      ],
    });
    const { lineas } = lineasConstanciaPaquete(CONSTANCIA, resultado.incluidos, resultado.aparte);
    const texto = lineas.join('\n');

    expect(texto).toContain('1-110-202609-00000002');
    expect(texto).toContain('Único.pdf');
    /* La mitad que NO se puede callar: el ciudadano tiene que leer en el papel
       qué NO va adentro y por qué — si no, el paquete afirma completitud que
       no tiene. */
    /* Sin exigir caja tipográfica: el rediseño del 1-sep (lenguaje del
       comprobante) puso la sección en mayúsculas. El invariante es que la
       sección EXISTA, no cómo grita. */
    expect(texto, 'la constancia dejó de declarar los documentos no incluidos').toMatch(/no incluidos/i);
    expect(texto).toContain('Memorial.docx');
  });

  it('sin nada empaquetable, FALLA — un paquete que es pura carátula miente', async () => {
    await expect(
      construirPaqueteSellado({
        constancia: CONSTANCIA,
        sello: SELLO,
        documentos: [
          { documentoId: 'd4', nombre: 'Memorial.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: await pdfSintetico(1) },
        ],
      }),
    ).rejects.toThrowError(PaqueteSelladoError);
  });

  it('un PDF corrupto no tumba el paquete de los demás: queda aparte, con motivo', async () => {
    const resultado = await construirPaqueteSellado({
      constancia: CONSTANCIA,
      sello: SELLO,
      documentos: [
        { documentoId: 'd1', nombre: 'Sano.pdf', mimeType: 'application/pdf', bytes: await pdfSintetico(1) },
        { documentoId: 'dx', nombre: 'Corrupto.pdf', mimeType: 'application/pdf', bytes: Uint8Array.from([1, 2, 3, 4]) },
      ],
    });

    expect(resultado.incluidos.map((d) => d.documentoId)).toEqual(['d1']);
    expect(resultado.aparte).toEqual([{ documentoId: 'dx', nombre: 'Corrupto.pdf', motivo: 'NO_SE_PUDO_SELLAR' }]);
  });
});
