/**
 * scripts/laboratorio/seed-funcionarios-stage.mjs
 *
 * Crea los funcionarios de prueba de la Alcaldía Sintética en el entorno STAGE.
 * Modelo idéntico al de producción: usuario Auth + custom claims {rol, tenantId}
 * + documento /users/{uid} (mismo esquema que scripts/uat-1.ts).
 *
 * GUARDA ANTI-PRODUCCIÓN (ADR-0002): este script se niega a ejecutar contra
 * el proyecto de producción. Sin excepciones.
 *
 * Uso:  node scripts/laboratorio/seed-funcionarios-stage.mjs
 * Requiere: .env.stage con FIREBASE_SERVICE_ACCOUNT del proyecto stage.
 * La contraseña de los usuarios queda en LAB_PASSWORD dentro de .env.stage
 * (se genera en la primera ejecución; nunca se imprime completa).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const ENV_STAGE = resolve('.env.stage');

/* ── cargar entorno stage ── */
const env = Object.fromEntries(
  readFileSync(ENV_STAGE, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

/* ── GUARDA ANTI-PRODUCCIÓN ── */
if (sa.project_id === PROYECTO_PROD) {
  console.error('⛔ GUARDA: este script NO puede ejecutarse contra producción. Abortado.');
  process.exit(1);
}

/* ── contraseña de laboratorio: generar una vez, persistir en .env.stage ── */
let password = env.LAB_PASSWORD;
if (!password) {
  password = 'Lab-' + randomBytes(12).toString('base64url');
  writeFileSync(ENV_STAGE, readFileSync(ENV_STAGE, 'utf8').trimEnd() + `\nLAB_PASSWORD=${password}\n`);
  console.log('✔ LAB_PASSWORD generada y guardada en .env.stage');
}

/* ── roster de la Alcaldía Sintética (mismos roles que la UAT institucional) ── */
const FUNCIONARIOS = [
  { email: 'recepcionista.lab@simacota.gov.co',  nombre: 'Recepcionista Lab',   rol: 'RECEPCIONISTA',    tenantId: 'VENTANILLA_UNICA' },
  { email: 'funcionario.lab@simacota.gov.co',    nombre: 'Funcionario Lab',     rol: 'FUNCIONARIO',      tenantId: 'SEC_GOBIERNO', cargo: 'Profesional Universitario' },
  { email: 'jefe.lab@simacota.gov.co',           nombre: 'Jefe Dependencia Lab',rol: 'JEFE_DEPENDENCIA', tenantId: 'SEC_GOBIERNO' },
  { email: 'controlinterno.lab@simacota.gov.co', nombre: 'Control Interno Lab', rol: 'CONTROL_INTERNO',  tenantId: 'VENTANILLA_UNICA' },
  { email: 'admin.lab@simacota.gov.co',          nombre: 'Admin Lab',           rol: 'ADMIN',            tenantId: 'VENTANILLA_UNICA' },
];

initializeApp({ credential: cert(sa), projectId: sa.project_id });
const auth = getAuth();
const db = getFirestore();

for (const u of FUNCIONARIOS) {
  let uid;
  try {
    uid = (await auth.getUserByEmail(u.email)).uid;
    await auth.updateUser(uid, { password, displayName: u.nombre });
    console.log(`ℹ ${u.email} ya existía — contraseña sincronizada`);
  } catch {
    uid = (await auth.createUser({ email: u.email, password, displayName: u.nombre })).uid;
    console.log(`✨ Creado ${u.email}`);
  }
  await auth.setCustomUserClaims(uid, { rol: u.rol, tenantId: u.tenantId });
  await db.doc(`users/${uid}`).set({
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    tenantId: u.tenantId,
    activo: true,
    isTest: true,
    ...(u.cargo ? { cargo: u.cargo } : {}),
  }, { merge: true });
}

console.log(`✔ ${FUNCIONARIOS.length} funcionarios de laboratorio listos en ${sa.project_id}.`);
process.exit(0);
