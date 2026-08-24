/**
 * scripts/operacion/verificar-reglas-vivas.mjs
 *
 * SOLO LECTURA. Responde la pregunta que ningún deploy responde por sí
 * solo: ¿las reglas VIVAS en Firebase son las del repositorio?
 *
 * POR QUÉ EXISTE. La auditoría del go-live lo señaló (PT-5): sin esto,
 * "las reglas están desplegadas" es una afirmación, no un hecho — y el
 * primer deploy de storage a producción respondió «already up to date»,
 * que puede significar "ya estaban" o "no subí nada", sin distinguirlos.
 * Este script lee el release ACTIVO de cloud.firestore y firebase.storage
 * por la API de Rules y lo compara byte a byte contra el archivo local.
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT=... node scripts/operacion/verificar-reglas-vivas.mjs --proyecto <id>
 */
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; }
const proyecto = arg('--proyecto');
if (!proyecto) { console.error('Uso: --proyecto <project_id>'); process.exit(1); }
const crudo = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim().replace(/^['"]/, '').replace(/['"]$/, '');
let cred; try { cred = JSON.parse(crudo); } catch { console.error('credencial ilegible'); process.exit(2); }
if (cred.project_id !== proyecto) { console.error(`⛔ credencial de "${cred.project_id}", se ordenó "${proyecto}".`); process.exit(3); }
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(cred), projectId: proyecto });
const token = (await app.options.credential.getAccessToken()).access_token;

async function api(ruta) {
  const r = await fetch(`https://firebaserules.googleapis.com/v1/projects/${proyecto}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`${ruta} → HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const OBJETIVOS = [
  { servicio: 'cloud.firestore', archivo: 'firestore.rules' },
  { servicio: 'firebase.storage', archivo: 'storage.rules' },
];

const { releases = [] } = await api('/releases');
let deriva = 0;
for (const o of OBJETIVOS) {
  const rel = releases.find((r) => r.name.includes(o.servicio));
  if (!rel) { console.log(`✘ ${o.servicio}: SIN release activo`); deriva += 1; continue; }
  const rulesetId = rel.rulesetName.split('/').pop();
  const rs = await api(`/rulesets/${rulesetId}`);
  const vivo = rs.source.files.map((f) => f.content).join('\n');
  const local = readFileSync(o.archivo, 'utf8');
  const normal = (t) => t.replace(/\r\n/g, '\n').trim();
  const iguales = normal(vivo) === normal(local);
  console.log(`${iguales ? '✔' : '✘'} ${o.servicio} · release ${rulesetId} (${rel.updateTime ?? rel.createTime})`);
  console.log(`   ${iguales ? `IDÉNTICO a ${o.archivo} del repo` : `DERIVA: lo VIVO no es lo del repo (${o.archivo})`}`);
  if (!iguales) {
    deriva += 1;
    const enVivo = (m) => (vivo.includes(m) ? 'sí' : 'NO');
    console.log(`   pistas de lo vivo: cierre PT-3=${enVivo('PT-3')} · counters write:false=${enVivo('allow write: if false')} · trazabilidad cerrada=${vivo.includes('canWriteTrazabilidad') ? 'NO (función vieja presente)' : 'sí'}`);
  }
}
process.exitCode = deriva === 0 ? 0 : 4;
console.log(deriva === 0 ? '\n✔ SIN DERIVA: lo que rige es lo versionado.' : `\n⛔ ${deriva} superficie(s) con deriva — desplegar antes de confiar.`);
