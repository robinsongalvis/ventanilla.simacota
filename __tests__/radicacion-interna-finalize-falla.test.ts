/**
 * @vitest-environment node
 *
 * Pieza angular (P2.1, Fase 2) — hallazgo QA (H2, revisión cruzada):
 * cubre la fila del blueprint "Integridad de adjunto: `move` de finalize
 * falla → radicado válido + adjunto en `_pendientes` + reconciliación
 * pendiente (N8)" — `app/api/radicacion/interna/route.ts:599-604`.
 *
 * El radicado YA es válido cuando se ejecuta el finalize (post-commit de
 * la tx): un fallo de `moverEnStorage` NO revierte ni invalida el
 * radicado — solo deja el adjunto pendiente en `_pendientes/**` (deuda
 * declarada N8, fuera de alcance de esta pieza) y se registra con
 * `logError({ modulo: 'radicacion-interna/finalize-adjunto' })`, nunca
 * rompe la respuesta al cliente (`.catch`, no `await` sin capturar).
 *
 * `@vitest-environment node`: ver nota en
 * `radicacion-interna-magic-bytes.test.ts` (File de otro realm en jsdom).
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

const logErrorSpy = vi.fn();
vi.mock('@/lib/logger', () => ({ logError: (args: unknown) => logErrorSpy(args) }));

const YEAR = new Date().getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

let contadores: Record<string, number>;
let persistidos: Map<string, Record<string, unknown>>;
/** Sustrings de la ruta de ORIGEN (`_pendientes/.../<filename>`) cuyo
 *  `move()` debe lanzar — simula el fallo del finalize para ese archivo. */
let rutasQueFallanEnMove: string[];
const movidosOk: string[] = [];

const fakeDb = {
  doc: (path: string) => ({ path, id: path.split('/').pop() }),
  runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { path: string; data: Record<string, unknown> }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => {
          const v = contadores[ref.path];
          return v === undefined ? undefined : { ultimo: v };
        },
      }),
      create: (ref: { path: string }, data: Record<string, unknown>) => buffer.push({ path: ref.path, data }),
      set: (ref: { path: string }, data: Record<string, unknown>) => buffer.push({ path: ref.path, data }),
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contadores[w.path] = (w.data as { ultimo: number }).ultimo;
      else persistidos.set(w.path, w.data);
    }
    return result;
  },
};

vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminDb: () => fakeDb,
  getFirebaseAdminStorage: () => ({
    bucket: () => ({
      file: (path: string) => ({
        save: async () => {}, // staging siempre sube bien en estos casos
        move: async (destino: string) => {
          if (rutasQueFallanEnMove.some((frag) => path.includes(frag))) {
            throw new Error(`fallo simulado de move: ${path} -> ${destino}`);
          }
          movidosOk.push(path);
        },
      }),
    }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

function archivoPdf(nombre: string): File {
  return new File([PDF_BYTES], nombre, { type: 'application/pdf' });
}

function formularioConAdjuntos(archivos: File[]): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', 'Marta Ruiz');
  f.append('numeroDocumento', '1098765432');
  f.append('asunto', 'Solicitud con adjunto cuyo finalize falla');
  f.append('descripcion', 'El move de storage falla tras confirmar la transacción.');
  for (const a of archivos) f.append('archivos', a);
  return f;
}

beforeEach(() => {
  process.env.FIREBASE_STORAGE_BUCKET = 'test-bucket.appspot.com';
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
  rutasQueFallanEnMove = [];
  movidosOk.length = 0;
  logErrorSpy.mockClear();
});

describe('api/radicacion/interna — integridad de adjunto: move de finalize falla (N8, hallazgo QA H2)', () => {
  it('1 adjunto, el move falla ⇒ 200 con radicadoId/consecutivo válidos; el radicado quedó escrito; logError capturó el fallo', async () => {
    rutasQueFallanEnMove = ['cedula.pdf'];
    const req = new Request('http://test/api/radicacion/interna', {
      method: 'POST',
      body: formularioConAdjuntos([archivoPdf('cedula.pdf')]),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.radicadoId).toMatch(/^1-110-\d{6}-\d{8}$/);
    expect(body.consecutivo).toBe(41);

    // El radicado (y su trazabilidad) YA estaban escritos por la tx — el
    // fallo de move es post-commit y NO lo revierte.
    const radicadoPath = [...persistidos.keys()].find(
      (k) => k.startsWith('ventanilla_radicados/') && !k.includes('/trazabilidad/'),
    );
    expect(radicadoPath).toBe(`ventanilla_radicados/${body.radicadoId}`);
    const trazId = [...persistidos.keys()].find((k) => k.endsWith('_RADICACION'));
    expect(trazId).toBeTruthy();

    // El fallo se registró con el módulo correcto — no rompió la respuesta.
    expect(logErrorSpy).toHaveBeenCalledTimes(1);
    expect(logErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        radicadoId: body.radicadoId,
        modulo: 'radicacion-interna/finalize-adjunto',
        error: expect.any(Error),
      }),
    );
    expect(movidosOk).toHaveLength(0);
  });

  it('caso mixto: 2 adjuntos, 1 move OK + 1 falla ⇒ 200; el exitoso se movió, el fallido quedó registrado sin romper nada', async () => {
    rutasQueFallanEnMove = ['recibo.pdf'];
    const req = new Request('http://test/api/radicacion/interna', {
      method: 'POST',
      body: formularioConAdjuntos([archivoPdf('cedula.pdf'), archivoPdf('recibo.pdf')]),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.archivosSubidos).toBe(2);

    // Solo el archivo SIN fallo llegó a moverse a su ruta final.
    expect(movidosOk).toHaveLength(1);
    expect(movidosOk[0]).toContain('cedula.pdf');

    // El fallo del otro archivo se capturó una única vez, con el módulo
    // correcto — la respuesta 200 y el radicado no se vieron afectados.
    expect(logErrorSpy).toHaveBeenCalledTimes(1);
    expect(logErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        radicadoId: body.radicadoId,
        modulo: 'radicacion-interna/finalize-adjunto',
        error: expect.any(Error),
      }),
    );
    const radicadoPath = [...persistidos.keys()].find(
      (k) => k.startsWith('ventanilla_radicados/') && !k.includes('/trazabilidad/'),
    );
    expect(radicadoPath).toBe(`ventanilla_radicados/${body.radicadoId}`);
  });
});
