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
const auditoriaPath = 'admin_auditoria/audit-apertura-contingencia';
const FECHA_APERTURA = '2026-09-29T15:00:00.000Z';
const aperturaSintetica = {
  version: 1,
  estado: 'BLOQUEADA',
  serie: 'radicados',
  anio: 2026,
  veniaDe: 40,
  abiertoEn: 41,
  primerNumero: 41,
  ultimoInicial: 40,
  fecha: FECHA_APERTURA,
  fechaHoraBogota: '2026-09-29T10:00:00.000-05:00',
  autorizadoPor: 'Autorización sintética local',
  referencia: 'acta-sintetica.md',
  auditoriaId: 'audit-apertura-contingencia',
  actorUid: 'admin-apertura-sintetica',
  actorNombre: 'Administración sintética',
  actorRol: 'ADMIN',
  tenantId: 'VENTANILLA_UNICA',
} as const;
const auditoriaAperturaSintetica = {
  accion: 'APERTURA_SERIE_RADICADOS_CONFIRMADA',
  actorUid: aperturaSintetica.actorUid,
  actorNombre: aperturaSintetica.actorNombre,
  actorRol: aperturaSintetica.actorRol,
  tenantId: aperturaSintetica.tenantId,
  fecha: aperturaSintetica.fecha,
  fechaHoraBogota: aperturaSintetica.fechaHoraBogota,
  referencia: aperturaSintetica.referencia,
  metadata: {
    serie: 'radicados',
    anio: 2026,
    anterior: 40,
    primerNumero: 41,
    nuevoUltimo: 40,
    estado: 'BLOQUEADA',
    proximoRadicado: '1-110-202609-00000041',
  },
} as const;
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
          set: (
            { path }: { path: string },
            data: unknown,
            options?: { merge?: boolean },
          ) => {
            const actual = copia.get(path);
            if (
              options?.merge === true
              && actual !== null && typeof actual === 'object' && !Array.isArray(actual)
              && data !== null && typeof data === 'object' && !Array.isArray(data)
            ) {
              copia.set(path, { ...actual, ...data });
              return;
            }
            copia.set(path, data);
          },
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

function estadoSerieAbierta(): Map<string, unknown> {
  return new Map<string, unknown>([
    [contadorPath, { ultimo: 40, apertura: aperturaSintetica }],
    [auditoriaPath, auditoriaAperturaSintetica],
  ]);
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T15:00:00Z'));
  rol = 'RECEPCIONISTA'; proyecto = 'ventanilla-simacota-stage'; fallaEvento = false; cola = Promise.resolve();
  persistidos = estadoSerieAbierta();
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
    expect(persistidos.get(contadorPath)).toEqual({ ultimo: 40, apertura: aperturaSintetica });
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
    const antes = [...persistidos.entries()];
    expect((await llamar()).status).toBe(500);
    expect([...persistidos.entries()]).toEqual(antes);
  });
  it('Production sin apertura formal devuelve503, no emite28 (SDK simulado)', async () => {
    proyecto = 'ventanilla-unica-f31b1'; persistidos = new Map([[contadorPath, { ultimo: 27 }]]);
    expect((await llamar()).status).toBe(503);
    expect([...persistidos.entries()]).toEqual([[contadorPath, { ultimo: 27 }]]);
  });
  it('proyecto Admin sin identidad verificable falla cerrado antes de cualquier tx', async () => {
    proyecto = '';
    const antes = [...persistidos.entries()];
    expect((await llamar()).status).toBe(503); expect(txSpy).not.toHaveBeenCalled();
    expect([...persistidos.entries()]).toEqual(antes);
  });
  it('frontera mensual usa America/Bogota sin antedatar ni consumir un número real', async () => {
    vi.setSystemTime(new Date('2026-10-01T05:00:00Z'));
    const res = await llamar();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.consecutivo).toBe(41);
    expect(body.radicadoId).toBe('1-110-202610-00000041');
    expect(persistidos.get(contadorPath)).toMatchObject({ ultimo: 41, apertura: aperturaSintetica });
    expect(storageSpy).not.toHaveBeenCalled();
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
