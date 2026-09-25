/**
 * Pieza angular (P2.1, Fase 2) — anti-forja de estado en
 * `app/api/radicacion/interna`.
 *
 * El blueprint (§Reimplementación de autorización) exige que el endpoint
 * NUNCA lea del body ningún campo de ESTADO: `estadoActual`, `consecutivo`,
 * `radicadoId`, `tenantId`, `esAnonimo`, `identidadReservada`,
 * `cumplioTermino`, `control.*`, `ultimaActualizacion`. El código fuente ya
 * demuestra por inspección que ninguno de esos nombres se lee de
 * `formData` — esta prueba lo demuestra por COMPORTAMIENTO: un atacante que
 * conserve un token válido (rol ADMIN/RECEPCIONISTA) y agregue esos campos
 * al body NO puede alterar el documento final. El servidor reconstruye el
 * documento entero a partir de datos ya validados + identificadores ya
 * asignados por `consecutivo-legal`.
 *
 * Maneja el handler POST real; solo mockea la frontera Admin SDK.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
      uid: 'u1', nombre: 'Recepción', rol: 'ADMIN', tenantId: 'VENTANILLA_UNICA', activo: true,
    })),
  };
});

vi.mock('@/lib/logger', () => ({ logError: () => {} }));

const YEAR = new Date().getFullYear();
const COUNTER = `counters/radicados-${YEAR}`;

let contadores: Record<string, number>;
let persistidos: Map<string, Record<string, unknown>>;

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
    bucket: () => ({ file: () => ({ save: async () => {}, move: async () => {} }) }),
  }),
}));

import { POST } from '@/app/api/radicacion/interna/route';

/** Formulario LEGÍTIMO al que se le agregan campos de ESTADO hostiles que
 *  el endpoint jamás debería leer. `tipoPresentacion: IDENTIFICADA` para
 *  que `esAnonimo`/`identidadReservada` derivados deban dar `false` — si
 *  el servidor leyera los campos forjados (`identidadReservada: true`),
 *  la aserción de abajo lo delataría. */
function formularioConForjaDeEstado(): FormData {
  const f = new FormData();
  f.append('tipoSolicitudId', 'PETICION_GENERAL');
  f.append('tipoPresentacion', 'IDENTIFICADA');
  f.append('tipoPersona', 'NATURAL');
  f.append('tipoDocumento', 'CC');
  f.append('medioRecepcion', 'PRESENCIAL');
  f.append('nombreCompleto', 'Sofia Delgado');
  f.append('numeroDocumento', '1099887766');
  f.append('asunto', 'Solicitud legítima con intento de forja adjunto');
  f.append('descripcion', 'El body intenta inyectar campos de estado prohibidos.');

  // ── Campos de ESTADO que el endpoint NUNCA debe leer ──
  f.append('estadoActual', 'CERRADO');
  f.append('consecutivo', '99999');
  f.append('radicadoId', '1-110-000000-FORJADO');
  f.append('tenantId', 'TENANT_AJENO_INEXISTENTE');
  f.append('esAnonimo', 'true');
  f.append('identidadReservada', 'true');
  f.append('cumplioTermino', 'true');
  f.append('ultimaActualizacion', '2000-01-01T00:00:00.000Z');
  f.append('control', '{"consecutivo":99999,"radicadoId":"FORJADO"}');
  f.append('consultaTokenHash', 'hash-forjado');
  f.append('prorrogasAplicadas', '99');

  return f;
}

beforeEach(() => {
  contadores = { [COUNTER]: 40 };
  persistidos = new Map();
});

describe('api/radicacion/interna — anti-forja de estado (body hostil ⇒ ignorado)', () => {
  it('el documento final SOLO contiene valores derivados server-side, nunca los forjados en el body', async () => {
    const req = new Request('http://test/api/radicacion/interna', {
      method: 'POST',
      body: formularioConForjaDeEstado(),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const radicadoPath = [...persistidos.keys()].find(
      (k) => k.startsWith('ventanilla_radicados/') && !k.includes('/trazabilidad/'),
    );
    expect(radicadoPath).toBeTruthy();
    const radicado = persistidos.get(radicadoPath!)!;

    // El id real proviene del consecutivo (contador 40 → 41), NUNCA del
    // 'radicadoId' forjado en el body.
    expect(radicadoPath).toBe(`ventanilla_radicados/${radicado.radicadoId}`);
    expect(radicado.radicadoId).not.toBe('1-110-000000-FORJADO');
    expect(String(radicado.radicadoId)).toMatch(/^1-110-\d{6}-\d{8}$/);

    // Estado siempre PENDIENTE al nacer — el 'CERRADO' forjado se ignora.
    expect(radicado.estadoActual).toBe('PENDIENTE');

    // Consecutivo real = contador+1 (41), NUNCA el 99999 forjado.
    expect((radicado.control as Record<string, unknown>).consecutivo).toBe(41);
    expect(contadores[COUNTER]).toBe(41);

    // esAnonimo/identidadReservada se DERIVAN de tipoPresentacion
    // (IDENTIFICADA ⇒ ambos false), pese a que el body forjó 'true'.
    expect(radicado.esAnonimo).toBe(false);
    expect(radicado.identidadReservada).toBe(false);

    // cumplioTermino: la ruta interna NUNCA lo fija (solo la pública lo
    // asigna null explícito) — la clave debe estar AUSENTE, no en 'true'.
    expect(Object.prototype.hasOwnProperty.call(radicado, 'cumplioTermino')).toBe(false);

    // consultaTokenHash: exclusivo de la superficie pública — ausente aquí
    // pese al hash forjado en el body.
    expect(Object.prototype.hasOwnProperty.call(radicado, 'consultaTokenHash')).toBe(false);

    // No existe ningún campo `tenantId` de nivel superior en el documento:
    // el único campo de enrutamiento es clasificacion.oficinaDestino, que
    // viene validado contra el catálogo, no el 'TENANT_AJENO_INEXISTENTE'
    // forjado (que ni siquiera se leyó — no se envió `oficinaDestino`).
    expect(Object.prototype.hasOwnProperty.call(radicado, 'tenantId')).toBe(false);
    expect((radicado.clasificacion as Record<string, unknown>).oficinaDestino).toBe('VENTANILLA_UNICA');

    // ultimaActualizacion la fija el servidor con el reloj `ahora`, no el
    // '2000-01-01' forjado.
    expect(radicado.ultimaActualizacion).not.toBe('2000-01-01T00:00:00.000Z');

    // prorrogasAplicadas nace en 0 (constructor), nunca el 99 forjado.
    expect((radicado.termino as Record<string, unknown>).prorrogasAplicadas).toBe(0);
  });

  it('oficinaDestino fuera del catálogo institucional ⇒ 400 (no enruta a un tenant inventado)', async () => {
    const f = formularioConForjaDeEstado();
    f.append('oficinaDestino', 'TENANT_QUE_NO_EXISTE');
    const req = new Request('http://test/api/radicacion/interna', { method: 'POST', body: f });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(persistidos.size).toBe(0);
    expect(contadores[COUNTER]).toBe(40);
  });
});
