/**
 * scripts/laboratorio/medir-linea-base-lectura.mjs
 *
 * MEDICIÓN DE LÍNEA BASE — lectura de radicados (ADR-0011, incremento 2B).
 *
 * Mide, contra STAGE, el costo real de la consulta que hoy usa
 * `app/api/radicados/busqueda-avanzada/route.ts` (línea 86-94): lee TODA la
 * colección `ventanilla_radicados` con `.orderBy('control.fechaRadicado',
 * 'desc').get()`, sin `limit`. El propósito NO es corregir el patrón (eso es
 * 2A) sino CAPTURAR EL NÚMERO antes de la mejora (Principio 13), para que la
 * ganancia de 2A se demuestre con dato.
 *
 * Método:
 *   1. Siembra un volumen SINTÉTICO CONOCIDO y namespaced (Admin SDK directo,
 *      sin pasar por el endpoint público) hasta alcanzar `--volumen` documentos
 *      totales en la colección. Los documentos sintéticos:
 *        - clonan la forma real de un radicado existente (tamaño de documento
 *          representativo, no un stub vacío),
 *        - se marcan `isTest: true` + `laboratorio.generador` propio (mismo
 *          patrón namespaced de `alcaldia-sintetica.ts`), así que la búsqueda
 *          real los excluye de resultados (los filtra en memoria DESPUÉS de
 *          leerlos — es justo ese costo de lectura previo el que se mide),
 *        - usan un rango de `control.consecutivo` fuera de banda (900000+)
 *          para no colisionar con el contador real ni con datos de otros
 *          generadores del laboratorio.
 *   2. Ejecuta la MISMA consulta (idéntica forma a la del endpoint) N veces:
 *      1 corrida "fría" (incluye setup de conexión del Admin SDK, se reporta
 *      aparte) + `--runs` corridas "calientes" para calcular p50/p95/promedio.
 *   3. Por defecto limpia los documentos sembrados al terminar (namespaced,
 *      nunca toca el radicado protegido ni fixtures de otros generadores) —
 *      usa `--mantener` para dejarlos y poder re-medir en las mismas
 *      condiciones después de 2A (comparación con el mismo volumen).
 *
 * GUARDA ANTI-PRODUCCIÓN (mismo patrón que alcaldia-sintetica.ts): aborta si
 * el service account de `.env.stage` apunta al proyecto de producción.
 *
 * Uso:
 *   npx tsx --tsconfig tsconfig.json scripts/laboratorio/medir-linea-base-lectura.mjs
 *   node scripts/laboratorio/medir-linea-base-lectura.mjs [--volumen=210] [--runs=20] [--mantener]
 *   node scripts/laboratorio/medir-linea-base-lectura.mjs --solo-limpiar
 *
 * Requiere: .env.stage con FIREBASE_SERVICE_ACCOUNT (ver
 * scripts/laboratorio/instalar-service-account.mjs). NO requiere servidor
 * corriendo (Admin SDK directo, sin HTTP) — a diferencia de
 * alcaldia-sintetica.ts, que sí ejercita el camino público.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const RADICADO_PROTEGIDO = '1-110-2026-00000001';
const GENERADOR = 'medicion-linea-base-2b';
const VERSION_GENERADOR = '1.0.0';
const CONSECUTIVO_BASE = 900000; // fuera de banda: nunca colisiona con el contador real
const ENV_STAGE = resolve('.env.stage');

function parseArgs(argv) {
  const args = { volumen: 210, runs: 20, limpiar: false, soloLimpiar: false, mantener: false };
  for (const a of argv) {
    if (a === '--solo-limpiar') args.soloLimpiar = true;
    else if (a === '--limpiar') args.limpiar = true;
    else if (a === '--mantener') args.mantener = true;
    else if (a.startsWith('--volumen=')) args.volumen = Number(a.split('=')[1]);
    else if (a.startsWith('--runs=')) args.runs = Number(a.split('=')[1]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

function cargarEnvStage() {
  return Object.fromEntries(
    readFileSync(ENV_STAGE, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

const env = cargarEnvStage();
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

if (sa.project_id === PROYECTO_PROD) {
  console.error('⛔ GUARDA: este script NO puede ejecutarse contra producción. Abortado.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

function percentil(valoresAscendentes, p) {
  const idx = Math.min(valoresAscendentes.length - 1, Math.max(0, Math.ceil((p / 100) * valoresAscendentes.length) - 1));
  return valoresAscendentes[idx];
}

async function limpiar() {
  const snap = await db.collection('ventanilla_radicados')
    .where('laboratorio.generador', '==', GENERADOR).get();
  let borrados = 0;
  const batches = [];
  let batch = db.batch();
  let enBatch = 0;
  for (const docu of snap.docs) {
    if (docu.id === RADICADO_PROTEGIDO) continue; // nunca, aunque no debería coincidir
    batch.delete(docu.ref);
    enBatch += 1;
    borrados += 1;
    if (enBatch === 450) {
      batches.push(batch.commit());
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) batches.push(batch.commit());
  await Promise.all(batches);
  console.log(`🧹 Limpieza: ${borrados} documentos sintéticos de medición (${GENERADOR}) eliminados.`);
  return borrados;
}

async function sembrarHasta(volumenObjetivo) {
  const actual = await db.collection('ventanilla_radicados').count().get();
  const totalActual = actual.data().count;
  const faltan = volumenObjetivo - totalActual;

  if (faltan <= 0) {
    console.log(`ℹ Volumen actual (${totalActual}) ya alcanza el objetivo (${volumenObjetivo}); no se siembra nada.`);
    return { totalActual, sembrados: 0 };
  }

  const plantillaSnap = await db.collection('ventanilla_radicados').limit(1).get();
  if (plantillaSnap.empty) {
    throw new Error('No hay ningún radicado existente en stage para usar como plantilla de forma/tamaño.');
  }
  const plantilla = plantillaSnap.docs[0].data();

  console.log(`▶ Sembrando ${faltan} documentos sintéticos (namespace ${GENERADOR}) para alcanzar volumen ${volumenObjetivo}…`);

  const ahora = Date.now();
  let batch = db.batch();
  let enBatch = 0;
  const commits = [];

  for (let i = 0; i < faltan; i += 1) {
    const consecutivo = CONSECUTIVO_BASE + i;
    const radicadoId = `1-110-2026-${String(consecutivo).padStart(8, '0')}`;
    const fechaRadicado = new Date(ahora - i * 3600_000).toISOString(); // espaciados 1h hacia atrás
    const doc = {
      ...plantilla,
      radicadoId,
      isTest: true,
      excludeFromMetrics: true,
      laboratorio: { generador: GENERADOR, version: VERSION_GENERADOR, indice: i },
      control: {
        ...plantilla.control,
        radicadoId,
        consecutivo,
        fechaRadicado,
      },
      solicitante: {
        ...plantilla.solicitante,
        nombreCompleto: `Sintético Medición Base ${i}`,
        numeroDocumento: String(1000000000 + i),
        email: null,
        telefonoMovil: null,
        telefono: null,
      },
    };
    const ref = db.collection('ventanilla_radicados').doc(radicadoId);
    batch.set(ref, doc);
    enBatch += 1;
    if (enBatch === 450) {
      commits.push(batch.commit());
      batch = db.batch();
      enBatch = 0;
    }
  }
  if (enBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);

  console.log(`✔ Sembrados ${faltan} documentos sintéticos.`);
  return { totalActual: totalActual + faltan, sembrados: faltan };
}

/** Consulta IDÉNTICA en forma a `busqueda-avanzada/route.ts:86-94` (rol sin
 *  restricción de tenant — caso ADMIN/RECEPCIONISTA/CONTROL_INTERNO, el que
 *  lee más documentos). */
