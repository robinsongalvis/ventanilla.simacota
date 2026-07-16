/**
 * @vitest-environment node
 *
 * Anexos Office (OOXML) en radicación ciudadana — allowlist ampliada de
 * `/api/radicacion` para admitir DOCX/XLSX/PPTX junto a PDF/JPG/PNG.
 *
 * Ejercita el handler POST real (misma técnica que
 * radicacion-ciudadana-atomicidad.test.ts): solo mockea la frontera Admin
 * SDK. Cubre:
 *  1. Un anexo PPTX con firma binaria válida pasa la validación de tipo Y
 *     la verificación de magic-bytes (llega hasta la capa de persistencia,
 *     que aquí falla a propósito — no es el foco de esta prueba).
 *  2. Un anexo con extensión/Content-Type de formato Office antiguo (OLE,
 *     .doc) se rechaza en la validación de tipo, ANTES de tocar
 *     Storage/DB — exclusión deliberada, ver lib/seguridad/magic-bytes.ts.
 *
 * Entorno forzado a 'node' (no jsdom, el default del proyecto): el `File`
 * de jsdom no es reconocido por el parser multipart de `request.formData()`
 * (undici) — produce un falso positivo (ambos casos caían en el catch-all
 * de error 500, no en la validación real). Sin este pragma, un test de
 * "PPTX aceptado" pasaría por la razón equivocada.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const YEAR = new Date().getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

let contadores: Record<string, number>;

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  collection: () => ({ add: async () => ({ id: 'trz' }) }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      set: (ref: { path: string }, data: { ultimo?: number }) => {
        // La escritura del documento del radicado falla a propósito: para
        // esta prueba solo importa si el request LLEGÓ hasta aquí (pasó
        // ALLOWED_FILE_TYPES + verificarMagicBytes) o fue rechazado antes.
        if (ref.path.startsWith('ventanilla_radicados/')) {
          throw new Error('persistencia no ejercitada en esta prueba');
        }
        if (ref.path.startsWith('counters/')) contadores[ref.path] = data.ultimo!;
      },
    };
    return cb(tx);
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({ file: () => ({ save: async () => {}, move: async () => {} }) }),
  }),
}));

import { POST } from '@/app/api/radicacion/route';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DOC_OLE_MIME = 'application/msword';

/** ZIP mínimo válido con estructura PPTX ([Content_Types].xml + ppt/). */
function buildPptxValido(): Buffer {
  const nombres = ['[Content_Types].xml', 'ppt/presentation.xml'];
  const partes: Buffer[] = [];
  for (const name of nombres) {
    const nameBuf = Buffer.from(name, 'utf8');
    const header  = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(10, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(0, 18);
    header.writeUInt32LE(0, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    partes.push(header, nameBuf);
  }
  return Buffer.concat(partes);
}

function formularioConArchivo(archivo: File): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('canalRespuesta', 'CORREO');
  f.append('nombre', 'Juan Perez Prueba');
  f.append('email', 'juan.prueba@example.com');
  f.append('telefono', '3001234567');
  f.append('direccion', 'Calle 1 # 2-3');
  f.append('descripcion', 'Solicito informacion sobre el tramite de certificados de residencia.');
  f.append('archivos', archivo);
  return f;
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
});

describe('radicación ciudadana — anexos Office (PPTX) admitidos', () => {
  it('un PPTX con firma binaria válida pasa la validación de tipo y magic-bytes (llega a persistencia)', async () => {
    const archivo = new File([new Uint8Array(buildPptxValido())], 'presentacion.pptx', { type: PPTX_MIME });
    const req = new Request('http://test/api/radicacion', { method: 'POST', body: formularioConArchivo(archivo) });
    const response = await POST(req);
    const body = await response.json();

    // 500 (no 400): la persistencia falla a propósito, pero eso solo ocurre
    // si el archivo YA pasó ALLOWED_FILE_TYPES y verificarMagicBytes.
    expect(response.status).toBe(500);
    expect(body.errores?.[0]).not.toMatch(/debe ser PDF|firma válida/);
  });
});

describe('radicación ciudadana — formatos Office antiguos (OLE) rechazados', () => {
  it('rechaza un adjunto .doc (application/msword) en la validación de tipo, antes de tocar Storage/DB', async () => {
    const oleBuffer = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0x00, 0x00]);
    const archivo = new File([new Uint8Array(oleBuffer)], 'memorial.doc', { type: DOC_OLE_MIME });
    const req = new Request('http://test/api/radicacion', { method: 'POST', body: formularioConArchivo(archivo) });
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errores.some((e: string) => e.includes('memorial.doc'))).toBe(true);
    expect(body.errores.some((e: string) => e.includes('PPTX'))).toBe(true);
  });
});
