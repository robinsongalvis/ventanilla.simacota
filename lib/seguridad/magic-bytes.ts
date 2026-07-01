/**
 * Validación de archivos por firma binaria y, para DOCX/XLSX,
 * por estructura interna mínima del contenedor ZIP — H-08.
 *
 * El `Content-Type` y la extensión vienen del cliente y son falsificables.
 * Esta función inspecciona los primeros bytes del buffer real (PDF/JPG/PNG)
 * o los local file headers del ZIP (DOCX/XLSX) para confirmar que el
 * contenido coincide con el tipo declarado.
 *
 * NO implementa antivirus, NO descomprime el ZIP, NO parsea XML.
 * Solo confirma firma del formato y, en Office Open XML, presencia mínima
 * de la estructura esperada y ausencia de macros (vbaProject.bin).
 */

const PDF_MIME  = 'application/pdf';
const JPG_MIME  = 'image/jpeg';
const PNG_MIME  = 'image/png';
const WEBP_MIME = 'image/webp';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FIRMAS_PREFIJO: Record<string, readonly number[][]> = {
  [PDF_MIME]: [[0x25, 0x50, 0x44, 0x46, 0x2D]],            // %PDF-
  [JPG_MIME]: [[0xFF, 0xD8, 0xFF]],                         // FFD8FF
  [PNG_MIME]: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
};

const ZIP_LOCAL_HEADER = [0x50, 0x4B, 0x03, 0x04]; // PK\x03\x04
const MAX_ZIP_ENTRIES_SCAN = 500;
const ZIP_LOCAL_HEADER_SIZE = 30;

export function tiposPermitidosMagicBytes(): readonly string[] {
  return [PDF_MIME, JPG_MIME, PNG_MIME, WEBP_MIME, DOCX_MIME, XLSX_MIME];
}

export function verificarMagicBytes(buffer: Buffer, tipoDeclarado: string): boolean {
  if (buffer.length === 0) return false;

  if (FIRMAS_PREFIJO[tipoDeclarado]) {
    return matchPrefijo(buffer, FIRMAS_PREFIJO[tipoDeclarado]);
  }

  if (tipoDeclarado === WEBP_MIME) return verificarWebp(buffer);
  if (tipoDeclarado === DOCX_MIME) return verificarEstructuraOffice(buffer, 'word');
  if (tipoDeclarado === XLSX_MIME) return verificarEstructuraOffice(buffer, 'xl');

  return false;
}

/**
 * WebP es un contenedor RIFF: bytes 0-3 = "RIFF", 4-7 = tamaño (varía),
 * 8-11 = "WEBP". Los chunks (VP8/VP8L/VP8X) empiezan en byte 12 y no se
 * revisan aquí. Rechaza otros RIFF como WAV o AVI.
 */
function verificarWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // "RIFF" en bytes 0-3
  if (buffer[0] !== 0x52 || buffer[1] !== 0x49
   || buffer[2] !== 0x46 || buffer[3] !== 0x46) return false;
  // "WEBP" en bytes 8-11 (saltamos los 4 bytes de file size)
  if (buffer[8] !== 0x57 || buffer[9] !== 0x45
   || buffer[10] !== 0x42 || buffer[11] !== 0x50) return false;
  return true;
}

function matchPrefijo(buffer: Buffer, firmas: readonly number[][]): boolean {
  return firmas.some((firma) => {
    if (buffer.length < firma.length) return false;
    for (let i = 0; i < firma.length; i += 1) {
      if (buffer[i] !== firma[i]) return false;
    }
    return true;
  });
}

/**
 * Para DOCX/XLSX: ZIP que contiene `[Content_Types].xml` y al menos una
 * entrada bajo la carpeta esperada (`word/` o `xl/`), y que NO contiene
 * `vbaProject.bin` (eso es DOCM/XLSM disfrazado).
 */
function verificarEstructuraOffice(buffer: Buffer, carpetaEsperada: 'word' | 'xl'): boolean {
  if (!matchPrefijo(buffer, [ZIP_LOCAL_HEADER])) return false;

  const nombres = extraerNombresZip(buffer);
  if (nombres.length === 0) return false;

  const tieneContentTypes = nombres.includes('[Content_Types].xml');
  const tieneCarpeta      = nombres.some((n) => n.startsWith(`${carpetaEsperada}/`));
  const tieneMacro        = nombres.includes(`${carpetaEsperada}/vbaProject.bin`);

  return tieneContentTypes && tieneCarpeta && !tieneMacro;
}

/**
 * Recorre los local file headers del ZIP devolviendo los filenames.
 * No descomprime nada. Acotado a MAX_ZIP_ENTRIES_SCAN para limitar CPU.
 */
function extraerNombresZip(buffer: Buffer): string[] {
  const nombres: string[] = [];
  const fin = buffer.length;
  let offset = 0;
  let entradas = 0;

  while (offset + ZIP_LOCAL_HEADER_SIZE <= fin && entradas < MAX_ZIP_ENTRIES_SCAN) {
    if (
      buffer[offset]     !== ZIP_LOCAL_HEADER[0]
      || buffer[offset + 1] !== ZIP_LOCAL_HEADER[1]
      || buffer[offset + 2] !== ZIP_LOCAL_HEADER[2]
      || buffer[offset + 3] !== ZIP_LOCAL_HEADER[3]
    ) {
      break;
    }

    const compSize    = buffer.readUInt32LE(offset + 18);
    const filenameLen = buffer.readUInt16LE(offset + 26);
    const extraLen    = buffer.readUInt16LE(offset + 28);

    const filenameStart = offset + ZIP_LOCAL_HEADER_SIZE;
    const filenameEnd   = filenameStart + filenameLen;
    if (filenameEnd > fin) break;

    nombres.push(buffer.subarray(filenameStart, filenameEnd).toString('utf8'));

    offset = filenameEnd + extraLen + compSize;
    entradas += 1;
  }

  return nombres;
}
