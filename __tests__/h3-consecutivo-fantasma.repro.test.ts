/**
 * Bloque 2 (fix H3) · ruta INTERNA `radicarInstitucionalmente`
 * (lib/actions/radicarVentanilla.ts, SDK cliente). Control de regresión del
 * consecutivo fantasma originalmente reproducido en el Bloque 1.
 *
 * Fix mínimo client-side (Opción A): peek del contador (solo lectura) → subir
 * adjuntos → runTransaction del SDK cliente que confirma contador+documento
 * JUNTOS. Un fallo de subida ocurre ANTES de la transacción → el contador no se
 * consume → NO hay fantasma. Esta prueba PASA con el fix; se pone en rojo si el
 * contador vuelve a confirmarse antes de la persistencia (demostrado por
 * mutación). Maneja la orquestación real; solo mockea fronteras. No toca Firebase.
 *
 * Nota de alcance (Bloque 2): esto cierra H3 en la ruta interna. La migración
 * cliente→servidor y el cierre de N1/N3/N4 quedan diferidos al Bloque 3 (deuda
 * arquitectónica registrada) — la interna sigue en el cliente por ahora.
 */
import { describe, it, expect, vi } from 'vitest';

const contador = { ultimo: 40 };
const radicadosPersistidos = new Map<string, unknown>();

vi.mock('@/lib/radicado-institucional', () => ({
  formatearRadicadoInstitucional: (n: number, f: Date) =>
    `1-110-${f.getFullYear()}-${String(n).padStart(8, '0')}`,
}));

vi.mock('@/lib/storage', () => ({
  subirArchivos: vi.fn(async () => {
    // Escenario STAGE (FASE2_BITACORA.md): la subida falla. Con el fix, esto
    // ocurre ANTES de que el contador se confirme.
    throw new Error('fallo de red al subir adjunto');
  }),
}));

vi.mock('@/lib/firebase', () => ({ getDb: () => ({}) }));

function refFor(segs: string[]) {
  return { path: segs.join('/') };
}

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segs: string[]) => refFor(segs),
  collection: (_db: unknown, ...segs: string[]) => refFor(segs),
  getDoc: async (ref: { path: string }) => ({
    data: () => (ref.path.startsWith('counters/') ? { ultimo: contador.ultimo } : undefined),
  }),
  addDoc: async () => ({ id: 'trz' }),
  runTransaction: async (_db: unknown, cb: (tx: unknown) => Promise<unknown>) => {
    const buffer: { path: string; data: { ultimo?: number } }[] = [];
    const tx = {
      get: async (ref: { path: string }) => ({
        data: () => (ref.path.startsWith('counters/') ? { ultimo: contador.ultimo } : undefined),
      }),
      set: (ref: { path: string }, data: { ultimo?: number }) => {
        buffer.push({ path: ref.path, data });
      },
    };
    const result = await cb(tx);
    for (const w of buffer) {
      if (w.path.startsWith('counters/')) contador.ultimo = w.data.ultimo!;
      else radicadosPersistidos.set(w.path, w.data);
    }
    return result;
  },
}));

import {
  radicarInstitucionalmente,
  type DatosRadicacionInstitucional,
  type ActorRadicacion,
} from '@/lib/actions/radicarVentanilla';

const datos = {
  noAportaCorreo: false,
  archivos: [{} as unknown as File],
} as unknown as DatosRadicacionInstitucional;

const actor = {
  uid: 'u1',
  nombre: 'Recepción',
  tenantId: 'VENTANILLA_UNICA',
} as unknown as ActorRadicacion;

describe('H3 — ruta interna: consecutivo atómico (Bloque 2, Opción A)', () => {
  it('un fallo de subida NO debe dejar el consecutivo consumido sin documento', async () => {
    await expect(radicarInstitucionalmente(datos, actor)).rejects.toThrow('fallo de red');

    // El contador NO avanzó (la subida falló antes de la transacción).
    const avanzo = contador.ultimo > 40;
    const idEsperado = `1-110-${new Date().getFullYear()}-00000041`;
    const persistido = radicadosPersistidos.has(idEsperado);

    // Invariante no-huérfano: consecutivo consumido ⇒ documento existe.
    expect(avanzo && !persistido).toBe(false);
  });
});
