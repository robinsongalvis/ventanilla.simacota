import { describe, expect, it } from 'vitest';
import { verificarMagicBytes, tiposPermitidosMagicBytes } from '@/lib/seguridad/magic-bytes';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const WEBP_MIME = 'image/webp';
const DOC_OLE_MIME = 'application/msword';

// Firma de Compound File Binary Format (OLE) — .doc/.xls/.ppt antiguos.
const OLE_VALIDO = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00, 0x00]);

const PDF_VALIDO = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A]);
const JPG_VALIDO = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
const PNG_VALIDO = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
const TEXTO      = Buffer.from('hola mundo', 'utf8');
// WebP mínimo: RIFF + 4 bytes tamaño + WEBP + 4 bytes chunk placeholder.
const WEBP_VALIDO = Buffer.from([
  0x52, 0x49, 0x46, 0x46,  // RIFF
  0x10, 0x00, 0x00, 0x00,  // size (little-endian)
  0x57, 0x45, 0x42, 0x50,  // WEBP
  0x56, 0x50, 0x38, 0x20,  // VP8 chunk header (placeholder)
]);
// WAV: mismo RIFF pero con "WAVE" en offset 8.
const WAV_ES_RIFF_NO_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46,  // RIFF
  0x10, 0x00, 0x00, 0x00,
  0x57, 0x41, 0x56, 0x45,  // WAVE
  0x66, 0x6D, 0x74, 0x20,
]);

/**
 * Construye un buffer ZIP mínimo con las entradas dadas (sin datos comprimidos).
 * Cada entrada es: local file header (30 bytes) + filename. compSize = 0.
 */
function buildZipConFiles(filenames: string[]): Buffer {
  const partes: Buffer[] = [];
  for (const name of filenames) {
    const nameBuf = Buffer.from(name, 'utf8');
    const header  = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);          // signature PK\x03\x04
    header.writeUInt16LE(10, 4);                   // version needed
    header.writeUInt16LE(0, 6);                    // general purpose flag
    header.writeUInt16LE(0, 8);                    // compression = store
    header.writeUInt32LE(0, 14);                   // CRC-32 = 0
    header.writeUInt32LE(0, 18);                   // compressed size = 0
    header.writeUInt32LE(0, 22);                   // uncompressed size = 0
    header.writeUInt16LE(nameBuf.length, 26);      // filename length
    header.writeUInt16LE(0, 28);                   // extra length
    partes.push(header, nameBuf);
  }
  return Buffer.concat(partes);
}

describe('verificarMagicBytes — formatos simples (H-08)', () => {
  it('acepta PDF con firma %PDF-', () => {
    expect(verificarMagicBytes(PDF_VALIDO, 'application/pdf')).toBe(true);
  });

  it('acepta JPEG con firma FFD8FF', () => {
    expect(verificarMagicBytes(JPG_VALIDO, 'image/jpeg')).toBe(true);
  });

  it('acepta PNG con firma de 8 bytes', () => {
    expect(verificarMagicBytes(PNG_VALIDO, 'image/png')).toBe(true);
  });

  it('rechaza texto plano declarado como JPG', () => {
    expect(verificarMagicBytes(TEXTO, 'image/jpeg')).toBe(false);
  });

  it('rechaza PDF declarado pero contenido PNG', () => {
    expect(verificarMagicBytes(PNG_VALIDO, 'application/pdf')).toBe(false);
  });

  it('rechaza buffer vacío', () => {
    expect(verificarMagicBytes(Buffer.alloc(0), 'application/pdf')).toBe(false);
  });

  it('rechaza tipos no soportados', () => {
    expect(verificarMagicBytes(PDF_VALIDO, 'application/zip')).toBe(false);
    expect(verificarMagicBytes(PDF_VALIDO, '')).toBe(false);
  });
});

