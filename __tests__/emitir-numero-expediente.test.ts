import { describe, expect, it, vi } from 'vitest';
import type { Transaction, Firestore } from 'firebase-admin/firestore';
import {
  emitirNumeroExpedienteReal,
  verificarColisionNumeroExpediente,
} from '@/lib/server/emitir-numero-expediente';

/* PASO 5 (Fase 2 arranque) — emisión de número de expediente + reserva de unicidad. */

const CODIGOS = { codigoDane: '68745', codigoCuraduria: '0' };
const TENANT = 'SEC_PLANEACION' as const;

/** Doble de Firestore: `doc(path)` devuelve una ref con su path como id. */
function fakeDb(existentes: Set<string> = new Set()): Firestore {
  return {
    doc: (path: string) => ({ path, id: path.split('/').pop() }),
    // Usado solo por verificarColisionNumeroExpediente (lectura directa, sin tx).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } as unknown as Firestore;
}

/**
 * Doble de Transaction con `get`/`set`/`create`. `existentes` simula qué
 * paths YA existen en Firestore — `create` lanza para esos (mismo efecto
 * observable que el commit-time failure real de `tx.create` en un
 * documento existente; para un doble unitario, sincronizarlo así es
 * suficiente y no requiere emular el ciclo de vida completo de la tx).
 */
function fakeTx(contadores: Record<string, number | undefined>, existentes: Set<string> = new Set()) {
  const escrituras: { tipo: 'set' | 'create'; path: string; data: Record<string, unknown> }[] = [];
  const tx = {
    get: vi.fn(async (ref: { path: string }) => {
      const ultimo = contadores[ref.path];
      return { data: () => (ultimo === undefined ? undefined : { ultimo }) };
    }),
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      escrituras.push({ tipo: 'set', path: ref.path, data });
    }),
    create: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      if (existentes.has(ref.path)) {
        throw new Error(`ALREADY_EXISTS: ${ref.path}`);
      }
      escrituras.push({ tipo: 'create', path: ref.path, data });
    }),
  };
  return { tx: tx as unknown as Transaction, escrituras };
}

describe('emitirNumeroExpedienteReal — flujo feliz', () => {
  it('counter inexistente (→ consecutivo 1): reserva unicidad Y confirma el contador, en orden', async () => {
    const FECHA = new Date(2026, 0, 15, 12, 0, 0, 0);
    const doble = fakeTx({});
    const resultado = await emitirNumeroExpedienteReal({
      tx: doble.tx, db: fakeDb(), fecha: FECHA, tenantId: TENANT, codigos: CODIGOS, expedienteId: 'exp-sintetico-001',
    });

    expect(resultado.numeroExpediente).toBe('68745-0-26-0001');
    expect(resultado.consecutivo).toBe(1);

    // Orden: primero create (reserva), luego set (confirma el contador).
    // `expedienteId` es el id SINTÉTICO del caller (puntero inverso), NUNCA
    // el número formateado (hallazgo firestore-datos 7-ago-2026). `creadoEn`
    // es el instante real de la reserva, no la fecha ancla.
    expect(doble.escrituras).toHaveLength(2);
    const [reserva, confirmacion] = doble.escrituras;
    expect(reserva.tipo).toBe('create');
    expect(reserva.path).toBe('unicidad_expedientes/68745-0-26-0001');
    expect(reserva.data.expedienteId).toBe('exp-sintetico-001');
    expect(reserva.data.tenantId).toBe(TENANT);
    expect(typeof reserva.data.creadoEn).toBe('string');
    expect(confirmacion).toEqual({ tipo: 'set', path: 'counters/expedientes-2026', data: { ultimo: 1, anio: 2026, actualizadoEn: FECHA.toISOString() } });
  });

  it('counter sembrado en 19: numeroExpediente="68745-0-26-0020" y counter avanza a 20', async () => {
    const FECHA = new Date(2026, 5, 1, 12, 0, 0, 0);
    const doble = fakeTx({ 'counters/expedientes-2026': 19 });
    const resultado = await emitirNumeroExpedienteReal({
      tx: doble.tx, db: fakeDb(), fecha: FECHA, tenantId: TENANT, codigos: CODIGOS, expedienteId: 'exp-sintetico-020',
    });
    expect(resultado.numeroExpediente).toBe('68745-0-26-0020');
    expect(doble.escrituras.find((e) => e.tipo === 'set')).toEqual({
      tipo: 'set', path: 'counters/expedientes-2026', data: { ultimo: 20, anio: 2026, actualizadoEn: FECHA.toISOString() },
    });
  });
});

describe('emitirNumeroExpedienteReal — colisión de unicidad aborta TODO (ni reserva ni counter)', () => {
  it('si el número YA está reservado, tx.create lanza y confirmarConsecutivosLegales NUNCA se ejecuta (el counter no avanza)', async () => {
    const FECHA = new Date(2026, 0, 15, 12, 0, 0, 0);
    const existentes = new Set(['unicidad_expedientes/68745-0-26-0001']);
    const doble = fakeTx({}, existentes);

    await expect(
      emitirNumeroExpedienteReal({ tx: doble.tx, db: fakeDb(), fecha: FECHA, tenantId: TENANT, codigos: CODIGOS, expedienteId: 'exp-sintetico-col' }),
    ).rejects.toThrow(/ALREADY_EXISTS/);

    // NINGÚN set (confirmarConsecutivosLegales nunca corrió): el counter no avanzó.
    expect(doble.escrituras.filter((e) => e.tipo === 'set')).toHaveLength(0);
  });
});

describe('verificarColisionNumeroExpediente — read-only, para Fase 5', () => {
  it('devuelve true si el número ya está reservado', async () => {
    const db = {
      doc: (path: string) => ({
        path,
        get: async () => ({ exists: path === 'unicidad_expedientes/68745-0-26-0001' }),
      }),
    } as unknown as Firestore;
    expect(await verificarColisionNumeroExpediente(db, '68745-0-26-0001')).toBe(true);
    expect(await verificarColisionNumeroExpediente(db, '68745-0-26-9999')).toBe(false);
  });
});
