/**
 * Ecosistema de Resiliencia Multicapa - Ventanilla Única Inteligente de Simacota
 * Implementa el patrón Circuit Breaker y políticas de reintentos exponenciales con Jitter.
 * 
 * "La IA puede degradarse; la operación municipal nunca debe detenerse."
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerConfig {
  maxFailures: number;      // Número de fallas consecutivas para abrir el circuito (ej. 5)
  cooldownMs: number;       // Tiempo de espera antes de probar en Half-Open (ej. 60s)
  successThreshold: number; // Intentos exitosos consecutivos en Half-Open para volver a Cerrar (ej. 3)
}

class CircuitBreaker {
  private name: string;
  private config: CircuitBreakerConfig;
  
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = {
      maxFailures: 5,
      cooldownMs: 60000, // 60 segundos
      successThreshold: 3,
      ...config,
    };
  }

  public getState(): CircuitState {
    this.evaluarEstado();
    return this.state;
  }

  private evaluarEstado() {
    if (this.state === 'OPEN') {
      const transcurrido = Date.now() - this.lastFailureTime;
      if (transcurrido >= this.config.cooldownMs) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.warn(`[CircuitBreaker - ${this.name}] Cooldown finalizado. Cambiando estado a HALF_OPEN.`);
      }
    }
  }

  public puedeEjecutar(): boolean {
    this.evaluarEstado();
    return this.state !== 'OPEN';
  }

  public registrarExito() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        console.log(`[CircuitBreaker - ${this.name}] Éxito alcanzado. Circuito restaurado a CLOSED.`);
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  public registrarFallo(error: any) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'CLOSED') {
      if (this.failureCount >= this.config.maxFailures) {
        this.state = 'OPEN';
        console.error(
          `[CircuitBreaker - ${this.name}] Se alcanzaron ${this.failureCount} fallas consecutivas. ¡CIRCUITO ABIERTO!`
        );
      }
    } else if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.successCount = 0;
      console.error(
        `[CircuitBreaker - ${this.name}] Falló petición en estado HALF_OPEN. CIRCUITO ABIERTO de nuevo.`
      );
    }
  }
}

// Registro global en memoria para persistencia de estados entre peticiones Next.js (hot-starts)
const globalInstances = global as unknown as {
  __circuit_breakers?: Record<string, CircuitBreaker>;
};

if (!globalInstances.__circuit_breakers) {
  globalInstances.__circuit_breakers = {};
}

export function obtenerCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!globalInstances.__circuit_breakers![name]) {
    globalInstances.__circuit_breakers![name] = new CircuitBreaker(name, config);
  }
  return globalInstances.__circuit_breakers![name];
}

/**
 * Función helper para pausar la ejecución (reintentos)
 */
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Implementa reintentos automáticos con decaimiento exponencial y Jitter aleatorio.
 */
export async function ejecutarConReintentos<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelayMs: number = 1000,
  nombreOperacion: string = 'AIRequest'
): Promise<T> {
  let int = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      int++;
      if (int > retries) {
        throw error;
      }
      // Delay exponencial con Jitter: 2^intento * baseDelayMs + random(0, 500)ms
      const exponentialDelay = Math.pow(2, int) * baseDelayMs;
      const jitter = Math.random() * 500;
      const totalDelay = exponentialDelay + jitter;
      console.warn(
        `[Retry - ${nombreOperacion}] Reintento ${int}/${retries} tras error en ${Math.round(totalDelay)}ms. Detalle:`,
        error instanceof Error ? error.message : String(error)
      );
      await delay(totalDelay);
    }
  }
}

/**
 * Orquestador de resiliencia completo que une el Circuit Breaker y los reintentos
 */
export async function ejecutarConResiliencia<T>(
  breakerName: string,
  operacion: () => Promise<T>,
  opciones?: {
    retries?: number;
    baseDelayMs?: number;
    configBreaker?: Partial<CircuitBreakerConfig>;
  }
): Promise<T> {
  const breaker = obtenerCircuitBreaker(breakerName, opciones?.configBreaker);

  if (!breaker.puedeEjecutar()) {
    throw new Error(`[CircuitBreaker - ${breakerName}] Circuito se encuentra ABIERTO (OPEN). Petición cancelada preventivamente.`);
  }

  try {
    const result = await ejecutarConReintentos(
      operacion,
      opciones?.retries ?? 2,
      opciones?.baseDelayMs ?? 1000,
      breakerName
    );
    breaker.registrarExito();
    return result;
  } catch (error) {
    breaker.registrarFallo(error);
    throw error;
  }
}
