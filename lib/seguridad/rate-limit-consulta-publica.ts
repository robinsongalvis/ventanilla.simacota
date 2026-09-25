import { FieldValue } from 'firebase-admin/firestore';

export interface ConfiguracionRateLimitConsulta {
  maxIpPorMinuto: number;
  maxRadicadoPorHora: number;
  maxCombinacionPorMinuto: number;
  maxFallosPorRadicado: number;
  bloqueoFallosMs: number;
}

export const CONFIG_RATE_LIMIT_CONSULTA: ConfiguracionRateLimitConsulta = {
  maxIpPorMinuto: numeroEnv('CONSULTA_RATE_IP_MINUTO', 5),
  maxRadicadoPorHora: numeroEnv('CONSULTA_RATE_RADICADO_HORA', 10),
  maxCombinacionPorMinuto: numeroEnv('CONSULTA_RATE_COMBINACION_MINUTO', 5),
  maxFallosPorRadicado: numeroEnv('CONSULTA_RATE_FALLOS_RADICADO', 5),
  bloqueoFallosMs: numeroEnv('CONSULTA_RATE_BLOQUEO_MINUTOS', 15) * 60_000,
};

interface ContadorMemoria {
  count: number;
  windowEndsAt: number;
}

export interface ResultadoRateLimit {
  bloqueado: boolean;
  retryAfterSeconds?: number;
  alcance?: 'IP' | 'RADICADO' | 'COMBINACION' | 'FALLOS';
}

function numeroEnv(nombre: string, fallback: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : fallback;
}

function retryAfter(windowEndsAt: number, now: number): number {
  return Math.max(1, Math.ceil((windowEndsAt - now) / 1000));
}

function idSeguro(value: string): string {
  return value.replace(/[^a-f0-9_-]/gi, '').slice(0, 128);
}

export class RateLimitConsultaMemoria {
  private readonly contadores = new Map<string, ContadorMemoria>();
  private readonly fallos = new Map<string, ContadorMemoria>();

  constructor(private readonly config = CONFIG_RATE_LIMIT_CONSULTA) {}

  verificar(ipHash: string, radicadoHash: string, now = Date.now()): ResultadoRateLimit {
    const fallo = this.fallos.get(radicadoHash);
    if (fallo && fallo.count >= this.config.maxFallosPorRadicado && fallo.windowEndsAt > now) {
      return { bloqueado: true, retryAfterSeconds: retryAfter(fallo.windowEndsAt, now), alcance: 'FALLOS' };
    }

    const reglas = [
      { key: `ip:${ipHash}`, max: this.config.maxIpPorMinuto, windowMs: 60_000, alcance: 'IP' as const },
      { key: `rad:${radicadoHash}`, max: this.config.maxRadicadoPorHora, windowMs: 3_600_000, alcance: 'RADICADO' as const },
      { key: `pair:${ipHash}:${radicadoHash}`, max: this.config.maxCombinacionPorMinuto, windowMs: 60_000, alcance: 'COMBINACION' as const },
    ];

    for (const regla of reglas) {
      const actual = this.contadores.get(regla.key);
      if (actual && actual.windowEndsAt > now && actual.count >= regla.max) {
        return { bloqueado: true, retryAfterSeconds: retryAfter(actual.windowEndsAt, now), alcance: regla.alcance };
      }
    }

    for (const regla of reglas) {
      const actual = this.contadores.get(regla.key);
      this.contadores.set(regla.key, !actual || actual.windowEndsAt <= now
        ? { count: 1, windowEndsAt: now + regla.windowMs }
        : { ...actual, count: actual.count + 1 });
    }
    return { bloqueado: false };
  }

  registrarFallo(radicadoHash: string, now = Date.now()): ResultadoRateLimit {
    const actual = this.fallos.get(radicadoHash);
    const siguiente = !actual || actual.windowEndsAt <= now
      ? { count: 1, windowEndsAt: now + this.config.bloqueoFallosMs }
      : { count: actual.count + 1, windowEndsAt: actual.windowEndsAt };
    this.fallos.set(radicadoHash, siguiente);
    return siguiente.count >= this.config.maxFallosPorRadicado
      ? { bloqueado: true, retryAfterSeconds: retryAfter(siguiente.windowEndsAt, now), alcance: 'FALLOS' }
      : { bloqueado: false };
  }

  limpiarFallos(radicadoHash: string): void {
    this.fallos.delete(radicadoHash);
  }
}

export const rateLimitConsultaEmergencia = new RateLimitConsultaMemoria();

type FirestoreDb = FirebaseFirestore.Firestore;

