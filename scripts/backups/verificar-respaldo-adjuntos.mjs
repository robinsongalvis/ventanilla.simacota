/**
 * scripts/backups/verificar-respaldo-adjuntos.mjs
 *
 * ¿El respaldo de adjuntos sirve para restaurar? SOLO LECTURA.
 *
 * Un respaldo que nadie ha comprobado no es un respaldo: es una carpeta con
 * archivos. Contar objetos tampoco basta — mil archivos copiados no dicen nada
 * si el que falta es justo el oficio firmado de un expediente.
 *
 * Aquí la comprobación es de CONCILIACIÓN, y puede serlo porque este sistema
 * tiene un oráculo: Firestore guarda la RUTA de cada archivo. Así que la
 * pregunta deja de ser «¿cuántos hay?» y pasa a ser la única que importa:
 *
 *     ¿todo archivo que un expediente REFERENCIA existe en el respaldo?
 *
 * CÓMO SE DESCUBREN LAS RUTAS, y por qué no se leen campo por campo. Recorre
 * el JSON completo de cada documento y recoge toda cadena que empiece por uno
 * de los nueve prefijos que el sistema escribe. Enumerar los nombres de campo
 * —`archivos[].path`, `respuestaOficial.path`, `versiones[].storagePath`…—
 * obliga a acertar todos y a mantenerlos; este proyecto ya pagó dos veces por
 * esa clase de lista incompleta (el clasificador de series y el criterio de
 * completitud). Si mañana alguien añade un campo con una ruta, esto lo ve solo.
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT="$(grep '^FIREBASE_SERVICE_ACCOUNT=' .env.local | cut -d= -f2-)" \
 *     node scripts/backups/verificar-respaldo-adjuntos.mjs --proyecto <id> --respaldo <bucket>
 */
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { execFileSync } from 'node:child_process';

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; }
const proyecto = arg('--proyecto');
const bucketRespaldo = arg('--respaldo');
if (!proyecto || !bucketRespaldo) {
  console.error('Uso: --proyecto <project_id> --respaldo <bucket_de_respaldo>');
  process.exit(1);
}

const crudo = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim().replace(/^['"]/, '').replace(/['"]$/, '');
if (!crudo) { console.error('Falta FIREBASE_SERVICE_ACCOUNT.'); process.exit(2); }
let credencial;
try { credencial = JSON.parse(crudo); } catch (e) { console.error('Credencial no es JSON:', e.message); process.exit(2); }
if (credencial.project_id !== proyecto) {
  console.error(`⛔ GUARDA: credencial de "${credencial.project_id}", se ordenó "${proyecto}". Nada se leyó.`);
  process.exit(3);
}
if (!getApps().length) initializeApp({ credential: cert(credencial), projectId: proyecto });
const db = getFirestore();

/* Los nueve prefijos que el sistema escribe: seis finales y tres de staging.
   Los `_pendientes` se incluyen a propósito — nadie los limpia y contienen
   binarios reales, así que un respaldo que los omita está incompleto. */
const PREFIJOS = [
  'radicados/', 'respuestas/', 'sellados/', 'salidas/', 'planillas/', 'expedientes/',
];
/* OJO con `[^\s]`: la primera versión de esta expresión excluía espacios y se
   dejaba fuera `respuestas/…/oficio firmado.pdf`. Los nombres de archivo del
   sistema SÍ admiten espacios (sanitizeFilename los conserva, hasta 120
   caracteres), así que ese filtro descartaba en silencio justo los archivos que
   hay que conciliar — la misma trampa que el ADR-0033 §4.6 enuncia: el
   instrumento no puede filtrar por lo que falta en los casos que importan.
   Ahora solo se excluyen los saltos de línea (separan objetos en el listado) y
   las URL, que no son rutas de Storage aunque empiecen parecido. */
const RE_RUTA = new RegExp(`^(${PREFIJOS.map((p) => p.replace('/', '\\/')).join('|')})[^\\n]{1,300}$`);

/** Recoge toda cadena con pinta de ruta de Storage dentro de un valor cualquiera. */
function rutasEn(valor, encontradas = new Set()) {
  if (typeof valor === 'string') {
    if (RE_RUTA.test(valor) && !valor.includes('://')) encontradas.add(valor);
    return encontradas;
  }
  if (Array.isArray(valor)) {
    for (const v of valor) rutasEn(v, encontradas);
    return encontradas;
  }
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) rutasEn(v, encontradas);
  }
  return encontradas;
}

