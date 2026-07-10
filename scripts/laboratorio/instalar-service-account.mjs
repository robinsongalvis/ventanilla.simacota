/**
 * scripts/laboratorio/instalar-service-account.mjs
 *
 * Instala el service account de Firebase en .env.local de forma segura.
 * Reduce la intervención humana a: descargar el JSON desde Firebase Console.
 *
 * Qué hace:
 *   1. Busca en ~/Downloads el JSON de service account más reciente del proyecto.
 *   2. Lo valida (JSON parseable, project_id, client_email, private_key).
 *   3. Lo escribe en .env.local como FIREBASE_SERVICE_ACCOUNT en UNA línea,
 *      sin comillas envolventes (causa raíz del hallazgo H1 de la auditoría).
 *   4. Elimina el archivo descargado (un secreto no debe quedar en Descargas).
 *   5. Verifica de verdad: inicializa el Admin SDK y hace una lectura mínima.
 *
 * Uso:
 *   node scripts/laboratorio/instalar-service-account.mjs                    # proyecto prod
 *   node scripts/laboratorio/instalar-service-account.mjs --proyecto ventanilla-simacota-stage --destino .env.stage
 */
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const valorDe = (flag, porDefecto) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};
const PROYECTO = valorDe('--proyecto', 'ventanilla-unica-f31b1');
const DESTINO  = resolve(valorDe('--destino', '.env.local'));

/* 1 · localizar la descarga más reciente que corresponda al proyecto */
const descargas = join(homedir(), 'Downloads');
const candidatos = readdirSync(descargas)
  .filter((f) => f.endsWith('.json') && f.startsWith(PROYECTO))
  .map((f) => join(descargas, f))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

if (candidatos.length === 0) {
  console.error(`No se encontró ningún "${PROYECTO}-*.json" en ${descargas}.`);
  console.error('Descarga la clave: Firebase Console → ⚙️ → Service accounts → Generate new private key.');
  process.exit(1);
}
const archivo = candidatos[0];

/* 2 · validar */
let sa;
try {
  sa = JSON.parse(readFileSync(archivo, 'utf8'));
} catch {
  console.error(`El archivo ${archivo} no es JSON válido.`);
  process.exit(1);
}
for (const campo of ['project_id', 'client_email', 'private_key']) {
  if (!sa[campo]) { console.error(`Falta el campo "${campo}" en el JSON.`); process.exit(1); }
}
if (sa.project_id !== PROYECTO) {
  console.error(`El JSON es del proyecto "${sa.project_id}", se esperaba "${PROYECTO}".`);
  process.exit(1);
}

/* 3 · escribir en el archivo de entorno (reemplaza la línea si existe) */
const linea = `FIREBASE_SERVICE_ACCOUNT=${JSON.stringify(sa)}`;
let contenido = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : '';
if (/^FIREBASE_SERVICE_ACCOUNT=.*$/m.test(contenido)) {
  contenido = contenido.replace(/^FIREBASE_SERVICE_ACCOUNT=.*$/m, linea);
} else {
  contenido = contenido.trimEnd() + '\n' + linea + '\n';
}
writeFileSync(DESTINO, contenido);
console.log(`✔ FIREBASE_SERVICE_ACCOUNT instalado en ${DESTINO} (${linea.length} caracteres, una línea, sin comillas).`);

/* 4 · retirar el secreto de Descargas */
unlinkSync(archivo);
console.log(`✔ Eliminado ${archivo} (el secreto no debe quedar en Descargas).`);

/* 5 · verificación real contra Firestore */
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(sa);
const { default: admin } = await import('firebase-admin');
try {
  const app = admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: sa.project_id,
  }, `verificacion-${Date.now()}`);
  await app.firestore().listCollections();
  console.log(`✔ Verificado: el Admin SDK inicializa y consulta Firestore de "${sa.project_id}".`);
  process.exit(0);
} catch (e) {
  console.error('✘ El Admin SDK no pudo verificar contra Firestore:', e.message?.slice(0, 200));
  console.error('  La variable quedó instalada, pero revisa permisos del service account.');
  process.exit(2);
}
