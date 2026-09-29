/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RolInterno } from '@/lib/hooks/useAuth';
import type { SoportesPendientesInput } from '@/lib/recepcion/contingencia-storage';

let rol: RolInterno | 'SIN_SESION';
let proyecto: string;
// unknown es intencional en el doble de Firestore: cada colección almacena su propio modelo.
let persistidos: Map<string, unknown>;
let fallaEvento: boolean;
let cola: Promise<void>;
const storageSpy = vi.fn();
const txSpy = vi.fn();
const contadorPath = 'counters/radicados-2026';
const soportes: SoportesPendientesInput = {
  descripcion: 'Solicitud y soporte sintéticos bajo custodia.', cantidad: 2,
  custodiaTipo: 'FISICA_EN_VENTANILLA', custodiaReferencia: 'Archivador sintético de pruebas A', confirmacionCustodia: true,
};

vi.mock('@/lib/server/internal-auth', () => {
  class InternalAuthError extends Error { status = 401; }
  return {
    InternalAuthError,
    requireActiveInternalUser: async () => {
      if (rol === 'SIN_SESION') throw new InternalAuthError('No autorizado.');
      return { uid: 'recepcion-sintetica', nombre: 'Recepción sintética', rol, tenantId: 'VENTANILLA_UNICA', activo: true };
    },
  };
});
vi.mock('@/lib/ai/rate-limit', () => ({ checkRateLimit: () => null }));
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));
vi.mock('@/lib/observabilidad/eventos-negocio', () => ({ registrarEventoNegocio: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({
  getFirebaseAdminApp: () => ({ options: { projectId: proyecto } }),
  getFirebaseAdminDb: () => ({
    get projectId() { return proyecto; },
    doc: (path: string) => ({ path, id: path.split('/').pop() }),
    runTransaction: async (cb: (tx: object) => Promise<unknown>) => {
      txSpy();
      const anterior = cola;
      let liberar: () => void = () => {};
      cola = new Promise<void>((resolve) => { liberar = resolve; });
      await anterior;
      try {
        const copia = new Map(persistidos);
        const tx = {
          get: async ({ path }: { path: string }) => ({ exists: copia.has(path), data: () => copia.get(path) }),
          create: ({ path }: { path: string }, data: unknown) => {
            if (copia.has(path)) throw new Error('ALREADY_EXISTS');
            if (fallaEvento && path.endsWith('_ADJUNTOS_PENDIENTES_STORAGE')) throw new Error('Falla de trazabilidad');
            copia.set(path, data);
          },
          set: ({ path }: { path: string }, data: unknown) => copia.set(path, data),
        };
        const resultado = await cb(tx);
        persistidos = copia;
        return resultado;
      } finally { liberar(); }
    },
  }),
  getFirebaseAdminStorage: () => { storageSpy(); throw new Error('Storage no debe tocarse en contingencia.'); },
}));

import { POST } from '@/app/api/radicacion/interna/route';

function formulario(): FormData {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    tipoSolicitudId: 'PETICION_GENERAL', tipoPresentacion: 'IDENTIFICADA', tipoPersona: 'NATURAL',
    tipoDocumento: 'CC', medioRecepcion: 'PRESENCIAL', nombreCompleto: 'Persona Sintética',
    numeroDocumento: 'TEST-000', asunto: 'Prueba controlada local', descripcion: 'Registro sintético sin datos de ciudadanos.',
    soportesPendientes: JSON.stringify(soportes),
  })) f.set(key, value);
  return f;
}
function llamar(f = formulario()) { return POST(new Request('http://local/api/radicacion/interna', { method: 'POST', body: f })); }

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T15:00:00Z'));
  rol = 'RECEPCIONISTA'; proyecto = 'proyecto-local-ficticio'; fallaEvento = false; cola = Promise.resolve();
  persistidos = new Map([[contadorPath, { ultimo: 40 }]]);
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('contingencia activa: autenticación, custodia y transacción sin Storage', () => {
  it.each(['SIN_SESION', 'FUNCIONARIO', 'JEFE_DEPENDENCIA', 'CONTROL_INTERNO'] as const)('rechaza %s sin consumir contador', async (noPermitido) => {
    rol = noPermitido;
    expect((await llamar()).status).toBe(noPermitido === 'SIN_SESION' ? 401 : 403);
    expect(txSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled();
  });
  it.each(['ADMIN', 'RECEPCIONISTA'] as const)('admite %s y registra custodia y dos auditorías atómicamente', async (permitido) => {
    rol = permitido;
    const f = formulario();
    f.set('gestionAdjuntos', JSON.stringify({ estado: 'COMPLETO' }));
    f.set('soportesPendientes', JSON.stringify({ ...soportes, registradoPor: { uid: 'forjado' }, estado: 'COMPLETO' }));
    const res = await llamar(f); const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.estadoAdjuntos).toBe('PENDIENTE_STORAGE'); expect(body.archivosSubidos).toBe(0);
    expect(body.consecutivo).toBe(41); expect(body.fechaRadicado).toBe('2026-09-29T15:00:00.000Z');
    expect(persistidos.get(`ventanilla_radicados/${body.radicadoId}`)).toMatchObject({
      archivos: [], gestionAdjuntos: { estado: 'PENDIENTE_STORAGE', soportesPendientes: soportes, registradoPor: { uid: 'recepcion-sintetica' } },
    });
    expect([...persistidos.keys()].filter((p) => p.includes('/trazabilidad/'))).toHaveLength(2);
    expect(persistidos.get(contadorPath)).toMatchObject({ ultimo: 41 });
    expect(storageSpy).not.toHaveBeenCalled();
  });
  it.each([['archivos', 'pdf'], ['campo-forjado', 'pdf'], ['archivos', '']] as const)('rechaza blob %s incluso vacío antes de reservar', async (campo, contenido) => {
    const f = formulario(); f.set(campo, new File([contenido], 'sintetico.pdf', { type: 'application/pdf' }));
    const res = await llamar(f);
    expect(res.status).toBe(400); expect((await res.json()).error).toContain('No se consumió');
    expect(txSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled();
    expect(persistidos.get(contadorPath)).toEqual({ ultimo: 40 });
  });
  it.each([
    '', '[]', '{}', JSON.stringify({ ...soportes, cantidad: 0 }),
    JSON.stringify({ ...soportes, cantidad: 1.5 }), JSON.stringify({ ...soportes, confirmacionCustodia: 'true' }),
    JSON.stringify({ ...soportes, descripcion: 'breve' }), JSON.stringify({ ...soportes, custodiaTipo: 'FUERA' }),
    JSON.stringify({ ...soportes, custodiaReferencia: '' }),
  ])('no admite inventario inválido (%#)', async (raw) => {
    const f = formulario(); f.set('soportesPendientes', raw);
    expect((await llamar(f)).status).toBe(400); expect(txSpy).not.toHaveBeenCalled(); expect(storageSpy).not.toHaveBeenCalled();
  });
  it('fallo del evento pendiente revierte contador, reserva y radicado', async () => {
    fallaEvento = true;
    expect((await llamar()).status).toBe(500);
    expect([...persistidos.entries()]).toEqual([[contadorPath, { ultimo: 40 }]]);
  });
  it('Production sin apertura formal devuelve503, no emite28 (SDK simulado)', async () => {
    proyecto = 'ventanilla-unica-f31b1'; persistidos.set(contadorPath, { ultimo: 27 });
    expect((await llamar()).status).toBe(503);
    expect([...persistidos.entries()]).toEqual([[contadorPath, { ultimo: 27 }]]);
  });
  it('proyecto Admin sin identidad verificable falla cerrado antes de cualquier tx', async () => {
    proyecto = '';
    expect((await llamar()).status).toBe(503); expect(txSpy).not.toHaveBeenCalled();
    expect([...persistidos.entries()]).toEqual([[contadorPath, { ultimo: 40 }]]);
  });
  it('primera emisión fuera de septiembre se detiene sin antedatar ni consumir1745 (SDK simulado)', async () => {
    proyecto = 'ventanilla-unica-f31b1';
    vi.setSystemTime(new Date('2026-10-01T05:00:00Z'));
    persistidos.set(contadorPath, { ultimo: 1744, apertura: { abiertoEn: 1745, autorizadoPor: 'Autorización sintética local', referencia: 'acta-sintetica.md' } });
    const antes = [...persistidos.entries()];
    const res = await llamar();
    expect(res.status).toBe(503); expect((await res.json()).error).toContain('Cambió el período');
    expect([...persistidos.entries()]).toEqual(antes); expect(storageSpy).not.toHaveBeenCalled();
  });
  it('concurrencia no duplica número ni eventos (solo memoria local)', async () => {
    const respuestas = await Promise.all([llamar(), llamar()]);
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    const bodies = await Promise.all(respuestas.map((r) => r.json()));
    expect(bodies.map((b) => b.consecutivo)).toEqual([41, 42]);
    expect([...persistidos.keys()].filter((p) => p.startsWith('unicidad_radicados/'))).toHaveLength(2);
    expect([...persistidos.keys()].filter((p) => p.includes('/trazabilidad/'))).toHaveLength(4);
  });
  it('reserva existente falla cerrado sin sobrescribir ni avanzar', async () => {
    persistidos.set('unicidad_radicados/1-110-202609-00000041', { serie: 'radicados', consecutivo: 41 });
    const antes = [...persistidos.entries()];
    expect((await llamar()).status).toBe(500); expect([...persistidos.entries()]).toEqual(antes);
  });
});
