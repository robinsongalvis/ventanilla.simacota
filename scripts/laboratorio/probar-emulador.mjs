/**
 * scripts/laboratorio/probar-emulador.mjs
 *
 * Sonda mínima del emulador de Firestore (Fase 1 del laboratorio, ADR-0002).
 * Se ejecuta dentro de `firebase emulators:exec`, que arranca el emulador con
 * las reglas del repositorio (si las reglas no compilan, el emulador no arranca
 * y el CI falla — esa es la primera compuerta). La sonda verifica que el
 * emulador responde: escribe, lee y borra un documento canario.
 *
 * No requiere credenciales: FIRESTORE_EMULATOR_HOST la inyecta emulators:exec.
 */
import admin from 'firebase-admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('⛔ Esta sonda solo corre contra el emulador (FIRESTORE_EMULATOR_HOST ausente).');
  process.exit(1);
}

admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-ventanilla-lab' });
const db = admin.firestore();

const ref = db.doc('laboratorio_canario/sonda');
await ref.set({ ok: true, ts: new Date().toISOString() });
const leido = await ref.get();
if (!leido.exists || leido.data().ok !== true) {
  console.error('✘ El canario no se pudo leer del emulador.');
  process.exit(1);
}
await ref.delete();
console.log('✔ Emulador de Firestore operativo: escritura, lectura y borrado del canario OK.');
process.exit(0);
