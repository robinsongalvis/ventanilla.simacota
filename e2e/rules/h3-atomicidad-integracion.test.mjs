/**
 * Integración H3 (Bloque 2) — atomicidad consecutivo↔documento contra el
 * EMULADOR REAL de Firestore (no mocks). Se ejecuta en CI dentro del job
 * `laboratorio-emulador` (glob `test:rules`, Java 21); no corre localmente
 * (Java 8). Valida la garantía transaccional real que sostiene el fix de H3 en
 * las rutas Admin SDK: contador y documento se confirman todo-o-nada, y bajo
 * concurrencia real no hay números repetidos ni huecos.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROYECTO = 'demo-ventanilla-lab';
let app;
let db;

before(() => {
  // emulators:exec fija FIRESTORE_EMULATOR_HOST → el Admin SDK apunta al emulador.
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'FIRESTORE_EMULATOR_HOST debe estar definido (emulator).');
  app = initializeApp({ projectId: PROYECTO }, `h3-integracion-${Date.now()}`);
  db = getFirestore(app);
});

after(async () => { await deleteApp(app); });

const COUNTER = 'counters/radicados-2999'; // año aislado para no chocar con otros tests
const COL = 'ventanilla_radicados';

beforeEach(async () => {
  // Estado limpio: borra el contador y los docs de prueba del año aislado.
  await db.doc(COUNTER).delete().catch(() => {});
  const prev = await db.collection(COL).where('control.consecutivo', '>=', 0).get().catch(() => ({ docs: [] }));
  await Promise.all(prev.docs
    .filter((d) => d.id.includes('-2999-'))
    .map((d) => d.ref.delete()));
});

/** Asigna consecutivo + escribe el radicado en UNA transacción (patrón del fix). */
async function radicarAtomico({ fallar = false } = {}) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(db.doc(COUNTER));
    const consecutivo = Number(snap.data()?.ultimo ?? 0) + 1;
    const radicadoId = `1-110-2999-${String(consecutivo).padStart(8, '0')}`;
    if (fallar) throw new Error('fallo simulado durante la construcción del radicado');
    tx.set(db.doc(COUNTER), { ultimo: consecutivo, anio: 2999 }, { merge: true });
    tx.set(db.doc(`${COL}/${radicadoId}`), { control: { consecutivo }, radicadoId });
    return { consecutivo, radicadoId };
  });
}

test('un fallo dentro de la transacción NO avanza el contador (rollback real)', async () => {
  await assert.rejects(() => radicarAtomico({ fallar: true }));
  const snap = await db.doc(COUNTER).get();
  assert.equal(Number(snap.data()?.ultimo ?? 0), 0, 'el contador no debe avanzar si la tx aborta');
  const docs = await db.collection(COL).get();
  assert.equal(docs.docs.filter((d) => d.id.includes('-2999-')).length, 0, 'no debe existir radicado');
});

test('éxito: contador y documento se confirman juntos', async () => {
  const { radicadoId } = await radicarAtomico();
  const snap = await db.doc(COUNTER).get();
  assert.equal(Number(snap.data()?.ultimo), 1);
  const doc = await db.doc(`${COL}/${radicadoId}`).get();
  assert.ok(doc.exists, 'el radicado debe existir');
});

test('concurrencia real: N radicaciones simultáneas → sin repetidos ni huecos', async () => {
  const N = 5;
  const resultados = await Promise.all(Array.from({ length: N }, () => radicarAtomico()));
  const consecutivos = resultados.map((r) => r.consecutivo).sort((a, b) => a - b);
  assert.deepEqual(consecutivos, [1, 2, 3, 4, 5], 'consecutivos únicos y contiguos');
  const snap = await db.doc(COUNTER).get();
  assert.equal(Number(snap.data()?.ultimo), N, 'el contador refleja exactamente N');
  const docs = await db.collection(COL).get();
  assert.equal(docs.docs.filter((d) => d.id.includes('-2999-')).length, N, 'N documentos, sin huecos');
});
