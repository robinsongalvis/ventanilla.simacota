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
import { inventarioDesdeReglas } from './inventario-desde-reglas.mjs';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';

/**
 * EL INVENTARIO SE DERIVA DE `firestore.rules` (26-ago-2026), NO SE ESCRIBE.
 *
 * Antes eran tres colecciones de una lista a mano. Las reglas declaran veinte.
 * Entre las que faltaban estaba `users` — sin ella nadie puede autenticarse y
 * la plataforma restaurada es inservible, mientras el ensayo firmaba
 * «✔ RESTAURACIÓN VÁLIDA». Un respaldo que compra confianza falsa es peor que
 * no tener ensayo.
 *
 * `firestore.rules` es el único inventario que el sistema se ve OBLIGADO a
 * mantener al día: una colección sin regla no se puede leer.
 */
const INVENTARIO = inventarioDesdeReglas();

/**
 * ALCANCE DECLARADO (ADR-0033 §4.6-bis).
 *
 * Del inventario completo, estas son las que además tienen que traer DATOS:
 * si están vacías, la restauración no sirve aunque exista. El resto debe
 * existir en el inventario y puede estar legítimamente vacío — y decirlo aquí
 * es lo que impide que un vacío legítimo y una pérdida se confundan.
 */
const DEBEN_TENER_DATOS = {
  users: 'Sin usuarios nadie puede autenticarse: `requireActiveInternalUser()` rechaza a todo el mundo y la plataforma restaurada no se puede ni abrir.',
  ventanilla_radicados: 'Es el libro de correspondencia. Vacío significa que se perdió la operación entera.',
  counters: 'Sin contadores no se puede emitir ningún consecutivo, y reconstruirlos a mano es lo que este ensayo existe para no tener que hacer.',
};

/**
 * Las que pueden estar vacías SIN que eso indique pérdida, con su razón. Se
 * enumeran para que el informe distinga «vacía y es normal» de «vacía y es un
 * problema» — y para que una colección nueva no caiga en ninguno de los dos
 * cajones sin que nadie lo decida.
 */
const PUEDEN_ESTAR_VACIAS = {
  radicados: 'Colección legada, anterior a `ventanilla_radicados`. Puede no tener nada.',
  unicidad_radicados: 'Las reservas se escriben desde que existen (ago-2026): un respaldo anterior no las trae.',
  unicidad_salidas: 'Igual que `unicidad_radicados`.',
  unicidad_planillas: 'Igual que `unicidad_radicados`.',
  unicidad_expedientes: 'Solo la escribe la emisión real, bloqueada por el candado R10.',
  expedientes: 'El módulo de licencias puede no tener expedientes todavía en el momento del respaldo.',
  ventanilla_salidas: 'Un municipio puede pasar días sin emitir una salida.',
  ventanilla_planillas: 'Se genera una por día hábil con reparto: un respaldo de fin de semana no la trae.',
  ai_logs: 'Trazas de IA: informativas, no operativas.',
  ai_feedback: 'Retroalimentación de IA: puede no haberla.',
  ai_auditoria: 'Auditoría de IA: puede no haberla.',
  admin_auditoria: 'Eventos de administración: puede no haberlos en el periodo.',
  simi_auditoria: 'Auditoría de SIMI: puede no haberla.',
  control_interno_hallazgos: 'Control Interno puede no tener hallazgos abiertos.',
  control_interno_planes_mejora: 'Depende de que haya hallazgos.',
  control_interno_alertas: 'Se generan por cron: un respaldo puede caer antes de la primera.',
  control_interno_eventos: 'Igual que las alertas.',
};

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

// ── 1. Colecciones, TODAS las que declaran las reglas ────────────────
lineas.push(`COLECCIONES (${INVENTARIO.raiz.length}, derivadas de firestore.rules):`);
const conteos = {};

/* Ninguna colección del inventario puede quedar sin clasificar. Si aparece una
   nueva y nadie decidió si debe traer datos o puede estar vacía, el ensayo lo
   dice en vez de suponerlo — que es exactamente cómo `users` se quedó fuera
   durante meses. */
const sinClasificar = INVENTARIO.raiz.filter(
  (c) => !(c in DEBEN_TENER_DATOS) && !(c in PUEDEN_ESTAR_VACIAS),
);
if (sinClasificar.length > 0) {
  problemas.push(
    `Colección(es) sin clasificar en el alcance del verificador: ${sinClasificar.join(', ')}. ` +
    'Decida en `scripts/backups/verificar-restauracion.mjs` si deben traer datos o pueden estar vacías. ' +
    'Excluir es legítimo; excluir sin darse cuenta no.',
  );
}

for (const coleccion of INVENTARIO.raiz) {
  const snap = await db.collection(coleccion).count().get();
  const n = snap.data().count;
  conteos[coleccion] = n;
  const exigeDatos = coleccion in DEBEN_TENER_DATOS;
  const marca = n === 0 ? (exigeDatos ? '  ✗ VACÍA' : '  (vacía, previsto)') : '';
  lineas.push(`  ${coleccion.padEnd(30)} ${String(n).padStart(7)} documento(s)${marca}`);
  if (n === 0 && exigeDatos) {
    problemas.push(`"${coleccion}" quedó VACÍA. ${DEBEN_TENER_DATOS[coleccion]}`);
  }
}

/* ── SUBCOLECCIONES. `.count()` sobre la raíz NO las ve: `actuaciones`,
   `documentos` y `versiones` podían haberse perdido enteras con los conteos de
   arriba en verde. Se cuentan con `collectionGroup`, que es la única forma de
   verlas sin recorrer documento por documento. */
lineas.push('');
lineas.push(`SUBCOLECCIONES (${INVENTARIO.subcolecciones.length}):`);
for (const sub of INVENTARIO.subcolecciones) {
  const snap = await db.collectionGroup(sub.nombre).count().get();
  const n = snap.data().count;
  conteos[sub.ruta] = n;
  lineas.push(`  ${sub.ruta.padEnd(44)} ${String(n).padStart(7)} documento(s)`);
  /* Una subcolección vacía cuyo PADRE tiene documentos es sospechosa: significa
     que se restauraron los expedientes pero no sus actuaciones. */
  if (n === 0 && (conteos[sub.padre] ?? 0) > 0) {
    problemas.push(
      `"${sub.ruta}" está VACÍA mientras "${sub.padre}" tiene ${conteos[sub.padre]} documento(s). ` +
      'Una restauración que trae los padres y pierde sus subcolecciones se ve completa y no lo está.',
    );
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
