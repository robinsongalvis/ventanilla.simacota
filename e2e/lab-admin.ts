import admin from 'firebase-admin';
import { leerServiceAccountStage } from './env';

/**
 * Marcado de datos sintéticos del auditor funcional (hallazgo de
 * firestore-datos, 2026-07-10): los radicados que esta suite crea en
 * STAGE deben quedar `isTest: true` para que:
 *  - `--limpiar` de la Alcaldía Sintética los pueda borrar de forma
 *    determinista (solo borra `isTest`).
 *  - Los conteos operativos del laboratorio no se contaminen con
 *    consecutivos sintéticos de Playwright.
 *  - El propio dashboard interno los excluya de Bandeja/Tablero/Mi
 *    gestión (`useVentanillaRadicados` filtra `!r.isTest` — por eso el
 *    marcado ocurre en el TEARDOWN del test, nunca antes: si se marcara
 *    al crear, el resto del propio test dejaría de verlo en la UI).
 */

let dbInstancia: admin.firestore.Firestore | null = null;

function getAdminDb(): admin.firestore.Firestore {
  if (dbInstancia) return dbInstancia;
  const { projectId, credencial } = leerServiceAccountStage();
  const app = admin.apps.length > 0
    ? admin.apps[0]!
    : admin.initializeApp({ credential: admin.credential.cert(credencial as admin.ServiceAccount), projectId });
  dbInstancia = admin.firestore(app);
  return dbInstancia;
}

const METADATA_LABORATORIO = {
  isTest: true,
  laboratorio: { generador: 'playwright-e2e' },
} as const;

/**
 * Marca un radicado creado por la suite como dato sintético. Se llama
 * SIEMPRE al final de cada test que radica (fixture `registrarRadicadoDePrueba`
 * en `e2e/fixtures.ts`), pase o falle el test — un radicado a medio marcar
 * es peor que uno sin marcar (ambigüedad), así que esto no debe saltarse
 * nunca que el radicado haya llegado a crearse.
 */
export async function marcarRadicadoDePrueba(radicadoId: string): Promise<void> {
  await marcarDocumentoDePrueba('ventanilla_radicados', radicadoId);
}

/**
 * Batch A (escenario 11, Registro exprés): ese flujo crea DOS documentos
 * en colecciones distintas en la misma llamada — el radicado de entrada
 * (`ventanilla_radicados`) Y una salida amarrada (`ventanilla_salidas`,
 * `lib/dependencias/registro-expres.ts`). La salida necesita su propio
 * marcado — es una colección aparte, `marcarRadicadoDePrueba` no la toca.
 * Nota (hallazgo menor, ver bitácora): a diferencia de `ventanilla_radicados`,
 * ningún hook cliente (`useVentanillaSalidas` o equivalente) filtra
 * `isTest` hoy sobre `ventanilla_salidas` — se marca por higiene de datos
 * y por si `--limpiar` de la Alcaldía Sintética la adopta más adelante,
 * pero no oculta la salida de "Salidas" en el dashboard todavía.
 */
export async function marcarDocumentoDePrueba(coleccion: string, id: string): Promise<void> {
  const db = getAdminDb();
  await db.doc(`${coleccion}/${id}`).set(METADATA_LABORATORIO, { merge: true });
}

/**
 * Lectura de solo lectura para verificación de aserciones que no se
 * pueden confirmar solo con la respuesta HTTP del endpoint (p. ej.
 * `termino.prorrogasAplicadas`, que el endpoint de prórroga no devuelve
 * en su respuesta JSON). NUNCA escribe nada.
 */
export async function leerRadicado(radicadoId: string): Promise<FirebaseFirestore.DocumentData | undefined> {
  const db = getAdminDb();
  const snap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  return snap.data();
}

/**
 * Barrido retroactivo: encuentra radicados con asunto `[E2E-AUTO] ...`
 * que quedaron sin marcar (corridas de esta suite antes de que existiera
 * este mecanismo) y los marca. Firestore no tiene "contains"; el truco
 * de rango `>=prefijo` / `<prefijo+` es el equivalente a un
 * prefix-match sobre `detalle.asunto`.
 */
export async function marcarRetroactivamente(): Promise<{ total: number; yaEstaban: number; marcados: string[] }> {
  const db = getAdminDb();
  const prefijo = '[E2E-AUTO]';
  const snap = await db
    .collection('ventanilla_radicados')
    .where('detalle.asunto', '>=', prefijo)
    .where('detalle.asunto', '<', prefijo + '')
    .get();

  let yaEstaban = 0;
  const marcados: string[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isTest === true) { yaEstaban += 1; continue; }
    await doc.ref.set(METADATA_LABORATORIO, { merge: true });
    marcados.push(doc.id);
  }
  return { total: snap.size, yaEstaban, marcados };
}
