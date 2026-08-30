/**
 * Siembra en STAGE **un** expediente para recorrer el flujo COMPLETO.
 * Copia la forma de scripts/laboratorio/sembrar-licencias-stage.mjs, con UNA
 * diferencia deliberada: NO lleva `esPrueba`, que es el candado R10 que impide
 * declarar la radicación en legal y debida forma.
 *
 * GUARDA ANTI-PRODUCCIÓN: aborta si el service account no es de stage.
 * Repetible: `--limpiar` borra exactamente lo que sembró y nada más.
 */
import { readFileSync } from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROD = 'ventanilla-unica-f31b1';
const env = readFileSync('.env.stage', 'utf8');
const sa = JSON.parse(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m.exec(env)[1].trim().replace(/^["']|["']$/g, ''));
sa.private_key = sa.private_key?.replace(/\\n/g, '\n');
if (sa.project_id === PROD) { console.error('⛔ GUARDA: apunta a PRODUCCIÓN. Abortado.'); process.exit(1); }
if (!getApps().length) initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
const db = getFirestore();

const ID = 'flujo-completo-01';
const TENANT = 'SEC_PLANEACION';
const hoy = new Date();
const dias = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d.toISOString(); };

if (process.argv.includes('--limpiar')) {
  const subs = await db.collection(`expedientes/${ID}/actuaciones`).get();
  const b = db.batch();
  subs.forEach((d) => b.delete(d.ref));
  b.delete(db.doc(`expedientes/${ID}`));
  await b.commit();
  console.log('limpiado:', ID);
  process.exit(0);
}

await db.doc(`expedientes/${ID}`).set({
  id: ID,
  tenantId: TENANT,
  tramiteId: 'licencia-construccion-obra-nueva',
  estado: 'EN_REVISION',
  estadoJuridico: 'PRESENTADA',
  solicitanteNombre: 'MARIA DEL CARMEN OSPINA RUEDA',
  solicitanteDocumento: '37.845.219',
  contexto: {},
  aportes: [],
  radicadoId: null,
  creadoEn: dias(-1),
  actualizadoEn: dias(-1),
  numeroExpediente: null,
  subtipos: ['CONSTRUCCION'],
  origen: 'REAL',
  fechaAlertaConservadora: null,
  predio: { barrioVereda: 'JERUSALEN', matriculaInmobiliaria: '321-23041' },
  loteVerificacion: 'FLUJO-COMPLETO',
  casoVerificacion: 'Recorrido de extremo a extremo del flujo de licencias (stage)',
});
console.log('sembrado en', sa.project_id, '→ expedientes/' + ID);
const d = (await db.doc(`expedientes/${ID}`).get()).data();
console.log('  estadoJuridico:', d.estadoJuridico, '· esPrueba:', d.esPrueba ?? '(sin marca ✔)', '· aportes:', d.aportes.length);