describe('verificarMagicBytes — DOCX/XLSX (H-08)', () => {
  it('acepta DOCX con [Content_Types].xml y carpeta word/', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'word/document.xml', 'word/_rels/document.xml.rels']);
    expect(verificarMagicBytes(zip, DOCX_MIME)).toBe(true);
  });

  it('acepta XLSX con [Content_Types].xml y carpeta xl/', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    expect(verificarMagicBytes(zip, XLSX_MIME)).toBe(true);
  });

  it('rechaza DOCX que contiene word/vbaProject.bin (DOCM disfrazado)', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'word/document.xml', 'word/vbaProject.bin']);
    expect(verificarMagicBytes(zip, DOCX_MIME)).toBe(false);
  });

  it('rechaza XLSX que contiene xl/vbaProject.bin (XLSM disfrazado)', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'xl/workbook.xml', 'xl/vbaProject.bin']);
    expect(verificarMagicBytes(zip, XLSX_MIME)).toBe(false);
  });

  it('rechaza ZIP con [Content_Types].xml pero sin carpeta word/ ni xl/', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'odt/content.xml']);
    expect(verificarMagicBytes(zip, DOCX_MIME)).toBe(false);
    expect(verificarMagicBytes(zip, XLSX_MIME)).toBe(false);
  });

  it('rechaza ZIP con word/ pero sin [Content_Types].xml', () => {
    const zip = buildZipConFiles(['word/document.xml']);
    expect(verificarMagicBytes(zip, DOCX_MIME)).toBe(false);
  });

  it('rechaza buffer no-ZIP declarado como DOCX', () => {
    expect(verificarMagicBytes(PDF_VALIDO, DOCX_MIME)).toBe(false);
    expect(verificarMagicBytes(TEXTO,      DOCX_MIME)).toBe(false);
  });

  it('expone la lista de 7 tipos permitidos', () => {
    const tipos = tiposPermitidosMagicBytes();
    expect(tipos).toEqual(
      expect.arrayContaining([
        'application/pdf', 'image/jpeg', 'image/png', WEBP_MIME, DOCX_MIME, XLSX_MIME, PPTX_MIME,
      ]),
    );
    expect(tipos).toHaveLength(7);
  });
});

describe('verificarMagicBytes — PPTX (anexos Office)', () => {
  it('acepta PPTX con [Content_Types].xml y carpeta ppt/', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/slides/slide1.xml']);
    expect(verificarMagicBytes(zip, PPTX_MIME)).toBe(true);
  });

  it('rechaza PPTX que contiene ppt/vbaProject.bin (PPTM disfrazado)', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'ppt/presentation.xml', 'ppt/vbaProject.bin']);
    expect(verificarMagicBytes(zip, PPTX_MIME)).toBe(false);
  });

  it('rechaza ZIP genérico renombrado a .pptx (sin carpeta ppt/)', () => {
    const zip = buildZipConFiles(['[Content_Types].xml', 'otra-carpeta/archivo.xml']);
    expect(verificarMagicBytes(zip, PPTX_MIME)).toBe(false);
  });

  it('rechaza ZIP con carpeta ppt/ pero sin [Content_Types].xml', () => {
    const zip = buildZipConFiles(['ppt/presentation.xml']);
    expect(verificarMagicBytes(zip, PPTX_MIME)).toBe(false);
  });

  it('rechaza buffer no-ZIP declarado como PPTX', () => {
    expect(verificarMagicBytes(PDF_VALIDO, PPTX_MIME)).toBe(false);
    expect(verificarMagicBytes(TEXTO,      PPTX_MIME)).toBe(false);
  });
});

describe('verificarMagicBytes — exclusión deliberada de formatos OLE antiguos', () => {
  it('rechaza .doc (application/msword, Compound File Binary) — tipo declarado no soportado', () => {
    expect(verificarMagicBytes(OLE_VALIDO, DOC_OLE_MIME)).toBe(false);
  });

  it('rechaza un OLE válido incluso si se declara como DOCX (no es un ZIP)', () => {
    expect(verificarMagicBytes(OLE_VALIDO, DOCX_MIME)).toBe(false);
  });
});

describe('verificarMagicBytes — WebP (H-08 Sprint A)', () => {
  it('acepta WebP con firma RIFF+WEBP', () => {
    expect(verificarMagicBytes(WEBP_VALIDO, WEBP_MIME)).toBe(true);
  });

  it('rechaza RIFF válido pero no WEBP (por ejemplo WAV)', () => {
    expect(verificarMagicBytes(WAV_ES_RIFF_NO_WEBP, WEBP_MIME)).toBe(false);
  });

  it('rechaza buffer no-RIFF declarado como WebP', () => {
    expect(verificarMagicBytes(PNG_VALIDO, WEBP_MIME)).toBe(false);
    expect(verificarMagicBytes(TEXTO,      WEBP_MIME)).toBe(false);
  });

  it('rechaza buffer demasiado corto para verificar', () => {
    const cortito = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
    expect(verificarMagicBytes(cortito, WEBP_MIME)).toBe(false);
  });
});
