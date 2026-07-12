/**
 * scripts/laboratorio/medir-escala-lectura.mjs
 *
 * DEMOSTRACIÓN DE ESCALA — lectura de radicados (ADR-0011, incremento 2B).
 *
 * Hermano de `medir-linea-base-lectura.mjs`. Responde con evidencia la
 * pregunta del propietario: *"¿puede la plataforma crecer durante años sin
 * que el rendimiento se degrade de forma perceptible?"*.
 *
 * Mide, contra STAGE y a VOLÚMENES CRECIENTES (N = 50, 200, 800 por defecto),
 * dos patrones de lectura sobre la misma colección:
 *   - SIN_COTA  (línea base O(N)):  `.orderBy(fechaRadicado desc).get()` — lee
 *     TODA la colección; es el patrón que mide `medir-linea-base-lectura.mjs`.
 *   - ACOTADA   (meta de 2A):       `.orderBy(fechaRadicado desc).limit(pageSize).get()`
 *     — lee ≤ pageSize documentos, independiente de N.
 * Muestra que ACOTADA se mantiene ~plana mientras SIN_COTA crece con N.
 *
 * MÉTODO (idéntico patrón namespaced/anti-prod que la línea base):
 *   1. Para cada N ascendente, siembra documentos sintéticos hasta alcanzar N
 *      totales (Admin SDK directo). Clones de la forma real de un radicado,
 *      marcados `isTest`+`excludeFromMetrics`+`laboratorio.generador` propio,
 *      con `control.consecutivo` fuera de banda (800000+).
 *   2. Ejecuta ambas consultas `--runs` veces (1 fría + calientes) y reporta
 *      docsLeidos + latencia p50/p95.
 *   3. AUTOLIMPIEZA al terminar (siempre, salvo `--mantener`): borra TODO lo
 *      sembrado por este generador; deja stage como lo encontró. `--solo-limpiar`
 *      para una limpieza manual.
 *
 * GUARDA ANTI-PRODUCCIÓN: aborta si `.env.stage` apunta a producción.
 *
 * Uso:
 *   node scripts/laboratorio/medir-escala-lectura.mjs [--volumenes=50,200,800] [--runs=10] [--pageSize=100] [--json]
 *   node scripts/laboratorio/medir-escala-lectura.mjs --solo-limpiar
 *
 * Requiere: .env.stage con FIREBASE_SERVICE_ACCOUNT. NO requiere servidor.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const RADICADO_PROTEGIDO = '1-110-2026-00000001';
const GENERADOR = 'medicion-escala-2b';
const VERSION_GENERADOR = '1.0.0';
const CONSECUTIVO_BASE = 800000; // fuera de banda; distinto del generador de línea base (900000+)
const ENV_STAGE = resolve('.env.stage');

function parseArgs(argv) {
  const args = { volumenes: [50, 200, 800], runs: 10, pageSize: 100, soloLimpiar: false, mantener: false, json: false };
  for (const a of argv) {
    if (a === '--solo-limpiar') args.soloLimpiar = true;
    else if (a === '--mantener') args.mantener = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--volumenes=')) args.volumenes = a.split('=')[1].split(',').map(Number).filter((n) => n > 0).sort((x, y) => x - y);
    else if (a.startsWith('--runs=')) args.runs = Number(a.split('=')[1]);
    else if (a.startsWith('--pageSize=')) args.pageSize = Number(a.split('=')[1]);
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

async function contar() {
  return (await db.collection('ventanilla_radicados').count().get()).data().count;
}

async function limpiar() {
  const snap = await db.collection('ventanilla_radicados')
    .where('laboratorio.generador', '==', GENERADOR).get();
  let borrados = 0;
  const commits = [];
  let batch = db.batch();
  let enBatch = 0;
  for (const docu of snap.docs) {
    if (docu.id === RADICADO_PROTEGIDO) continue;
    batch.delete(docu.ref);
    enBatch += 1;
    borrados += 1;
    if (enBatch === 450) { commits.push(batch.commit()); batch = db.batch(); enBatch = 0; }
  }
  if (enBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);
  return borrados;
}

async function sembrarHasta(volumenObjetivo, plantilla) {
  const totalActual = await contar();
  const faltan = volumenObjetivo - totalActual;
  if (faltan <= 0) return { total: totalActual, sembrados: 0 };

  const yaSembrados = (await db.collection('ventanilla_radicados')
    .where('laboratorio.generador', '==', GENERADOR).count().get()).data().count;

  const ahora = Date.now();
  const commits = [];
  let batch = db.batch();
  let enBatch = 0;
  for (let k = 0; k < faltan; k += 1) {
    const i = yaSembrados + k;
    const consecutivo = CONSECUTIVO_BASE + i;
    const radicadoId = `1-110-2026-${String(consecutivo).padStart(8, '0')}`;
    const fechaRadicado = new Date(ahora - i * 3600_000).toISOString();
    const doc = {
      ...plantilla,
      radicadoId,
      isTest: true,
      excludeFromMetrics: true,
      laboratorio: { generador: GENERADOR, version: VERSION_GENERADOR, indice: i },
      control: { ...plantilla.control, radicadoId, consecutivo, fechaRadicado },
      solicitante: {
        ...plantilla.solicitante,
        nombreCompleto: `Sintético Escala ${i}`,
        numeroDocumento: String(1000000000 + i),
        email: null,
        telefonoMovil: null,
        telefono: null,
      },
    };
    batch.set(db.collection('ventanilla_radicados').doc(radicadoId), doc);
    enBatch += 1;
    if (enBatch === 450) { commits.push(batch.commit()); batch = db.batch(); enBatch = 0; }
  }
  if (enBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);
  return { total: totalActual + faltan, sembrados: faltan };
}

/** SIN_COTA — patrón O(N): idéntico a busqueda-avanzada/route.ts + línea base. */
async function medirSinCota() {
  const t0 = Date.now();
  const snap = await db.collection('ventanilla_radicados').orderBy('control.fechaRadicado', 'desc').get();
  return { docsLeidos: snap.size, latenciaMs: Date.now() - t0 };
}

