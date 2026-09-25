/**
 * e2e/rules/support/acto-radicar-entorno.mjs
 *
 * Arnés que carga el HANDLER POST REAL de
 * `app/api/licencias/expedientes/[id]/radicar/route.ts` para correr contra el
 * emulador de Firestore. Mismo patrón que `fase3-entorno.mjs` (Vite
 * `ssrLoadModule` para resolver TypeScript y los alias `@/*` sin bundler), y
 * deliberadamente NO reimplementa nada del acto: la transacción, la validación
 * del número, la reserva de unicidad y los guards son el código real.
 *
 * ── LAS DOS FRONTERAS MOCKEADAS, Y NINGUNA MÁS ───────────────────────────
 *
 * 1. `@/lib/server/internal-auth` — el job solo levanta emulador de FIRESTORE;
 *    no hay emulador de Auth, y `requireActiveInternalUser()` real depende de
 *    `cookies()` de `next/headers`, que no existe al invocar el handler
 *    directamente. Se reutiliza el stub de fase 3, cuya réplica de
 *    `canOperateTenant` vigila `__tests__/stub-auth-coherente.test.ts`.
 *
 * 2. `@/lib/firebase-admin` — SOLO `getFirebaseAdminStorage()`.
 *    `getFirebaseAdminApp`/`getFirebaseAdminDb` se REEXPORTAN reales.
 *
 * LA TERCERA FRONTERA SE RETIRÓ (26-ago-2026). Existía para abrir el candado
 * R10, que impedía probar el acto porque este EMITÍA de la serie `expedientes`.
 * Desde que el número se TRANSCRIBE del libro de ventanilla, el acto ya no
 * emite nada de esa serie y el candado no le aplica: el arnés dejó de necesitar
 * tocar el módulo de decisión, y estas pruebas ejercitan el código real entero.
 */
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RUTA_ROUTE = path.join(REPO_ROOT, 'app', 'api', 'licencias', 'expedientes', '[id]', 'radicar', 'route.ts');
const RUTA_AUTH_STUB = path.join(__dirname, 'fase3-stub-internal-auth.mjs');
const RUTA_STORAGE_STUB = path.join(__dirname, 'fase3-stub-firebase-admin.mjs');

function pluginFronterasMock() {
  return {
    name: 'acto-radicar-fronteras-mock',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === '@/lib/server/internal-auth') return RUTA_AUTH_STUB;
      if (id === '@/lib/firebase-admin') return RUTA_STORAGE_STUB;
      return null;
    },
  };
}

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
    client_email: `acto-radicar-fake@${proyecto}.iam.gserviceaccount.com`,
    private_key: privateKey,
  });
}

let servidorVite = null;

export async function iniciarEntorno() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      '⛔ acto-radicar-entorno.mjs solo corre contra el emulador de Firestore ' +
        '(FIRESTORE_EMULATOR_HOST ausente). Ejecutar dentro de ' +
        '`firebase emulators:exec --only firestore` — ver `npm run test:rules`. ' +
        'Local: esta máquina no puede levantar el emulador (Java 8, sin Docker).',
    );
  }

  asegurarCredencialFalsa();
  process.env.FIREBASE_STORAGE_BUCKET ??= 'acto-radicar-bucket-simulado';

  servidorVite = await createServer({
    configFile: false,
    root: REPO_ROOT,
    resolve: { tsconfigPaths: true },
    plugins: [pluginFronterasMock()],
    logLevel: 'warn',
    optimizeDeps: { noDiscovery: true },
  });

  // ── MISMO CAMINO QUE EL FLAKE DE FASE 3 (8-ago y 24-ago-2026) ────────────
  // Estas tres cargas concurrentes pueden materializar DOS instancias de cada
  // stub: la que cuelga del grafo de `route.ts` (que importa
  // `@/lib/server/internal-auth`, redirigido por el plugin) y la directa de
  // este `Promise.all`. Este arnés REUTILIZA los stubs de fase 3, así que
  // hereda su inmunidad: el estado vive en `globalThis` bajo clave de
  // `Symbol.for()` — ver el comentario largo en `fase3-stub-internal-auth.mjs`.
  //
  // Y NO, correr en serie no lo evita: `--test-concurrency=1` serializa entre
  // ARCHIVOS de prueba, no dentro de este `Promise.all`, que es donde nace la
  // concurrencia. Si algún día un stub vuelve a guardar estado en una variable
  // de módulo, el 401 intermitente reaparece aquí igual que allá.
  const [routeMod, authMod, storageMod] = await Promise.all([
    servidorVite.ssrLoadModule(RUTA_ROUTE),
    servidorVite.ssrLoadModule(RUTA_AUTH_STUB),
    servidorVite.ssrLoadModule(RUTA_STORAGE_STUB),
  ]);

  return {
    /** Handler POST REAL del acto de radicar. */
    POST: routeMod.POST,
    setSession: authMod.__setSession,
    clearSession: authMod.__clearSession,
    getFirebaseAdminDb: storageMod.getFirebaseAdminDb,
    cargarModulo: (specifier) => servidorVite.ssrLoadModule(specifier),
  };
}

export async function detenerEntorno() {
  if (servidorVite) {
    await servidorVite.close();
    servidorVite = null;
  }
}
