/**
 * @vitest-environment node
 *
 * Pieza angular (P2.1, Fase 2) — H-08 replicado server-side en la ruta
 * nueva: el `Content-Type` y la extensión que declara el cliente son
 * falsificables; el endpoint debe verificar la firma binaria REAL del
 * archivo (`verificarMagicBytes`) antes de aceptar el adjunto, igual que
 * `api/radicacion` y `salidas/registrar`.
 *
 * `@vitest-environment node`: el entorno global del proyecto es `jsdom`
 * (vitest.config.mts), cuyo `File` es de un realm distinto al `File` que
 * espera el `formData()` de `Request` en Node — mismo ajuste que
 * `radicacion-anexos-office.test.ts`.
 *
 * Maneja el handler POST real; solo mockea la frontera Admin SDK.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/server/internal-auth', () => {
  class InternalAuthError extends Error {
    status: 401 | 403;
    constructor(message: string, status: 401 | 403 = 401) {
      super(message);
      this.status = status;
    }
  }
  return {
    InternalAuthError,
    requireActiveInternalUser: vi.fn(async () => ({
      uid: 'u1', nombre: 'Recepción', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA', activo: true,
    })),
  };
});

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

let subidaInvocada = false;

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  collection: () => ({ add: async () => ({ id: 'trz' }) }),
  runTransaction: async () => { throw new Error('la tx no debe alcanzarse si magic-bytes rechaza'); },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: () => ({
        save: async () => { subidaInvocada = true; },
        move: async () => {},
      }),
    }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

function formularioBase(): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', 'Laura Gomez');
  f.append('numeroDocumento', '1098765432');
  f.append('asunto', 'Solicitud con adjunto falsificado');
  f.append('descripcion', 'El archivo declara PDF pero no tiene la firma real.');
  return f;
}

beforeEach(() => {
  subidaInvocada = false;
});

describe('api/radicacion/interna — magic-bytes (H-08)', () => {
  it('archivo con Content-Type falsificado (declara PDF, no tiene la firma) → 400, sin subir a staging', async () => {
    const f = formularioBase();
    // Texto plano disfrazado de PDF: el Content-Type miente, los bytes no
    // empiezan con la firma "%PDF-".
    const archivo = new File([new TextEncoder().encode('no soy un pdf real')], 'falso.pdf', {
      type: 'application/pdf',
    });
    f.append('archivos', archivo);

    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(subidaInvocada).toBe(false); // rechazado ANTES de tocar Storage
  });

  it('archivo con firma binaria válida (PDF real) → no lo rechaza magic-bytes', async () => {
    const f = formularioBase();
    const bytesPdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    const archivo = new File([bytesPdf], 'real.pdf', { type: 'application/pdf' });
    f.append('archivos', archivo);

    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    // La tx lanza a propósito (fakeDb) para aislar esta prueba de la
    // persistencia: lo que importa es que NO sea 400 por magic-bytes.
    expect(res.status).not.toBe(400);
  });

  it('tipo de archivo no permitido (.exe) → 400', async () => {
    const f = formularioBase();
    const archivo = new File([new Uint8Array([0x4d, 0x5a])], 'malware.exe', {
      type: 'application/x-msdownload',
    });
    f.append('archivos', archivo);

    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
