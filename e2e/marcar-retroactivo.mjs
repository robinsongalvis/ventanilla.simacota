/**
 * e2e/marcar-retroactivo.mjs
 *
 * Barrido único (no forma parte de la suite ni de CI): marca `isTest: true`
 * en los radicados de STAGE que el auditor funcional Playwright creó ANTES
 * de que existiera el mecanismo de marcado automático (e2e/fixtures.ts +
 * e2e/lab-admin.ts). Hallazgo de firestore-datos, 2026-07-10 — ver
 * docs/laboratorio/FASE2_BITACORA.md.
 *
 * Localiza por prefijo de asunto '[E2E-AUTO]' (rango Firestore, ya que no
 * hay "contains" nativo) y por eso SOLO encuentra radicados creados con
 * `asuntoUnico()` de e2e/helpers.ts — que es como esta suite los crea
 * desde su primera versión.
 *
 * GUARDA ANTI-PRODUCCIÓN (ADR-0002): se niega a ejecutar contra el
 * proyecto de producción. Sin excepciones. Réplica del mismo patrón que
 * scripts/laboratorio/seed-funcionarios-stage.mjs.
 *
 * Uso: node e2e/marcar-retroactivo.mjs
 * Requiere: .env.stage con FIREBASE_SERVICE_ACCOUNT del proyecto stage.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const ENV_STAGE = resolve('.env.stage');

const env = Object.fromEntries(
  readFileSync(ENV_STAGE, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

if (sa.project_id === PROYECTO_PROD) {
  console.error('⛔ GUARDA: este script NO puede ejecutarse contra producción. Abortado.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const PREFIJO = '[E2E-AUTO]';
const LIMITE_SUPERIOR = PREFIJO + String.fromCharCode(0xf8ff);

const snap = await db
  .collection('ventanilla_radicados')
  .where('detalle.asunto', '>=', PREFIJO)
  .where('detalle.asunto', '<', LIMITE_SUPERIOR)
  .get();

console.log(`Proyecto: ${sa.project_id}`);
console.log(`Radicados con asunto '${PREFIJO}...' encontrados: ${snap.size}`);

let yaEstaban = 0;
const marcados = [];
for (const doc of snap.docs) {
  const data = doc.data();
  if (data.isTest === true) { yaEstaban += 1; continue; }
  await doc.ref.set(
    { isTest: true, laboratorio: { generador: 'playwright-e2e' } },
    { merge: true },
  );
  marcados.push(doc.id);
}

console.log(`Ya estaban marcados: ${yaEstaban}`);
console.log(`Marcados en esta corrida: ${marcados.length}`);
if (marcados.length > 0) console.log(marcados.join('\n'));
