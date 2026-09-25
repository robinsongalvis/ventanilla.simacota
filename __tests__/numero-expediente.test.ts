import { describe, expect, it, vi } from 'vitest';
import type { Transaction, Firestore } from 'firebase-admin/firestore';
import { formatearNumeroExpediente } from '@/lib/motor-expedientes/numero-expediente';
import {
  leerConsecutivosLegales,
  confirmarConsecutivosLegales,
} from '@/lib/server/consecutivo-legal';

/* PASO 4 (Fase 2 arranque) — formateador puro de número de expediente. */

const CODIGOS = { codigoDane: '68745', codigoCuraduria: '0' };

describe('formatearNumeroExpediente — padding y forma', () => {
  it('consecutivo=1 → padding a 4 dígitos', () => {
    expect(formatearNumeroExpediente(1, new Date(2026, 0, 1), CODIGOS)).toBe('68745-0-26-0001');
  });

  it('consecutivo=9999 → sin recorte', () => {
    expect(formatearNumeroExpediente(9999, new Date(2026, 0, 1), CODIGOS)).toBe('68745-0-26-9999');
  });

  it('consecutivo=10000 → crece más allá de 4 dígitos sin truncar', () => {
    expect(formatearNumeroExpediente(10000, new Date(2026, 0, 1), CODIGOS)).toBe('68745-0-26-10000');
  });

  it('cambio de año: 2027 → AA=27', () => {
    expect(formatearNumeroExpediente(5, new Date(2027, 5, 1), CODIGOS)).toBe('68745-0-27-0005');
  });

  it('rechaza consecutivo no entero o <= 0', () => {
    expect(() => formatearNumeroExpediente(0, new Date(), CODIGOS)).toThrow(/consecutivo inválido/);
    expect(() => formatearNumeroExpediente(-1, new Date(), CODIGOS)).toThrow(/consecutivo inválido/);
    expect(() => formatearNumeroExpediente(1.5, new Date(), CODIGOS)).toThrow(/consecutivo inválido/);
  });

  it('rechaza códigos vacíos (fail-closed)', () => {
    expect(() => formatearNumeroExpediente(1, new Date(), { codigoDane: '', codigoCuraduria: '0' })).toThrow(/codigoDane/);
    expect(() => formatearNumeroExpediente(1, new Date(), { codigoDane: '68745', codigoCuraduria: '' })).toThrow(/codigoDane/);
  });
});

describe('formatearNumeroExpediente — caso counter sembrado (primer camino real de prod tras R10)', () => {
  it('ultimoActual=19 → consecutivo=20 → "68745-0-26-0020"', () => {
    const numero = formatearNumeroExpediente(20, new Date(2026, 0, 1), CODIGOS);
    expect(numero).toBe('68745-0-26-0020');
  });
});

/* ── Harness de dobles (mismo patrón que __tests__/consecutivo-legal.test.ts) ── */

function fakeDb(): Firestore {
  return { doc: (path: string) => ({ path, id: path.split('/').pop() }) } as unknown as Firestore;
}
function fakeTx(contadores: Record<string, number | undefined>) {
  const escrituras: { path: string; data: Record<string, unknown> }[] = [];
  const reservas: string[] = [];
  const tx = {
    // Reserva de unicidad: mismo doble, semántica real (falla si ya existe).
    create: vi.fn((ref: { path: string }) => {
      if (reservas.includes(ref.path)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
      reservas.push(ref.path);
    }),
    get: vi.fn(async (ref: { path: string }) => {
      const ultimo = contadores[ref.path];
      return { data: () => (ultimo === undefined ? undefined : { ultimo }) };
    }),
    set: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      escrituras.push({ path: ref.path, data });
    }),
  };
  return { tx: tx as unknown as Transaction, escrituras, reservas };
}

describe('flujo real: leerConsecutivosLegales + formatearNumeroExpediente sobre counter sembrado', () => {
  it('counters/expedientes-2026 sembrado en 19 → documentoId formateado "68745-0-26-0020" y counter avanza a 20', async () => {
    const FECHA = new Date(2026, 0, 15, 12, 0, 0, 0);
    const doble = fakeTx({ 'counters/expedientes-2026': 19 });
    const pendientes = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      {
        serie: 'expedientes',
        formatear: (consecutivo, fecha) => formatearNumeroExpediente(consecutivo, fecha, CODIGOS),
      },
    ]);
    expect(pendientes[0].consecutivo).toBe(20);
    expect(pendientes[0].documentoId).toBe('68745-0-26-0020');

    confirmarConsecutivosLegales(doble.tx, FECHA, pendientes);
    expect(doble.escrituras).toEqual([
      { path: 'counters/expedientes-2026', data: { ultimo: 20, anio: 2026, actualizadoEn: FECHA.toISOString() } },
    ]);
  });

  it('serie "expedientes" con origen RECONSTRUIDO → confirmar lanza el guard D9 y NO avanza el counter', async () => {
    const FECHA = new Date(2026, 0, 15, 12, 0, 0, 0);
    const doble = fakeTx({ 'counters/expedientes-2026': 19 });
    const pendientes = await leerConsecutivosLegales(doble.tx, fakeDb(), FECHA, [
      {
        serie: 'expedientes',
        formatear: (consecutivo, fecha) => formatearNumeroExpediente(consecutivo, fecha, CODIGOS),
        origen: 'RECONSTRUIDO',
      },
    ]);
    expect(() => confirmarConsecutivosLegales(doble.tx, FECHA, pendientes)).toThrow(/RECONSTRUIDO/);
    expect(doble.escrituras).toHaveLength(0);
  });
});