export async function aplicarRateLimitCompartido(params: {
  db: FirestoreDb;
  ipHash: string;
  radicadoHash: string;
  now?: number;
  config?: ConfiguracionRateLimitConsulta;
}): Promise<ResultadoRateLimit> {
  const now = params.now ?? Date.now();
  const config = params.config ?? CONFIG_RATE_LIMIT_CONSULTA;
  const collection = params.db.collection('seguridad_rate_limits');
  const falloRef = collection.doc(`fail_${idSeguro(params.radicadoHash)}`);
  const reglas = [
    { ref: collection.doc(`ip_${idSeguro(params.ipHash)}`), max: config.maxIpPorMinuto, windowMs: 60_000, alcance: 'IP' as const },
    { ref: collection.doc(`rad_${idSeguro(params.radicadoHash)}`), max: config.maxRadicadoPorHora, windowMs: 3_600_000, alcance: 'RADICADO' as const },
    { ref: collection.doc(`pair_${idSeguro(params.ipHash)}_${idSeguro(params.radicadoHash)}`), max: config.maxCombinacionPorMinuto, windowMs: 60_000, alcance: 'COMBINACION' as const },
  ];

  return params.db.runTransaction(async (transaction) => {
    const [falloSnap, ...snaps] = await transaction.getAll(falloRef, ...reglas.map((r) => r.ref));
    const falloData = falloSnap.data() as { count?: number; windowEndsAt?: number } | undefined;
    if (
      Number(falloData?.count ?? 0) >= config.maxFallosPorRadicado
      && Number(falloData?.windowEndsAt ?? 0) > now
    ) {
      return {
        bloqueado: true,
        retryAfterSeconds: retryAfter(Number(falloData?.windowEndsAt), now),
        alcance: 'FALLOS',
      };
    }

    for (let index = 0; index < reglas.length; index += 1) {
      const data = snaps[index].data() as { count?: number; windowEndsAt?: number } | undefined;
      if (Number(data?.windowEndsAt ?? 0) > now && Number(data?.count ?? 0) >= reglas[index].max) {
        return {
          bloqueado: true,
          retryAfterSeconds: retryAfter(Number(data?.windowEndsAt), now),
          alcance: reglas[index].alcance,
        };
      }
    }

    reglas.forEach((regla, index) => {
      const data = snaps[index].data() as { count?: number; windowEndsAt?: number } | undefined;
      const vigente = Number(data?.windowEndsAt ?? 0) > now;
      const windowEndsAt = vigente ? Number(data?.windowEndsAt) : now + regla.windowMs;
      transaction.set(regla.ref, {
        count: vigente ? Number(data?.count ?? 0) + 1 : 1,
        windowEndsAt,
        expiresAt: new Date(windowEndsAt + 86_400_000),
        updatedAt: new Date(now),
      });
    });
    return { bloqueado: false };
  });
}

export async function registrarFalloCompartido(params: {
  db: FirestoreDb;
  radicadoHash: string;
  now?: number;
  config?: ConfiguracionRateLimitConsulta;
}): Promise<ResultadoRateLimit> {
  const now = params.now ?? Date.now();
  const config = params.config ?? CONFIG_RATE_LIMIT_CONSULTA;
  const ref = params.db.collection('seguridad_rate_limits').doc(`fail_${idSeguro(params.radicadoHash)}`);
  return params.db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const data = snap.data() as { count?: number; windowEndsAt?: number } | undefined;
    const vigente = Number(data?.windowEndsAt ?? 0) > now;
    const count = vigente ? Number(data?.count ?? 0) + 1 : 1;
    const windowEndsAt = vigente ? Number(data?.windowEndsAt) : now + config.bloqueoFallosMs;
    transaction.set(ref, {
      count,
      windowEndsAt,
      expiresAt: new Date(windowEndsAt + 86_400_000),
      updatedAt: new Date(now),
    });
    return count >= config.maxFallosPorRadicado
      ? { bloqueado: true, retryAfterSeconds: retryAfter(windowEndsAt, now), alcance: 'FALLOS' }
      : { bloqueado: false };
  });
}

export async function limpiarFallosCompartidos(db: FirestoreDb, radicadoHash: string): Promise<void> {
  await db.collection('seguridad_rate_limits').doc(`fail_${idSeguro(radicadoHash)}`).delete();
}

export type EventoAuditoriaConsulta =
  | 'CONSULTA_PUBLICA_AUTORIZADA'
  | 'CONSULTA_PUBLICA_DENEGADA'
  | 'CONSULTA_PUBLICA_BLOQUEADA'
  | 'CONSULTA_PUBLICA_SIN_METODO_VERIFICACION';

/** Agrega eventos repetidos por ventana; no guarda IP, correo, documento ni token. */
export async function registrarAuditoriaConsulta(params: {
  db: FirestoreDb;
  evento: EventoAuditoriaConsulta;
  motivo: string;
  ipHash: string;
  radicadoHash: string;
  userAgentHash?: string;
  now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  const ventana = Math.floor(now / 300_000);
  const id = `${ventana}_${params.evento}_${idSeguro(params.ipHash).slice(0, 24)}_${idSeguro(params.radicadoHash).slice(0, 24)}`;
  await params.db.collection('seguridad_consultas_auditoria').doc(id).set({
    evento: params.evento,
    motivo: params.motivo,
    ipHash: params.ipHash,
    radicadoHash: params.radicadoHash,
    ...(params.userAgentHash ? { userAgentHash: params.userAgentHash } : {}),
    primeraFecha: new Date(ventana * 300_000),
    ultimaFecha: new Date(now),
    cantidad: FieldValue.increment(1),
    expiresAt: new Date(now + 90 * 86_400_000),
  }, { merge: true });
}
