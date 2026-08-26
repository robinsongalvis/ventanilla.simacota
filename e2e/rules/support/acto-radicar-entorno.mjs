/**
 * e2e/rules/support/acto-radicar-entorno.mjs
 *
 * Arnés que carga el HANDLER POST REAL de
 * `app/api/licencias/expedientes/[id]/radicar/route.ts` para correr contra el
 * emulador de Firestore. Mismo patrón que `fase3-entorno.mjs` (Vite
 * `ssrLoadModule` para resolver TypeScript y los alias `@/*` sin bundler), y
 * deliberadamente NO reimplementa nada del acto: la transacción, la emisión
 * del consecutivo, la reserva de unicidad y los guards son el código real.
 *
 * ── LAS TRES FRONTERAS MOCKEADAS, Y NINGUNA MÁS ──────────────────────────
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
 * 3. `@/lib/server/expedientes-licencias` — SOLO `evaluarCandadoEmisionReal`,
 *    que se sustituye por una versión que declara el candado ABIERTO. Todo lo
 *    demás del módulo (el evaluador, el planificador, los guards) se reexporta
 *    REAL, sin tocar una línea.
 *
 *    POR QUÉ ESTA TERCERA FRONTERA, Y POR QUÉ ASÍ. `EMISION_REAL_EXPEDIENTES_
 *    HABILITADA = false` es doctrina R10: mientras esté cerrado, la ruta
 *    devuelve 422 SIEMPRE y no existe ninguna rama de código que alcance
 *    `counters/expedientes-*`. Eso es exactamente lo que se quiere en
 *    producción — y lo que impide probar aquí la concurrencia del acto.
 *
 *    La alternativa era añadir a la constante una vía de escape por variable
 *    de entorno. Se descarta a propósito: sería aflojar una protección de
 *    PRODUCCIÓN para comodidad de una prueba, y el candado dejaría de ser
 *    verificable por lectura. Sustituir el módulo en el arnés deja la
 *    protección intacta en el único sitio donde importa.
 *
 *    Lo que esta frontera IMPLICA, dicho para que nadie lo descubra tarde:
 *    estas pruebas NO verifican que el candado esté cerrado. Eso lo asevera
 *    `__tests__/expedientes-licencias-rutas-ejecucion.test.ts` sobre el código
 *    real, y debe seguir haciéndolo.
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
const RUTA_CANDADO_STUB = path.join(__dirname, 'acto-radicar-stub-candado.mjs');

function pluginFronterasMock() {
  return {
    name: 'acto-radicar-fronteras-mock',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === '@/lib/server/internal-auth') return RUTA_AUTH_STUB;
      if (id === '@/lib/firebase-admin') return RUTA_STORAGE_STUB;
      // El propio stub del candado importa el módulo real: si se interceptara
      // también su importación, se resolvería a sí mismo en bucle.
      if (id === '@/lib/server/expedientes-licencias' && importer !== RUTA_CANDADO_STUB) {
        return RUTA_CANDADO_STUB;
      }
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
