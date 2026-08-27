/**
 * e2e/rules/fase3-stub-doble-instanciacion.test.mjs
 *
 * Regresión del flake de CI del 8-ago-2026 (reincidencia: run 32676424705,
 * 24-ago, PR #215): los `ssrLoadModule` concurrentes de
 * `support/fase3-entorno.mjs` pueden materializar DOS instancias de cada stub
 * de frontera. Con el estado en variables de clausura de módulo, el test
 * escribía la sesión (o los adjuntos) en una instancia y el handler leía la
 * otra → 401 intermitente «se invocó requireActiveInternalUser() sin una
 * sesión mockeada» en vez de 200.
 *
 * La cura (ver comentario largo en cada stub) es que el estado viva en
 * `globalThis` bajo claves de `Symbol.for()`, compartidas por TODAS las
 * instancias del módulo. Este archivo lo demuestra de forma DETERMINISTA:
 * importa cada stub DOS VECES con query strings distintos — para el loader
 * ESM de Node dos URLs distintas son dos módulos distintos, exactamente la
 * situación que Vite produce de forma intermitente — y verifica que lo
 * escrito por una instancia es visible desde la otra. Si alguien devuelve el
 * estado a una variable de módulo, estos tests fallan SIEMPRE (no
 * intermitentemente, como el flake original).
 *
 * No necesita el emulador de Firestore (no toca la red), pero vive en
 * `e2e/rules/` porque protege el arnés de esta suite y así corre bajo el
 * mismo glob `test:rules` del job `laboratorio-emulador` — la compuerta
 * autoritativa (localmente la suite completa no corre: Java 8, ADR-0002).
 *
 * Nota: importar `support/fase3-stub-firebase-admin.mjs` bajo Node "a pelo"
 * (sin Vite) evalúa su reexport de `lib/firebase-admin.ts` vía type
 * stripping nativo (Node ≥ 22.18, `.nvmrc` = 22) — sin efectos secundarios
 * en tiempo de import.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const URL_STUB_AUTH = new URL('./support/fase3-stub-internal-auth.mjs', import.meta.url).href;
const URL_STUB_STORAGE = new URL('./support/fase3-stub-firebase-admin.mjs', import.meta.url).href;

/** Dos instancias REALES del mismo módulo (URLs distintas → doble evaluación). */
async function importarDosVeces(urlBase) {
  const [a, b] = await Promise.all([
    import(`${urlBase}?instancia=a`),
    import(`${urlBase}?instancia=b`),
  ]);
  return [a, b];
}

test('fase3-stub-internal-auth: la sesión sobrevive a la doble instanciación', async () => {
  const [stubA, stubB] = await importarDosVeces(URL_STUB_AUTH);

  // Premisa del test: son de verdad DOS instancias (doble evaluación del
  // módulo), no dos referencias al mismo namespace. Si un loader futuro
  // dedujera las URLs, este assert evita que el test pase en vacío.
  assert.notEqual(
    stubA.requireActiveInternalUser,
    stubB.requireActiveInternalUser,
    'premisa rota: el loader devolvió una sola instancia del stub',
  );

  const sesion = {
    uid: 'fase3-doble-instanciacion',
    email: 'fase3-doble-instanciacion@simacota.gov.co',
    rol: 'RECEPCIONISTA',
    tenantId: 'VENTANILLA_UNICA',
    activo: true,
  };

  // El escenario exacto del flake: __setSession en una instancia (la que el
  // arnés entrega al test) y requireActiveInternalUser en la OTRA (la que
  // importó route.ts). Antes del endurecimiento esto lanzaba el 401.
  stubA.__setSession(sesion);
  assert.equal(
    await stubB.requireActiveInternalUser(),
    sesion,
    'la sesión fijada en la instancia A debe ser visible desde la instancia B',
  );

  // Y el camino inverso: limpiar desde B debe dejar sin sesión a A.
  stubB.__clearSession();
  await assert.rejects(
    () => stubA.requireActiveInternalUser(),
    /sin una sesión mockeada/,
    '__clearSession en la instancia B debe limpiar la sesión que ve la instancia A',
  );
});

test('fase3-stub-firebase-admin: el almacén simulado sobrevive a la doble instanciación', async () => {
  const [stubA, stubB] = await importarDosVeces(URL_STUB_STORAGE);

  assert.notEqual(
    stubA.getFirebaseAdminStorage,
    stubB.getFirebaseAdminStorage,
    'premisa rota: el loader devolvió una sola instancia del stub',
  );
  stubA.__limpiarAlmacenFalso();

  // save() desde la instancia A (la del grafo de route.ts)…
  const archivo = stubA
    .getFirebaseAdminStorage()
    .bucket('fase3-bucket-simulado')
    .file('staging/doble-instanciacion.pdf');
  await archivo.save(Buffer.from('%PDF-1.4 fase3'), {
    metadata: { contentType: 'application/pdf' },
  });

  // …debe ser visible al inspeccionar desde la instancia B (la del test).
  const enStaging = stubB.__inspeccionarAlmacenFalso().get('staging/doble-instanciacion.pdf');
  assert.ok(enStaging, 'el adjunto guardado por la instancia A debe verse desde la instancia B');
  assert.equal(enStaging.etapa, 'staging');
  assert.equal(enStaging.contentType, 'application/pdf');

  // move() (staging → final) desde la instancia B sobre lo que guardó A…
  await stubB
    .getFirebaseAdminStorage()
    .bucket('fase3-bucket-simulado')
    .file('staging/doble-instanciacion.pdf')
    .move('radicados/doble-instanciacion/final.pdf');

  // …y el resultado, visible de vuelta desde A.
  const almacenSegunA = stubA.__inspeccionarAlmacenFalso();
  assert.equal(almacenSegunA.has('staging/doble-instanciacion.pdf'), false);
  assert.equal(almacenSegunA.get('radicados/doble-instanciacion/final.pdf')?.etapa, 'final');

  // Limpiar desde A vacía lo que ve B.
  stubA.__limpiarAlmacenFalso();
  assert.equal(stubB.__inspeccionarAlmacenFalso().size, 0);
});

afterEach(async () => {
  // node --test corre cada archivo en su propio proceso, así que este estado
  // global no puede filtrarse a otros archivos de la suite; aun así se limpia
  // para no dejar residuo entre los tests de ESTE archivo.
  const [stubAuth, stubStorage] = await Promise.all([
    import(URL_STUB_AUTH),
    import(URL_STUB_STORAGE),
  ]);
  stubAuth.__clearSession();
  stubStorage.__limpiarAlmacenFalso();
});