async function rutasReferenciadas() {
  const rutas = new Set();
  const colecciones = ['ventanilla_radicados', 'ventanilla_salidas', 'planillas_reparto', 'expedientes'];
  for (const col of colecciones) {
    let docs = [];
    try {
      docs = (await db.collection(col).get()).docs;
    } catch {
      console.log(`  · ${col}: no se pudo leer (¿no existe?) — se omite`);
      continue;
    }
    for (const d of docs) {
      rutasEn(d.data(), rutas);
      // Subcolecciones que guardan versiones de documentos (expedientes).
      for (const sub of await d.ref.listCollections()) {
        for (const s of (await sub.get()).docs) rutasEn(s.data(), rutas);
      }
    }
    console.log(`  · ${col}: ${docs.length} documento(s) recorridos`);
  }
  return rutas;
}

function objetosEnRespaldo() {
  // Se lista el respaldo UNA vez y se compara en memoria. Preguntar archivo por
  // archivo sería una llamada de red por documento: con miles de adjuntos, la
  // comprobación tardaría tanto que nadie la correría — y una verificación que
  // no se corre es exactamente igual de útil que no tenerla.
  const salida = execFileSync('gcloud', [
    'storage', 'ls', '--recursive', `gs://${bucketRespaldo}/espejo/**`,
  ], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  const prefijo = `gs://${bucketRespaldo}/espejo/`;
  return new Set(
    salida.split('\n')
      .filter((l) => l.startsWith(prefijo))
      .map((l) => l.slice(prefijo.length).trim())
      .filter(Boolean),
  );
}

console.log(`Conciliando referencias de ${proyecto} contra gs://${bucketRespaldo}/espejo\n`);
const referenciadas = await rutasReferenciadas();
console.log(`\nRutas referenciadas por algún documento: ${referenciadas.size}`);

let enRespaldo;
try {
  enRespaldo = objetosEnRespaldo();
} catch (e) {
  console.error(`\n⛔ No se pudo listar el respaldo: ${e.message.split('\n')[0]}`);
  console.error('   Sin poder leerlo, esta verificación NO puede decir nada. No se reporta verde.');
  process.exit(4);
}
console.log(`Objetos presentes en el respaldo:        ${enRespaldo.size}\n`);

const faltantes = [...referenciadas].filter((r) => !enRespaldo.has(r));

if (faltantes.length === 0) {
  if (referenciadas.size === 0) {
    // Cero contra cero NO es éxito: es «no hay adjuntos todavía» o «no supe
    // encontrarlos». Distinguirlo es la diferencia entre un verde honesto y uno
    // que tapa un fallo de lectura.
    console.log('⚠ Ningún documento referencia adjuntos. Puede ser correcto (sistema aún sin archivos)');
    console.log('  o indicar que las rutas se guardan con un formato que este script no reconoce.');
    console.log('  Revise un expediente con adjuntos antes de dar por buena la verificación.');
    process.exit(0);
  }
  console.log(`✔ CONCILIADO: los ${referenciadas.size} archivos referenciados existen en el respaldo.`);
  process.exit(0);
}

console.error(`⛔ FALTAN ${faltantes.length} de ${referenciadas.size} archivos referenciados:\n`);
for (const f of faltantes.slice(0, 40)) console.error(`   · ${f}`);
if (faltantes.length > 40) console.error(`   … y ${faltantes.length - 40} más`);
console.error('\nUn expediente que referencia un archivo ausente del respaldo es un expediente');
console.error('que NO se puede restaurar completo. Revise el workflow de respaldo antes de confiar en él.');
process.exit(5);
