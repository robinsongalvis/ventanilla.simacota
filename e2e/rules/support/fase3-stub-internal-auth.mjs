/**
 * e2e/rules/support/fase3-stub-internal-auth.mjs
 *
 * FRONTERA MOCKEADA #1 (declarada) — reemplaza por completo
 * `@/lib/server/internal-auth` para el arnés de
 * `fase3-radicacion-interna-concurrencia.test.mjs` (ver
 * `docs/CRONOGRAMA_PIEZA_ANGULAR.md` §Fase 3, precondición #1).
 *
 * Por qué esta frontera y no otra: `requireActiveInternalUser()` real llama
 * `cookies()` de `next/headers` (requiere el AsyncLocalStorage de una
 * petición Next.js real, inexistente cuando el handler se invoca
 * directamente vía `route.POST(request)` fuera del runtime de Next) y
 * `verifySessionCookie()` de Firebase Auth — el job `laboratorio-emulador`
 * del CI SOLO levanta el emulador de FIRESTORE (`--only firestore`), no hay
 * emulador de Auth. Verificar sesión real está fuera del alcance de esta
 * precondición (que es sobre concurrencia/atomicidad Firestore, no sobre
 * autenticación — eso ya lo cubren `__tests__/radicacion-interna-*.test.ts`
 * contra mocks fieles, Fase 2).
 *
 * Todo lo demás que toca el endpoint (Firestore vía Admin SDK: contadores,
 * transacciones, tx.create, trazabilidad) es REAL contra el emulador — ver
 * `fase3-entorno.mjs`.
 */

export class InternalAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

/*
 * ── Endurecimiento contra la DOBLE INSTANCIACIÓN del módulo ────────────────
 * (flake intermitente de CI: 8-ago-2026 y run 32676424705, 24-ago, PR #215)
 *
 * `fase3-entorno.mjs` provoca DOS cargas de este módulo: una implícita
 * (route.ts importa `@/lib/server/internal-auth`, que el plugin redirige
 * aquí) y una explícita (`ssrLoadModule(RUTA_AUTH_STUB)` para exponer
 * `__setSession` al test). Cuando ambas corren CONCURRENTES (`Promise.all`),
 * Vite puede materializar dos INSTANCIAS del módulo: con el estado en una
 * variable de clausura, el test escribía la sesión en una instancia y el
 * handler leía la otra → 401 intermitente («sin una sesión mockeada»).
 *
 * Por eso la sesión NO vive en una variable de módulo sino en `globalThis`
 * bajo una clave de `Symbol.for()`: el registro global de símbolos es único
 * por proceso/realm, así que TODAS las instancias del módulo — las cree
 * Vite, Node o cualquier otro loader — leen y escriben el MISMO estado.
 * (`Symbol()` a secas NO serviría: cada instancia crearía una clave
 * distinta y el bug volvería.)
 *
 * `InternalAuthError` también se duplica con el módulo, pero eso es
 * inofensivo: route.ts lanza y captura (`instanceof`) dentro de SU propia
 * instancia; solo la sesión cruza de una instancia a otra. La inmunidad la
 * demuestra `e2e/rules/fase3-stub-doble-instanciacion.test.mjs` cargando
 * este módulo dos veces a propósito.
 */
const CLAVE_SESION = Symbol.for('ventanilla.simacota/e2e/fase3-stub-internal-auth.sesion');

/** Fija la sesión que devolverá la próxima llamada a `requireActiveInternalUser()`. */
export function __setSession(session) {
  globalThis[CLAVE_SESION] = session;
}

export function __clearSession() {
  globalThis[CLAVE_SESION] = null;
}

export async function requireActiveInternalUser() {
  const sesionActual = globalThis[CLAVE_SESION];
  if (!sesionActual) {
    throw new InternalAuthError(
      'fase3-stub-internal-auth: se invocó requireActiveInternalUser() sin ' +
        'una sesión mockeada (__setSession primero).',
      401,
    );
  }
  return sesionActual;
}

/**
 * REPLICA EXACTA de `canOperateTenant` (lib/server/internal-auth.ts:82-86).
 *
 * Se replica en vez de reexportar el real porque este stub SUSTITUYE al módulo
 * entero: quien importa `@/lib/server/internal-auth` recibe este archivo, y
 * reexportar desde el original crearía una importación circular a través del
 * mismo alias que el plugin intercepta.
 *
 * Es una función PURA de tres líneas sobre la sesión, sin I/O — pero es una
 * réplica, y las réplicas se desincronizan calladas. `__tests__/stub-auth-
 * coherente.test.ts` compara ambas contra las mismas entradas.
 */
export function canOperateTenant(user, tenantId) {
  return user.rol === 'ADMIN'
    || user.rol === 'RECEPCIONISTA'
    || (user.rol === 'FUNCIONARIO' && user.tenantId === tenantId);
}
