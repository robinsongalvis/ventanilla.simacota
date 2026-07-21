/**
 * e2e/consultar-sin-marcar.mjs — SOLO LECTURA.
 * Cuenta cuántos radicados '[E2E-AUTO] ...' en STAGE existen sin
 * `isTest: true`, para dimensionar el barrido retroactivo antes de
 * ejecutarlo (e2e/marcar-retroactivo.mjs, que sí escribe). No modifica
 * ningún documento.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const env = Object.fromEntries(
  readFileSync(resolve('.env.stage'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
if (sa.project_id === PROYECTO_PROD) { console.error('⛔ GUARDA prod. Abortado.'); process.exit(1); }

initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const PREFIJO = '[E2E-AUTO]';
const snap = await db.collection('ventanilla_radicados')
  .where('detalle.asunto', '>=', PREFIJO)
  .where('detalle.asunto', '<', PREFIJO + String.fromCharCode(0xf8ff))
  .get();

const sinMarcar = snap.docs.filter((d) => d.data().isTest !== true);
console.log(`Proyecto: ${sa.project_id}`);
console.log(`Total '[E2E-AUTO]': ${snap.size}`);
console.log(`Sin isTest=true: ${sinMarcar.length}`);
if (sinMarcar.length > 0) console.log(sinMarcar.map((d) => d.id).join('\n'));
