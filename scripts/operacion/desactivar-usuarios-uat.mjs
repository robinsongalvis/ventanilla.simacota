/**
 * scripts/operacion/desactivar-usuarios-uat.mjs
 *
 * DESACTIVA las 4 cuentas de prueba de la UAT en producción (PT-3 del
 * PLAN_GO_LIVE). Eran el «insider autenticado» de la auditoría: cuentas
 * sin dueño con roles privilegiados y credenciales compartidas durante
 * la UAT de julio.
 *
 * DESACTIVAR, NO BORRAR: sus uid aparecen en trazabilidades reales de la
 * UAT — borrarlos dejaría actores huérfanos en el registro probatorio.
 * Se cierra la puerta por DOS lados, cada uno suficiente:
 *   1. Firebase Auth: `disabled: true` — el login muere en la puerta.
 *   2. users/{uid}: `activo: false` + `archivado: true` — aunque alguien
 *      revierta (1), resolveClaims devuelve null y no hay sesión interna.
 *
 * Guardas del patrón de operación (mismo que limpiar-datos-prueba):
 * lista LITERAL · huella por objetivo (rol esperado) · todo-o-nada ·
 * dry-run por defecto · CONFIRMO_DESACTIVACION=SI para ejecutar ·
 * --ensayo-stage solo contra stage con dobles ENSAYO-* propios (JAMÁS
 * toca las cuentas .lab@ del laboratorio, que sí se usan).
 */
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const OBJETIVOS = [
  { email: 'recepcionista.test@simacota.gov.co', rolEsperado: 'RECEPCIONISTA' },
  { email: 'funcionario.test@simacota.gov.co', rolEsperado: 'FUNCIONARIO' },
  { email: 'jefe.test@simacota.gov.co', rolEsperado: 'JEFE_DEPENDENCIA' },
  { email: 'controlinterno.test@simacota.gov.co', rolEsperado: 'CONTROL_INTERNO' },
];

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; }
const proyecto = arg('--proyecto');
const ensayo = process.argv.includes('--ensayo-stage');
const ejecutar = process.env.CONFIRMO_DESACTIVACION === 'SI';
if (!proyecto) { console.error('Uso: --proyecto <id> [--ensayo-stage]'); process.exit(1); }
if (ensayo && proyecto !== 'ventanilla-simacota-stage') { console.error('⛔ ensayo SOLO contra stage'); process.exit(1); }

const crudo = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim().replace(/^['"]/, '').replace(/['"]$/, '');
let cred; try { cred = JSON.parse(crudo); } catch { console.error('credencial ilegible'); process.exit(2); }
if (cred.project_id !== proyecto) { console.error(`⛔ credencial de "${cred.project_id}", se ordenó "${proyecto}".`); process.exit(3); }
if (!getApps().length) initializeApp({ credential: cert(cred), projectId: proyecto });
const auth = getAuth(); const db = getFirestore();

const email = (o) => (ensayo ? o.email.replace('@', '.ensayo-pt3@') : o.email);

async function main() {
  if (ensayo) {
    console.log('— sembrando dobles de ensayo —');
    for (const o of OBJETIVOS) {
      const u = await auth.createUser({ email: email(o), password: 'Ensayo-' + Math.random().toString(36).slice(2, 10) });
      await db.doc('users/' + u.uid).set({ email: email(o), rol: o.rolEsperado, activo: true, ensayoPt3: true });
    }
  }

  const plan = []; const fallos = [];
  for (const o of OBJETIVOS) {
    let u;
    try { u = await auth.getUserByEmail(email(o)); }
    catch { fallos.push(`${email(o)}: NO EXISTE en Auth`); continue; }
    const perfil = await db.doc('users/' + u.uid).get();
    const d = perfil.data();
    if (!perfil.exists) { fallos.push(`${email(o)}: sin perfil users/`); continue; }
    if (d.rol !== o.rolEsperado) { fallos.push(`${email(o)}: rol "${d.rol}" ≠ esperado "${o.rolEsperado}" — huella NO coincide`); continue; }
    if (u.disabled && d.activo === false) { fallos.push(`${email(o)}: YA está desactivado`); continue; }
    plan.push({ o, u });
  }
  if (fallos.length) {
    console.error('⛔ VERIFICACIÓN FALLIDA — nada se tocó:');
    for (const f of fallos) console.error('   · ' + f);
    process.exitCode = 4; return;
  }
  console.log(`Verificación: ${plan.length}/4 cuentas confirmadas contra su huella.`);
  if (!ejecutar && !ensayo) {
    console.log('\nDRY-RUN (sin CONFIRMO_DESACTIVACION=SI no se escribe). Plan:');
    for (const p of plan) console.log(`  DESACTIVAR  ${email(p.o)}  (rol ${p.o.rolEsperado})`);
    return;
  }
  for (const p of plan) {
    await auth.updateUser(p.u.uid, { disabled: true });
    await db.doc('users/' + p.u.uid).update({
      activo: false, archivado: true,
      desactivado: { fecha: new Date().toISOString(), motivo: 'Cuenta de prueba UAT — retiro pre-operación (PT-3, PLAN_GO_LIVE)' },
    });
    console.log(`  DESACTIVADA  ${email(p.o)}`);
  }
  if (ensayo) {
    console.log('— verificando y limpiando dobles —');
    let mal = 0;
    for (const o of OBJETIVOS) {
      const u = await auth.getUserByEmail(email(o));
      const d = (await db.doc('users/' + u.uid).get()).data();
      if (!u.disabled || d.activo !== false || d.archivado !== true) { console.error('  ✘ ' + email(o)); mal += 1; }
      await auth.deleteUser(u.uid); await db.doc('users/' + u.uid).delete();
    }
    if (mal) { process.exitCode = 5; return; }
    console.log('✔ ENSAYO VÁLIDO: Auth deshabilitado + perfil archivado en las 4; dobles limpiados.');
    return;
  }
  console.log('\n✔ Desactivación ejecutada. Las cuentas quedan en la trazabilidad histórica; el login está muerto por dos vías.');
}
await main();
