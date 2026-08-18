/**
 * scripts/backups/verificar-restauracion.mjs
 *
 * Comprueba que una base RESTAURADA sirve de verdad.
 *
 * POR QUÉ NO BASTA CON QUE EL IMPORT DIGA "SUCCESSFUL". Eso solo acredita
 * que los bytes se movieron. Un ensayo de restauración que se conforme con
 * eso da un falso verde: el día que haya que restaurar de verdad, se
 * descubriría que faltan colecciones o que los consecutivos legales
 * quedaron con huecos — cuando ya no hay a quién preguntarle.
 *
 * QUÉ COMPRUEBA:
 *  1. Que las colecciones que sostienen el servicio EXISTEN y no están vacías.
 *  2. Que los consecutivos legales no tienen DUPLICADOS, con el MISMO
 *     detector que usa la auditoría diaria — no una copia.
 *  3. Que ninguna serie con contador en marcha se quedó sin NINGÚN
 *     documento del año, que es la firma de una restauración que perdió datos.
 *
 * QUÉ **NO** COMPRUEBA, dicho explícitamente para que nadie lea de más en un
 * veredicto verde: no detecta pérdidas PARCIALES. Los huecos no se tratan
 * como fallo porque en producción también existen por causas legítimas (R3
 * del registro de riesgos), y no hay aquí un oráculo del conteo real de
 * producción contra el cual comparar. Un verde dice «las colecciones tienen
 * datos y los consecutivos son coherentes», no «no falta ni un documento».
 *
 * SOLO LECTURA. Nunca escribe. Está pensado para correr contra la base
 * DESECHABLE del ensayo (`drill-*` en stage), jamás contra producción; el
 * llamador es quien elige la base con `--base`.
 *
 * Uso:
 *   node scripts/backups/verificar-restauracion.mjs --proyecto <id> --base <db> [--anio AAAA]
 *
 * `--anio` es el año del RESPALDO restaurado. Sin él se usa el año en curso,
 * que es correcto solo mientras respaldo y corrida caigan en el mismo año:
 * un ensayo disparado en enero sobre un respaldo de diciembre verificaría un
 * año sin documentos y saldría verde sin haber comprobado nada.
 */
import { getFirestore } from 'firebase-admin/firestore';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { huecosDe, duplicadosDe, consecutivoDeId, perteneceAlAnio, COLECCION_POR_SERIE } from '../laboratorio/detectar-consecutivos-fantasma.mjs';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';

/**
 * Colecciones cuya AUSENCIA invalida la restauración. No es la lista
 * completa de la base: son las que, si faltan, el servicio no puede
 * atender a un ciudadano.
 */
const COLECCIONES_CRITICAS = ['ventanilla_radicados', 'expedientes', 'counters'];

function arg(nombre) {
  const i = process.argv.indexOf(nombre);
  return i === -1 ? undefined : process.argv[i + 1];
}

const proyecto = arg('--proyecto');
const base = arg('--base');
const anioArg = arg('--anio');

if (!proyecto || !base) {
  console.error('Uso: node scripts/backups/verificar-restauracion.mjs --proyecto <id> --base <db> [--anio AAAA]');
  process.exit(1);
}

// Un `--anio` mal formado se rechaza en vez de degradar en silencio al año en
// curso: si el llamador se molestó en pasarlo, verificar otro año sería
// exactamente el falso verde que este parámetro existe para evitar.
if (anioArg !== undefined && !/^\d{4}$/.test(anioArg)) {
  console.error(`--anio debe ser un año de cuatro cifras; se recibió "${anioArg}".`);
  process.exit(1);
}
if (proyecto === PROYECTO_PROD) {
  console.error('⛔ GUARDA: este verificador es para la base de ENSAYO. No se ejecuta contra producción.');
  process.exit(2);
}

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: proyecto });
}
const db = getFirestore(base);

const problemas = [];
const lineas = [];

lineas.push(`Proyecto: ${proyecto} · Base: ${base}`);
lineas.push('');

// ── 1. Colecciones críticas ──────────────────────────────────────────
lineas.push('COLECCIONES:');
const conteos = {};
for (const coleccion of COLECCIONES_CRITICAS) {
  const snap = await db.collection(coleccion).count().get();
  const n = snap.data().count;
  conteos[coleccion] = n;
  lineas.push(`  ${coleccion.padEnd(24)} ${n} documento(s)`);
  if (n === 0) {
    problemas.push(`La colección "${coleccion}" quedó VACÍA tras la restauración.`);
  }
}

// ── 2. Continuidad de los consecutivos legales ───────────────────────
//
// Es la propiedad que de verdad importa para una entidad pública: un
// consecutivo con huecos o repetidos es un defecto archivístico (Acuerdo
// AGN 060/2001), y si la restauración los introduce, restaurar sería peor
// que no restaurar.
lineas.push('');
lineas.push('CONSECUTIVOS:');
const anio = anioArg ? Number(anioArg) : new Date().getUTCFullYear();
lineas.push(`  (año verificado: ${anio}${anioArg ? ' — tomado del respaldo' : ' — año en curso, no se indicó --anio'})`);
for (const [serie, coleccion] of Object.entries(COLECCION_POR_SERIE)) {
  const counterSnap = await db.doc(`counters/${serie}-${anio}`).get();
  const ultimo = Number(counterSnap.data()?.ultimo ?? 0);

  const docs = await db.collection(coleccion).select().get();
  const presentes = docs.docs
    .map((d) => d.id)
    .filter((id) => perteneceAlAnio(id, anio))
    .map((id) => consecutivoDeId(id))
    .filter((n) => n !== null);

  const huecos = huecosDe(ultimo, new Set(presentes));
  const duplicados = duplicadosDe(presentes);

  lineas.push(`  ${serie.padEnd(12)} contador=${ultimo} · documentos=${presentes.length} · huecos=${huecos.length} · duplicados=${duplicados.length}`);
  if (duplicados.length > 0) {
    problemas.push(`La serie "${serie}" tiene consecutivos DUPLICADOS tras la restauración: ${duplicados.join(', ')}.`);
  }
  // Los huecos NO se tratan como fallo: en producción también existen por
  // causas legítimas (un radicado que no completó su adjunto, R3 del
  // registro de riesgos). Lo que delataría una restauración incompleta es
  // que el contador vaya MUY por encima de los documentos presentes.
  if (ultimo > 0 && presentes.length === 0) {
    problemas.push(`La serie "${serie}" tiene contador en ${ultimo} pero NINGÚN documento del año ${anio}: la restauración perdió datos.`);
  }
}

// ── 3. Veredicto ─────────────────────────────────────────────────────
lineas.push('');
if (problemas.length === 0) {
  lineas.push('✔ RESTAURACIÓN VÁLIDA — las colecciones críticas tienen datos y los consecutivos son coherentes.');
} else {
  lineas.push('⛔ RESTAURACIÓN NO VÁLIDA:');
  for (const p of problemas) lineas.push(`   · ${p}`);
}

console.log(lineas.join('\n'));
process.exitCode = problemas.length === 0 ? 0 : 1;
