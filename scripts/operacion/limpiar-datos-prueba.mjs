/**
 * scripts/operacion/limpiar-datos-prueba.mjs
 *
 * EJECUTA el acta de limpieza de datos de prueba autorizada el 23-ago-2026
 * (docs/actas/ACTA_LIMPIEZA_DATOS_PRUEBA_2026-08-23.md, PLAN_GO_LIVE §Limpieza).
 *
 * LA LISTA ES LITERAL. Lo ejecutado es exactamente lo autorizado: los ids
 * están escritos aquí y en el acta, no se re-derivan de consultas — si los
 * datos cambiaron desde el inventario, la huella dactilar de abajo lo
 * detecta y el script ABORTA COMPLETO sin tocar nada (todo-o-nada).
 *
 * DOS TRATAMIENTOS, por qué:
 *  - BORRAR (8): registros FUERA de las series consecutivas oficiales
 *    (1-WEB-* del botón E2E, SIM-UAT-* de la UAT, expedientes serie demo).
 *    Eliminarlos no deja hueco en ninguna foliación.
 *  - ANULAR (2): los radicados 25 y 26 consumieron número de la serie legal
 *    1-110. NO se borran: se marcan isTest+excludeFromMetrics (el mecanismo
 *    que ya oculta de bandeja y métricas), guardan bloque `anulado` con
 *    referencia al acta, y reciben entrada de trazabilidad. Como en el
 *    libro de papel: el número se pierde CON CONSTANCIA, el registro queda.
 *
 * GUARDAS: credencial debe coincidir con --proyecto · sin CONFIRMO_LIMPIEZA=SI
 * es DRY-RUN (solo lectura) · jamás toca counters/ ni unicidad_* (DF-9) ·
 * verifica que ningún radicado LEGÍTIMO apunte (vinculoExpediente) a un
 * expediente a borrar · --ensayo-stage solo funciona contra stage: siembra
 * dobles ENSAYO-*, ejecuta el mismo camino de escritura sobre ellos y limpia.
 *
 * Uso:
 *   ... node scripts/operacion/limpiar-datos-prueba.mjs --proyecto <id>            # dry-run
 *   CONFIRMO_LIMPIEZA=SI ... node scripts/... --proyecto <id>                      # ejecuta
 *   ... node scripts/... --proyecto ventanilla-simacota-stage --ensayo-stage       # ensayo
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const ACTA = 'docs/actas/ACTA_LIMPIEZA_DATOS_PRUEBA_2026-08-23.md';
const AHORA = new Date().toISOString();

/* ── La lista autorizada (23-ago-2026, propietario, por chat) ─────────── */
const BORRAR_RADICADOS = [
  { id: '1-WEB-2026-64476419', huella: (d) => d.isTest === true },
  { id: '1-WEB-2026-81440313', huella: (d) => d.isTest === true },
  { id: '1-WEB-2026-82744426', huella: (d) => d.isTest === true },
  { id: '1-WEB-2026-82843811', huella: (d) => d.isTest === true },
  { id: 'SIM-UAT-1780191487988', huella: (d) => /UAT/i.test(d?.solicitante?.nombreCompleto ?? '') },
];
const BORRAR_EXPEDIENTES = [
  { id: '31d5ef52-bc52-464a-a77b-7949ce81ccc0', huella: (d) => d.esPrueba === true && d?.numeroExpediente?.serieId === 'demo' },
  { id: '3fd53fd2-dbbf-4800-8e6e-7ecdaae28db9', huella: (d) => d.esPrueba === true && d?.numeroExpediente?.serieId === 'demo' },
  { id: 'acd849c8-8033-462e-ab2f-241af6915340', huella: (d) => d.esPrueba === true && d?.numeroExpediente?.serieId === 'demo' },
];
const ANULAR_RADICADOS = [
  { id: '1-110-2026-00000025', huella: (d) => /prueba/i.test(d?.solicitante?.nombreCompleto ?? '') },
  { id: '1-110-202607-00000026', huella: (d) => /prueba/i.test(d?.detalle?.asunto ?? '') },
];

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; }
const proyectoOrdenado = arg('--proyecto');
const modoEnsayo = process.argv.includes('--ensayo-stage');
const ejecutar = process.env.CONFIRMO_LIMPIEZA === 'SI';
if (!proyectoOrdenado) { console.error('Uso: --proyecto <project_id> [--ensayo-stage]'); process.exit(1); }
if (modoEnsayo && proyectoOrdenado !== 'ventanilla-simacota-stage') {
  console.error('⛔ --ensayo-stage SOLO contra ventanilla-simacota-stage.'); process.exit(1);
}

