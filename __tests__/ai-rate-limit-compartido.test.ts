import { describe, expect, it } from 'vitest';
import {
  aplicarRateLimitIA,
  verificarRateLimitIA,
  RateLimitIAMemoria,
  REGLAS_IA,
} from '@/lib/ai/rate-limit-compartido';

/* ══════════════════════════════════════════════════════════════
   C-1 · Rate limit compartido de IA (Firestore + fallback memoria).

   `ahora` fijo para tests deterministas.
══════════════════════════════════════════════════════════════ */

const T0 = 1_000_000;
const REGLA = { max: 3, windowMs: 60_000 };

/* ── Doble de Firestore mínimo: guarda docs en un Map y ejecuta la
      transacción de forma síncrona sobre él. ── */
function fakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  const docRef = (id: string) => ({
    id,
    get: async () => ({ data: () => store.get(id) }),
  });
  return {
    _store: store,
    collection: () => ({ doc: (id: string) => docRef(id) }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (ref: { id: string }) => ({ data: () => store.get(ref.id) }),
      set: (ref: { id: string }, data: Record<string, unknown>) => { store.set(ref.id, data); },
    }),
  };
}

describe('C-1 — RateLimitIAMemoria (fallback)', () => {
  /* 1 · deja pasar hasta el máximo, luego bloquea */
  it('permite max peticiones y bloquea la siguiente', () => {
    const rl = new RateLimitIAMemoria();
    for (let i = 0; i < REGLA.max; i++) {
      expect(rl.verificar('chat', 'ipA', REGLA, T0).bloqueado).toBe(false);
    }
    const bloqueado = rl.verificar('chat', 'ipA', REGLA, T0);
    expect(bloqueado.bloqueado).toBe(true);
    expect(bloqueado.retryAfterSeconds).toBeGreaterThan(0);
  });

  /* 2 · la ventana se reinicia al vencer */
  it('reinicia el contador tras la ventana', () => {
    const rl = new RateLimitIAMemoria();
    for (let i = 0; i < REGLA.max; i++) rl.verificar('chat', 'ipA', REGLA, T0);
    expect(rl.verificar('chat', 'ipA', REGLA, T0).bloqueado).toBe(true);
    // Pasada la ventana, vuelve a permitir.
    expect(rl.verificar('chat', 'ipA', REGLA, T0 + 60_001).bloqueado).toBe(false);
  });

  /* 3 · claves e IPs distintas no se pisan */
  it('separa contadores por clave e IP', () => {
    const rl = new RateLimitIAMemoria();
    for (let i = 0; i < REGLA.max; i++) rl.verificar('chat', 'ipA', REGLA, T0);
    expect(rl.verificar('chat', 'ipA', REGLA, T0).bloqueado).toBe(true);
    expect(rl.verificar('chat', 'ipB', REGLA, T0).bloqueado).toBe(false);      // otra IP
    expect(rl.verificar('scan-doc', 'ipA', REGLA, T0).bloqueado).toBe(false);  // otra clave
  });
});

describe('C-1 — aplicarRateLimitIA (Firestore compartido)', () => {
  /* 4 · el contador es compartido: bloquea al superar el máximo */
  it('cuenta en el doc compartido y bloquea al llegar al máximo', async () => {
    const db = fakeDb();
    for (let i = 0; i < REGLA.max; i++) {
      const r = await aplicarRateLimitIA({ db: db as never, clave: 'chat', ipHash: 'h1', regla: REGLA, now: T0 });
      expect(r.bloqueado).toBe(false);
    }
    const r = await aplicarRateLimitIA({ db: db as never, clave: 'chat', ipHash: 'h1', regla: REGLA, now: T0 });
    expect(r.bloqueado).toBe(true);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    // Persistió con TTL para limpieza.
    const doc = db._store.get('ai_chat_h1');
    expect(doc?.expiresAt).toBeInstanceOf(Date);
  });

  /* 5 · verificarRateLimitIA cae a memoria si Firestore lanza */
  it('cae al limitador de memoria cuando Firestore falla', async () => {
    const dbRoto = { runTransaction: async () => { throw new Error('firestore caído'); }, collection: () => ({ doc: () => ({}) }) };
    const r = await verificarRateLimitIA({ db: dbRoto as never, clave: 'chat', ipHash: 'hFallback', regla: REGLA, now: T0 });
    expect(r.bloqueado).toBe(false); // primera petición: memoria la deja pasar
  });
});

describe('C-1 — reglas por endpoint', () => {
  /* 6 · scan-doc (visión) es más estricto que chat */
  it('scan-doc tiene un tope menor o igual que chat', () => {
    expect(REGLAS_IA['scan-doc'].max).toBeLessThanOrEqual(REGLAS_IA.chat.max);
    expect(REGLAS_IA.chat.windowMs).toBe(60_000);
  });
});
