/**
 * e2e/rules/support/fase3-stub-firebase-admin.mjs
 *
 * FRONTERA MOCKEADA #2 (declarada, PARCIAL) — reemplaza `@/lib/firebase-admin`
 * para el arnés de `fase3-radicacion-interna-concurrencia.test.mjs`, pero
 * SOLO en `getFirebaseAdminStorage()`. `getFirebaseAdminApp`,
 * `getFirebaseAdminAuth` y `getFirebaseAdminDb` se REEXPORTAN del módulo
 * real sin modificar — Firestore es 100% real contra el emulador (mismas
 * transacciones, mismo `tx.create`, mismo Admin SDK que producción).
 *
 * Por qué esta frontera: el job `laboratorio-emulador` del CI solo levanta
 * el emulador de FIRESTORE (`firebase-tools emulators:exec --only
 * firestore`) — no hay emulador de Storage. Sin este stub, `guardarEnStorage`/
 * `moverEnStorage` del endpoint intentarían una subida real a Google Cloud
 * Storage con credenciales de prueba inválidas y sin bucket real: fallo de
 * red/autorización ajeno a lo que esta precondición valida (concurrencia y
 * atomicidad Firestore↔Firestore). El adjunto en sí (magic bytes, límites de
 * tamaño/cantidad) ya lo valida `route.ts` ANTES de tocar Storage — eso sigue
 * siendo código real y probado por esta suite.
 *
 * Simula el contrato mínimo que usa `route.ts`:
 *   bucket(nombre).file(ruta).save(buffer, { metadata })
 *   bucket(nombre).file(ruta).move(destino)
 * en memoria, para poder confirmar (assert) que "staging → finalize" se
 * invocó con las rutas esperadas, sin tocar red.
 */

// La extensión `.ts` explícita la resuelve Vite (resolve.tsconfigPaths +
// transformación SSR), no Node directamente — ver fase3-entorno.mjs.
export {
  getFirebaseAdminApp,
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
} from '../../../lib/firebase-admin.ts';

const almacenFalso = new Map();

function archivoFalso(bucketNombre, rutaArchivo) {
  return {
    async save(buffer, opciones = {}) {
      almacenFalso.set(rutaArchivo, {
        buffer,
        contentType: opciones?.metadata?.contentType ?? null,
        bucketNombre,
        etapa: 'staging',
      });
    },
    async move(rutaDestino) {
      const actual = almacenFalso.get(rutaArchivo);
      if (!actual) {
        throw new Error(
          `fase3-stub-firebase-admin: no existe '${rutaArchivo}' en el ` +
            `almacén simulado para moverlo a '${rutaDestino}' (¿se llamó ` +
            'move() sin save() previo?).',
        );
      }
      almacenFalso.delete(rutaArchivo);
      almacenFalso.set(rutaDestino, { ...actual, etapa: 'final' });
    },
  };
}

export function getFirebaseAdminStorage() {
  return {
    bucket(nombre) {
      return {
        file: (rutaArchivo) => archivoFalso(nombre, rutaArchivo),
      };
    },
  };
}

/** Instrumentación de verificación — no forma parte del contrato real de Storage. */
export function __inspeccionarAlmacenFalso() {
  return new Map(almacenFalso);
}

export function __limpiarAlmacenFalso() {
  almacenFalso.clear();
}