const crudo = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim().replace(/^['"]/, '').replace(/['"]$/, '');
if (!crudo) { console.error('Falta FIREBASE_SERVICE_ACCOUNT.'); process.exit(2); }
let credencial;
try { credencial = JSON.parse(crudo); } catch (e) { console.error('Credencial no es JSON:', e.message); process.exit(2); }
if (credencial.project_id !== proyectoOrdenado) {
  console.error(`⛔ GUARDA: credencial de "${credencial.project_id}", se ordenó "${proyectoOrdenado}". Nada se tocó.`); process.exit(3);
}
if (!getApps().length) initializeApp({ credential: cert(credencial), projectId: proyectoOrdenado });
const db = getFirestore();

/* En ensayo, los objetivos son dobles ENSAYO-* sembrados por este mismo
   script — nunca los datos sintéticos del laboratorio. */
const pref = (id) => (modoEnsayo ? `ENSAYO-LIMPIEZA-${id}` : id);

async function borrarConSubcolecciones(ref) {
  for (const sub of await ref.listCollections()) {
    const docs = await sub.listDocuments();
    for (const d of docs) await d.delete();
  }
  await ref.delete();
}

async function main() {
  if (modoEnsayo) {
    console.log('— sembrando dobles de ensayo en stage —');
    for (const o of BORRAR_RADICADOS) {
      const ref = db.collection('ventanilla_radicados').doc(pref(o.id));
      await ref.set({ isTest: true, solicitante: { nombreCompleto: 'Ciudadano UAT Prueba' }, ensayoLimpieza: true });
      await ref.collection('trazabilidad').doc('t1').set({ nota: 'doble de ensayo' });
    }
    for (const o of BORRAR_EXPEDIENTES) {
      await db.collection('expedientes').doc(pref(o.id)).set({ esPrueba: true, numeroExpediente: { serieId: 'demo' }, ensayoLimpieza: true });
    }
    for (const o of ANULAR_RADICADOS) {
      await db.collection('ventanilla_radicados').doc(pref(o.id)).set({ solicitante: { nombreCompleto: 'Prueba doble' }, detalle: { asunto: 'PRUEBA doble' }, estadoActual: 'ASIGNADO', ensayoLimpieza: true });
    }
  }

  /* ── FASE 1: verificación completa ANTES de cualquier escritura ────── */
  const fallos = [];
  const plan = [];
  for (const o of BORRAR_RADICADOS) {
    const ref = db.collection('ventanilla_radicados').doc(pref(o.id));
    const snap = await ref.get();
    if (!snap.exists) fallos.push(`${pref(o.id)}: NO EXISTE`);
    else if (!o.huella(snap.data())) fallos.push(`${pref(o.id)}: la huella NO coincide — el dato cambió desde el inventario`);
    else plan.push({ accion: 'BORRAR', ref, id: pref(o.id) });
  }
  for (const o of BORRAR_EXPEDIENTES) {
    const ref = db.collection('expedientes').doc(pref(o.id));
    const snap = await ref.get();
    if (!snap.exists) { fallos.push(`${pref(o.id)}: NO EXISTE`); continue; }
    if (!o.huella(snap.data())) { fallos.push(`${pref(o.id)}: la huella NO coincide`); continue; }
    // ¿Algún radicado LEGÍTIMO apunta a este expediente? Borrarlo dejaría
    // una referencia colgante en un registro real → se aborta ese caso.
    const enlazados = await db.collection('ventanilla_radicados')
      .where('vinculoExpediente.expedienteId', '==', pref(o.id)).get();
    const legitimos = enlazados.docs.filter((r) => !BORRAR_RADICADOS.some((b) => pref(b.id) === r.id));
    if (legitimos.length) fallos.push(`${pref(o.id)}: ${legitimos.length} radicado(s) legítimo(s) lo enlazan (${legitimos.map((r) => r.id).join(', ')}) — NO se borra sin decisión`);
    else plan.push({ accion: 'BORRAR', ref, id: pref(o.id) });
  }
  for (const o of ANULAR_RADICADOS) {
    const ref = db.collection('ventanilla_radicados').doc(pref(o.id));
    const snap = await ref.get();
    if (!snap.exists) fallos.push(`${pref(o.id)}: NO EXISTE`);
    else if (!o.huella(snap.data())) fallos.push(`${pref(o.id)}: la huella NO coincide`);
    else if (snap.data().anulado) fallos.push(`${pref(o.id)}: YA está anulado`);
    else plan.push({ accion: 'ANULAR', ref, id: pref(o.id) });
  }

  if (fallos.length) {
    console.error('⛔ VERIFICACIÓN FALLIDA — NADA se tocó (todo-o-nada):');
    for (const f of fallos) console.error('   · ' + f);
    process.exitCode = 4;
    return;
  }

  console.log(`Verificación: ${plan.length}/10 objetivos confirmados contra su huella.`);
  if (!ejecutar && !modoEnsayo) {
    console.log('\nDRY-RUN (sin CONFIRMO_LIMPIEZA=SI no se escribe nada). Plan:');
    for (const p of plan) console.log(`  ${p.accion}  ${p.id}`);
    return;
  }

  /* ── FASE 2: ejecución ─────────────────────────────────────────────── */
  for (const p of plan) {
    if (p.accion === 'BORRAR') {
      await borrarConSubcolecciones(p.ref);
      console.log(`  BORRADO  ${p.id}`);
    } else {
      await p.ref.update({
        isTest: true,
        excludeFromMetrics: true,
        anulado: { fecha: AHORA, motivo: 'Dato de prueba — anulación con acta previa a la operación con contrato', acta: ACTA },
        ultimaActualizacion: AHORA,
      });
      await p.ref.collection('trazabilidad').add({
        fecha: AHORA,
        accion: 'ANULACION_DATO_PRUEBA',
        actorUid: 'acta-limpieza',
        actorNombre: 'Acta de limpieza pre-operación (autorizada por el propietario, 23-ago-2026)',
        nota: `Número anulado con constancia: dato de prueba dentro de la serie legal. Ver ${ACTA}.`,
      });
      console.log(`  ANULADO  ${p.id}`);
    }
  }

  if (modoEnsayo) {
    console.log('— verificando el resultado del ensayo —');
    for (const o of [...BORRAR_RADICADOS.map((x) => ['ventanilla_radicados', x.id]), ...BORRAR_EXPEDIENTES.map((x) => ['expedientes', x.id])]) {
      const s = await db.collection(o[0]).doc(pref(o[1])).get();
      if (s.exists) { console.error(`  ✘ ${pref(o[1])} debería estar borrado`); process.exitCode = 5; }
    }
    for (const o of ANULAR_RADICADOS) {
      const s = await db.collection('ventanilla_radicados').doc(pref(o.id)).get();
      const d = s.data();
      if (!s.exists || d.isTest !== true || !d.anulado) { console.error(`  ✘ ${pref(o.id)} debería estar anulado y presente`); process.exitCode = 5; }
      else await borrarConSubcolecciones(s.ref); // limpiar el doble de ensayo
    }
    if (!process.exitCode) console.log('✔ ENSAYO VÁLIDO: borrados desaparecen, anulados quedan marcados con acta. Dobles limpiados.');
    return;
  }
  console.log(`\n✔ Limpieza ejecutada. Registrar el resultado en ${ACTA}.`);
}
await main();
