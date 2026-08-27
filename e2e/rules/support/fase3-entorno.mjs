/**
 * e2e/rules/support/fase3-entorno.mjs
 *
 * Arnés que carga el HANDLER POST REAL de
 * `app/api/radicacion/interna/route.ts` (importado, NO reimplementado —
 * a diferencia del antipatrón `h3-atomicidad-integracion.test.mjs`, que
 * reimplementa la lógica de consecutivo+documento inline) para correr contra
 * el emulador de Firestore, con SOLO dos fronteras mockeadas (ver
 * `fase3-stub-internal-auth.mjs` y `fase3-stub-firebase-admin.mjs`).
 *
 * Cómo se carga TypeScript con alias `@/*` sin bundler de Next: usando la
 * API programática de Vite (`createServer` + `ssrLoadModule`), la MISMA
 * maquinaria de resolución de alias/transpilación que ya usa
 * `vitest.config.mts` (`resolve.tsconfigPaths` nativo de Vite 8 — sustituye
 * el plugin `vite-tsconfig-paths` que usa Vitest, pero lee el mismo
 * `tsconfig.json`). Reutilización deliberada de infraestructura ya validada
 * en el repo (Principio 3) en vez de escribir un resolvedor de módulos a
 * mano.
 *
 * `resolveId` (fase antes de tsconfigPaths, `enforce: 'pre'`) intercepta
 * EXACTAMENTE dos specifiers — `@/lib/server/internal-auth` y
 * `@/lib/firebase-admin` — y los redirige a los stubs. Todo lo demás
 * (incluida la resolución relativa que hacen los propios stubs para
 * reexportar el `firebase-admin.ts` real) sigue el camino normal.
 */
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUTA_ROUTE = path.join(REPO_ROOT, 'app', 'api', 'radicacion', 'interna', 'route.ts');
const RUTA_AUTH_STUB = path.join(__dirname, 'fase3-stub-internal-auth.mjs');
const RUTA_STORAGE_STUB = path.join(__dirname, 'fase3-stub-firebase-admin.mjs');

function pluginFronterasMock() {
  return {
    name: 'fase3-fronteras-mock',
    enforce: 'pre',
    resolveId(id) {
      if (id === '@/lib/server/internal-auth') return RUTA_AUTH_STUB;
      if (id === '@/lib/firebase-admin') return RUTA_STORAGE_STUB;
      return null;
    },
  };
}

/**
 * Credenciales de app Admin SDK: `getFirebaseAdminApp()` real
 * (`lib/firebase-admin.ts`, NO mockeado) exige `FIREBASE_SERVICE_ACCOUNT`
 * bien formado para construir el `credential.Certificate` — ese secreto de
 * producción no existe (ni debe existir) en el job `laboratorio-emulador`.
 * Se genera aquí un par de llaves RSA DESECHABLE en tiempo de test: JAMÁS se
 * usa para autenticar de verdad, porque con `FIRESTORE_EMULATOR_HOST`
 * definido el Admin SDK enruta todo el tráfico de Firestore al canal local
 * del emulador sin ejercer las credenciales (confirmado empíricamente: con
 * una llave falsa + `FIRESTORE_EMULATOR_HOST` apuntando a un puerto sin
 * servidor, el fallo es de RED — `ECONNREFUSED`/`UNAVAILABLE` — nunca de
 * credenciales). No es una tercera frontera mockeada: `getFirebaseAdminApp`/
 * `getFirebaseAdminDb` siguen siendo el código real, sin un solo cambio.
 */
function asegurarCredencialFalsa() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return;
  const proyecto = process.env.GCLOUD_PROJECT ?? 'demo-ventanilla-lab';
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: proyecto,
    client_email: `fase3-fake@${proyecto}.iam.gserviceaccount.com`,
    private_key: privateKey,
  });
}

let servidorVite = null;

/**
 * Arranca el entorno. Lanza si `FIRESTORE_EMULATOR_HOST` no está definido —
 * este arnés SOLO corre dentro de `firebase emulators:exec` (igual que
 * `e2e/rules/setup.mjs`); nunca contra Firestore real.
 */
export async function iniciarEntorno() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      '⛔ fase3-entorno.mjs solo corre contra el emulador de Firestore ' +
        '(FIRESTORE_EMULATOR_HOST ausente). Ejecutar dentro de ' +
        '`firebase emulators:exec --only firestore` — igual que el resto de ' +
        '`e2e/rules/*.test.mjs` (ver `npm run test:rules` y el job CI ' +
        '`laboratorio-emulador` en .github/workflows/ci.yml, paso "Matriz de ' +
        'aislamiento por tenant"). Local: esta máquina no puede levantar el ' +
        'emulador (Java 8, sin Docker) — ADR-0002/ADR-0007.',
    );
  }

  asegurarCredencialFalsa();
  process.env.FIREBASE_STORAGE_BUCKET ??= 'fase3-bucket-simulado';

  servidorVite = await createServer({
    configFile: false,
    root: REPO_ROOT,
    resolve: { tsconfigPaths: true },
    plugins: [pluginFronterasMock()],
    logLevel: 'warn',
    optimizeDeps: { noDiscovery: true },
  });

  // Estas tres cargas concurrentes pueden materializar DOS instancias de cada
  // stub (la del grafo de route.ts y la directa) — causa del 401 intermitente
  // del 8-ago/24-ago-2026. Es inocuo desde que los stubs guardan su estado en
  // `globalThis` con clave `Symbol.for()` (ver comentario en cada stub); se
  // deja el `Promise.all` a propósito para seguir ejercitando ese camino.
  const [routeMod, authMod, storageMod] = await Promise.all([
    servidorVite.ssrLoadModule(RUTA_ROUTE),
    servidorVite.ssrLoadModule(RUTA_AUTH_STUB),
    servidorVite.ssrLoadModule(RUTA_STORAGE_STUB),
  ]);

  return {
    /** Handler POST REAL de app/api/radicacion/interna/route.ts, sin reimplementar. */
    POST: routeMod.POST,
    setSession: authMod.__setSession,
    clearSession: authMod.__clearSession,
    getFirebaseAdminDb: storageMod.getFirebaseAdminDb,
    inspeccionarAlmacenFalso: storageMod.__inspeccionarAlmacenFalso,
    limpiarAlmacenFalso: storageMod.__limpiarAlmacenFalso,
    /**
     * Passthrough para que el test cargue OTROS módulos reales del repo
     * (catálogos, formateadores puros) con la misma resolución de alias —
     * p. ej. `@/lib/catalogos/tipos-solicitud` para obtener un
     * `tipoSolicitudId` válido en vez de hardcodearlo (el catálogo puede
     * cambiar; el test no debe acoplarse a un id textual concreto), o
     * `@/lib/radicado-institucional` para predecir el id del PRÓXIMO
     * radicado con la MISMA función pura que usa `route.ts`.
     */
    cargarModulo: (specifier) => servidorVite.ssrLoadModule(specifier),
  };
}

export async function detenerEntorno() {
  if (servidorVite) {
    await servidorVite.close();
    servidorVite = null;
  }
}
