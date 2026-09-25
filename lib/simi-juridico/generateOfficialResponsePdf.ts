import { createHash } from 'node:crypto';
import type { RespuestaFirma } from '@/src/types/simi-firma';
import type { VentanillaRadicado } from '@/src/types/ventanilla';

export interface OfficialResponsePdfInput {
  firmaId: string;
  firma: RespuestaFirma;
  radicado?: VentanillaRadicado | null;
  dependenciaNombre: string;
  fechaGeneracion?: string;
}

export interface OfficialResponsePdfResult {
  buffer: Buffer;
  hash: string;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT = 54;
const MAX_CHARS = 88;

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7EÁÉÍÓÚáéíóúÑñÜü¿¡]/g, ' ')
    .trim();
}

function escapePdfText(value: string): string {
  return normalizeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatDate(iso?: string): string {
  if (!iso) return 'No registrada';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

function wrapLine(text: string, maxChars = MAX_CHARS): string[] {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function addText(commands: string[], text: string, x: number, y: number, size = 10, font = 'F1') {
  commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
}

function addWrapped(commands: string[], text: string, x: number, y: number, size = 10, lineHeight = 15): number {
  let cursor = y;
  const paragraphs = normalizeText(text).split('\n').map((p) => p.trim());

  for (const paragraph of paragraphs) {
    for (const line of wrapLine(paragraph)) {
      addText(commands, line, x, cursor, size);
      cursor -= lineHeight;
    }
    cursor -= lineHeight / 2;
  }

  return cursor;
}

function buildContent(input: OfficialResponsePdfInput, hash: string): string {
  const { firma, radicado, dependenciaNombre } = input;
  const fechaGeneracion = input.fechaGeneracion ?? new Date().toISOString();
  const solicitante = radicado?.esAnonimo || radicado?.identidadReservada
    ? 'Solicitante anonimo / reservado'
    : radicado?.solicitante?.nombreCompleto ?? 'Peticionario(a)';
  const asunto = radicado?.detalle?.asunto ?? firma.radicadoId;
  const fechaRadicado = radicado?.control?.fechaRadicado ?? radicado?.ultimaActualizacion;
  const commands: string[] = [
    '0.08 0.32 0.18 rg',
    `0 ${PAGE_HEIGHT - 78} ${PAGE_WIDTH} 78 re f`,
    '0 0 0 RG',
    '1 1 1 rg',
  ];

  addText(commands, 'ALCALDIA MUNICIPAL DE SIMACOTA', LEFT, 744, 15, 'F2');
  addText(commands, 'Ventanilla Unica Digital - Respuesta oficial', LEFT, 724, 10);
  addText(commands, `Radicado ${firma.radicadoId}`, 372, 744, 10, 'F2');

  commands.push('0.10 0.10 0.10 rg');
  addText(commands, 'RESPUESTA OFICIAL AL CIUDADANO', LEFT, 686, 14, 'F2');
  addText(commands, `Dependencia: ${dependenciaNombre}`, LEFT, 660, 10);
  addText(commands, `Fecha de radicacion: ${formatDate(fechaRadicado)}`, LEFT, 644, 10);
  addText(commands, `Fecha de respuesta: ${formatDate(firma.fechaEnvio ?? firma.fechaFirma ?? fechaGeneracion)}`, LEFT, 628, 10);
  addText(commands, `Destinatario: ${solicitante}`, LEFT, 612, 10);
  addText(commands, `Asunto: ${asunto}`, LEFT, 596, 10);
  addText(commands, `Referencia: Radicado ${firma.radicadoId}`, LEFT, 580, 10);

  commands.push('0.85 0.85 0.85 RG', `${LEFT} 562 504 1 re S`, '0.10 0.10 0.10 rg');
  let y = 536;
  y = addWrapped(commands, firma.textoRespuestaFinal ?? 'Respuesta oficial registrada sin texto adicional.', LEFT, y, 10, 15);

  const footerY = Math.max(92, y - 18);
  addText(commands, 'Firma institucional', LEFT, footerY, 11, 'F2');
  addText(commands, `${firma.firmadoPor ?? firma.aprobadoPor ?? 'Funcionario autorizado'}`, LEFT, footerY - 17, 10);
  addText(commands, `${firma.firmadoPorCargo ?? firma.aprobadoPorRol ?? 'Cargo no registrado'}`, LEFT, footerY - 32, 9);
  addText(commands, `Canal de envio: ${firma.canalEnvio ?? 'portal'}`, LEFT, footerY - 49, 9);
  addText(commands, `Hash SHA-256: ${hash}`, LEFT, footerY - 64, 8);
  addText(commands, 'Documento generado con trazabilidad institucional MIPG. No contiene analisis interno de SIMI.', LEFT, 44, 8);
  addText(commands, 'Alcaldia Municipal de Simacota - Santander - Colombia', LEFT, 30, 8);

  return commands.join('\n');
}

function buildPdf(content: string): Buffer {
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

export function generateOfficialResponsePdf(input: OfficialResponsePdfInput): OfficialResponsePdfResult {
  const hashSource = [
    input.firma.radicadoId,
    input.firma.textoRespuestaFinal ?? '',
    input.firma.fechaFirma ?? '',
    input.firma.firmadoPor ?? '',
  ].join('\n');
  const hash = createHash('sha256').update(hashSource, 'utf8').digest('hex').toUpperCase();
  const content = buildContent(input, hash);

  return {
    buffer: buildPdf(content),
    hash,
  };
}
