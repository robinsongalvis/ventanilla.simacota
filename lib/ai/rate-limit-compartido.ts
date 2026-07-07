/**
 * Rate limit COMPARTIDO para los endpoints de IA (C-1 de la auditoría).
 *
 * El limitador en memoria (lib/ai/rate-limit.ts) no sirve en serverless:
 * cada instancia (lambda) tiene su propio Map y se reinicia con cada
 * cold start, así que el límite real es mucho más alto que el
 * configurado y se evade escalando peticiones. Como los endpoints de
 * IA son públicos y llaman a Gemini (API de pago), eso es un DoS de
 * costos.
 *
 * Este limitador cuenta sobre Firestore (colección `seguridad_rate_limits`,
 * la misma que usa la consulta pública) con una transacción por
 * petición, de modo que TODAS las instancias comparten el contador.
 * Si Firestore no responde, cae a un limitador en memoria — mejor un
 * freno débil que ninguno.
 *
 * Reutiliza el patrón probado de `rate-limit-consulta-publica.ts` sin
 * tocarlo (ese es crítico y estable); aquí solo se generaliza por clave.
 *
 * El endpoint pasa el `ipHash` ya calculado — este módulo no conoce
 * secretos.
 */

type FirestoreDb = FirebaseFirestore.Firestore;

export interface ReglaRateLimitIA {
  max:      number;
  windowMs: number;
}

export interface ResultadoRateLimitIA {
  bloqueado:          boolean;
  retryAfterSeconds?: number;
}

/** Sanea la clave para usarla como id de documento. */
function idSeguro(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, '').slice(0, 128) || 'anon';
}

function retryAfter(windowEndsAt: number, now: number): number {
  return Math.max(1, Math.ceil((windowEndsAt - now) / 1000));
}

/* ── Contador compartido en Firestore (transaccional) ── */
export async function aplicarRateLimitIA(params: {
  db:     FirestoreDb;
  clave:  string;   // 'chat' | 'classify' | 'scan-doc'
  ipHash: string;
  regla:  ReglaRateLimitIA;
  now?:   number;
}): Promise<ResultadoRateLimitIA> {
  const now = params.now ?? Date.now();
  const ref = params.db
    .collection('seguridad_rate_limits')
    .doc(`ai_${idSeguro(params.clave)}_${idSeguro(params.ipHash)}`);

  return params.db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data() as { count?: number; windowEndsAt?: number } | undefined;
    const vigente = Number(data?.windowEndsAt ?? 0) > now;

    if (vigente && Number(data?.count ?? 0) >= params.regla.max) {
      return { bloqueado: true, retryAfterSeconds: retryAfter(Number(data?.windowEndsAt), now) };
    }

    const windowEndsAt = vigente ? Number(data?.windowEndsAt) : now + params.regla.windowMs;
    transaction.set(ref, {
      count:       vigente ? Number(data?.count ?? 0) + 1 : 1,
      windowEndsAt,
      // TTL de limpieza: un día después de que la ventana cierra.
      expiresAt:   new Date(windowEndsAt + 86_400_000),
      updatedAt:   new Date(now),
    });
    return { bloqueado: false };
  });
}

/* ── Fallback en memoria (si Firestore no responde) ── */
export class RateLimitIAMemoria {
  private readonly contadores = new Map<string, { count: number; windowEndsAt: number }>();

  verificar(clave: string, ipHash: string, regla: ReglaRateLimitIA, now: number = Date.now()): ResultadoRateLimitIA {
    const key = `${clave}:${ipHash}`;
    const actual = this.contadores.get(key);
    const vigente = actual !== undefined && actual.windowEndsAt > now;

    if (vigente && actual.count >= regla.max) {
      return { bloqueado: true, retryAfterSeconds: retryAfter(actual.windowEndsAt, now) };
    }

    const windowEndsAt = vigente ? actual.windowEndsAt : now + regla.windowMs;
    this.contadores.set(key, { count: vigente ? actual.count + 1 : 1, windowEndsAt });
    return { bloqueado: false };
  }
}

export const rateLimitIAEmergencia = new RateLimitIAMemoria();

/**
 * Verifica el límite: intenta Firestore; si falla, cae a memoria.
 * Es el punto de entrada que usan los endpoints.
 */
export async function verificarRateLimitIA(params: {
  db:     FirestoreDb;
  clave:  string;
  ipHash: string;
  regla:  ReglaRateLimitIA;
  now?:   number;
}): Promise<ResultadoRateLimitIA> {
  try {
    return await aplicarRateLimitIA(params);
  } catch {
    return rateLimitIAEmergencia.verificar(params.clave, params.ipHash, params.regla, params.now);
  }
}

/** Reglas por endpoint, configurables por env (defaults conservadores). */
function numeroEnv(nombre: string, fallback: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : fallback;
}

export const REGLAS_IA: Record<'chat' | 'classify' | 'scan-doc', ReglaRateLimitIA> = {
  // Chat y clasificación: texto, más baratos.
  chat:       { max: numeroEnv('AI_RATE_CHAT_MINUTO', 10),     windowMs: 60_000 },
  classify:   { max: numeroEnv('AI_RATE_CLASSIFY_MINUTO', 15), windowMs: 60_000 },
  // Visión sobre archivos: más caro → más estricto.
  'scan-doc': { max: numeroEnv('AI_RATE_SCANDOC_MINUTO', 5),   windowMs: 60_000 },
};