async function ejecutarConsultaMedida() {
  const t0 = Date.now();
  const query = db.collection('ventanilla_radicados').orderBy('control.fechaRadicado', 'desc');
  const snap = await query.get();
  const t1 = Date.now();
  return { docsLeidos: snap.size, latenciaMs: t1 - t0 };
}

async function medir(runs) {
  console.log(`\n▶ Corrida fría (incluye setup de conexión del Admin SDK)…`);
  const fria = await ejecutarConsultaMedida();
  console.log(`  docs leídos: ${fria.docsLeidos} · latenciaMs (fría): ${fria.latenciaMs}`);

  console.log(`\n▶ ${runs} corridas calientes…`);
  const latencias = [];
  let docsLeidos = fria.docsLeidos;
  for (let i = 0; i < runs; i += 1) {
    const r = await ejecutarConsultaMedida();
    latencias.push(r.latenciaMs);
    docsLeidos = r.docsLeidos;
    process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${runs}] ${r.latenciaMs}ms\n`);
  }
  latencias.sort((a, b) => a - b);
  const promedio = latencias.reduce((a, b) => a + b, 0) / latencias.length;
  const p50 = percentil(latencias, 50);
  const p95 = percentil(latencias, 95);
  const min = latencias[0];
  const max = latencias[latencias.length - 1];

  console.log('\n══════════ LÍNEA BASE — LECTURA DE RADICADOS (ADR-0011) ══════════');
  console.log(`docs leídos por consulta: ${docsLeidos} (= tamaño total de la colección, patrón O(N))`);
  console.log(`latenciaMs — fría: ${fria.latenciaMs} | min: ${min} | p50: ${p50} | p95: ${p95} | max: ${max} | promedio: ${promedio.toFixed(1)}`);

  return { docsLeidos, fria: fria.latenciaMs, min, p50, p95, max, promedio, runs, muestras: latencias };
}

async function main() {
  if (args.soloLimpiar) {
    await limpiar();
    process.exit(0);
  }

  const { totalActual } = await sembrarHasta(args.volumen);
  const resultado = await medir(args.runs);

  console.log(`\nProyecto: ${sa.project_id} · volumen objetivo: ${args.volumen} · volumen real medido: ${totalActual}`);
  console.log('\nJSON:', JSON.stringify({ proyecto: sa.project_id, volumenObjetivo: args.volumen, volumenReal: totalActual, ...resultado }));

  if (!args.mantener) {
    await limpiar();
  } else {
    console.log(`ℹ --mantener: los ${GENERADOR} documentos sintéticos quedan en stage para re-medir después de 2A.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('⛔ Medición de línea base falló:', err instanceof Error ? err.message : err);
  process.exit(1);
});
