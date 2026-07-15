/**
 * scripts/laboratorio/limpiar-stage.mjs
 *
 * Limpieza REPRODUCIBLE, AUTOMATIZADA y TRAZABLE del entorno STAGE.
 * Elimina los radicados sintéticos acumulados por el auditor funcional
 * (`laboratorio.generador === 'playwright-e2e'`) para que STAGE represente
 * condiciones reales de operación sin convertirse en un factor que distorsione
 * las mediciones (deuda R11 / estabilidad E2E).
 *
 * QUÉ BORRA:  solo documentos con `laboratorio.generador === 'playwright-e2e'`
 *             (recursiveDelete → arrastra la subcolección `trazabilidad`).
 * QUÉ PRESERVA (garantizado):
 *   - El radicado protegido de auditoría `1-110-2026-00000001`.
 *   - La Alcaldía Sintética (`laboratorio.generador === 'alcaldia-sintetica'`),
 *     que tiene su propio `--limpiar` en alcaldia-sintetica.
 *   - Cualquier radicado sin ese generador.
 *
 * GUARDA ANTI-PRODUCCIÓN (ADR-0002): aborta si el proyecto es producción.
 *
 * Uso:
 *   node scripts/laboratorio/limpiar-stage.mjs                 # dry-run (default): solo reporta
 *   node scripts/laboratorio/limpiar-stage.mjs --execute       # ejecuta el borrado
 *   node scripts/laboratorio/limpiar-stage.mjs --generador X   # otro namespace (default playwright-e2e)
 *
 * TRAZABILIDAD: imprime un resumen (total antes, a borrar, preservados por
 * categoría, total después) y escribe un registro en docs/auditorias/.
 */
import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const PROTEGIDO = '1-110-2026-00000001';
const COL = 'ventanilla_radicados';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const generadorIdx = args.indexOf('--generador');
const GENERADOR = generadorIdx >= 0 && args[generadorIdx + 1] ? args[generadorIdx + 1] : 'playwright-e2e';

const env = Object.fromEntries(
  readFileSync(resolve('.env.stage'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

if (sa.project_id === PROYECTO_PROD) {
  console.error('⛔ GUARDA: este script NO puede ejecutarse contra producción. Abortado.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const totalAntes = (await db.collection(COL).count().get()).data().count;
const objetivo = await db.collection(COL).where('laboratorio.generador', '==', GENERADOR).get();
const aBorrar = objetivo.docs.filter((d) => d.id !== PROTEGIDO); // salvaguarda explícita del protegido
const sinteticos = (await db.collection(COL).where('laboratorio.generador', '==', 'alcaldia-sintetica').count().get()).data().count;

console.log(`Proyecto:            ${sa.project_id}`);
console.log(`Total radicados:     ${totalAntes}`);
console.log(`Generador objetivo:  ${GENERADOR}`);
console.log(`A borrar:            ${aBorrar.length}`);
console.log(`Preservados:         Alcaldía Sintética=${sinteticos}, protegido ${PROTEGIDO}=intacto, resto sin tocar`);

if (!EXECUTE) {
  console.log('\n[DRY-RUN] No se borró nada. Ejecuta con --execute para aplicar.');
  process.exit(0);
}

let borrados = 0;
for (const doc of aBorrar) {
  await db.recursiveDelete(doc.ref);
  borrados += 1;
}
const totalDespues = (await db.collection(COL).count().get()).data().count;
const protegidoOk = (await db.doc(`${COL}/${PROTEGIDO}`).get()).exists;

console.log(`\n✔ Borrados: ${borrados}`);
console.log(`✔ Total después: ${totalDespues} (protegido intacto: ${protegidoOk})`);

// Registro trazable
mkdirSync(resolve('docs/auditorias'), { recursive: true });
const linea = `${new Date().toISOString()} | limpiar-stage | proyecto=${sa.project_id} | generador=${GENERADOR} | borrados=${borrados} | antes=${totalAntes} despues=${totalDespues} | protegido_ok=${protegidoOk}\n`;
appendFileSync(resolve('docs/auditorias/limpieza-stage.log'), linea);
console.log('✔ Registro trazable en docs/auditorias/limpieza-stage.log');
process.exit(0);