/** ACOTADA — meta 2A: cursor/limit server-side, lee ≤ pageSize. */
async function medirAcotada(pageSize) {
  const t0 = Date.now();
  const snap = await db.collection('ventanilla_radicados').orderBy('control.fechaRadicado', 'desc').limit(pageSize).get();
  return { docsLeidos: snap.size, latenciaMs: Date.now() - t0 };
}

async function medirPatron(fn, runs) {
  await fn(); // fría (descartada)
  const latencias = [];
  let docsLeidos = 0;
  for (let i = 0; i < runs; i += 1) {
    const r = await fn();
    latencias.push(r.latenciaMs);
    docsLeidos = r.docsLeidos;
  }
  latencias.sort((a, b) => a - b);
  return { docsLeidos, p50: percentil(latencias, 50), p95: percentil(latencias, 95) };
}

async function main() {
  if (args.soloLimpiar) {
    const b = await limpiar();
    console.log(`🧹 Limpieza: ${b} documentos (${GENERADOR}) eliminados. Total ahora: ${await contar()}.`);
    process.exit(0);
  }

  const baseInicial = await contar();
  console.log(`Proyecto: ${sa.project_id} · volumen inicial en stage: ${baseInicial} · pageSize acotado: ${args.pageSize}`);

  const plantillaSnap = await db.collection('ventanilla_radicados').limit(1).get();
  if (plantillaSnap.empty) {
    console.error('⛔ No hay ningún radicado en stage para usar de plantilla.');
    process.exit(1);
  }
  const plantilla = plantillaSnap.docs[0].data();

  const filas = [];
  try {
    for (const N of args.volumenes) {
      const { total } = await sembrarHasta(N, plantilla);
      console.log(`\n▶ N = ${N} (volumen real: ${total}) — midiendo ${args.runs} corridas por patrón…`);
      const sinCota = await medirPatron(medirSinCota, args.runs);
      const acotada = await medirPatron(() => medirAcotada(args.pageSize), args.runs);
      const fila = { N: total, sinCota, acotada };
      filas.push(fila);
      console.log(`  SIN_COTA → docsLeidos: ${sinCota.docsLeidos} · p50 ${sinCota.p50}ms · p95 ${sinCota.p95}ms`);
      console.log(`  ACOTADA  → docsLeidos: ${acotada.docsLeidos} · p50 ${acotada.p50}ms · p95 ${acotada.p95}ms`);
    }

    console.log('\n══════════ DEMOSTRACIÓN DE ESCALA — LECTURA DE RADICADOS (ADR-0011, 2B) ══════════');
    console.log('| N (total) | SIN_COTA docs | SIN_COTA p95 | ACOTADA docs | ACOTADA p95 |');
    console.log('|---|---|---|---|---|');
    for (const f of filas) {
      console.log(`| ${f.N} | ${f.sinCota.docsLeidos} | ${f.sinCota.p95}ms | ${f.acotada.docsLeidos} | ${f.acotada.p95}ms |`);
    }
    if (args.json) {
      console.log('\nJSON:', JSON.stringify({ proyecto: sa.project_id, pageSize: args.pageSize, runs: args.runs, filas }));
    }
  } finally {
    if (!args.mantener) {
      const b = await limpiar();
      const finalTotal = await contar();
      console.log(`\n🧹 Autolimpieza: ${b} documentos sintéticos eliminados. Total final: ${finalTotal} (inicial: ${baseInicial}).`);
      if (finalTotal !== baseInicial) {
        console.error(`⚠ ATENCIÓN: el total final (${finalTotal}) no coincide con el inicial (${baseInicial}). Revisar residuos.`);
      }
    } else {
      console.log(`\nℹ --mantener: los documentos sintéticos (${GENERADOR}) quedan en stage. Limpia con --solo-limpiar.`);
    }
  }
  process.exit(0);
}

main().catch(async (err) => {
  console.error('⛔ Demostración de escala falló:', err instanceof Error ? err.message : err);
  try { const b = await limpiar(); console.error(`🧹 Limpieza de emergencia: ${b} documentos eliminados.`); } catch { /* nada */ }
  process.exit(1);
});
