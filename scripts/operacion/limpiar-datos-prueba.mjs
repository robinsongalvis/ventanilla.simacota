/**
 * scripts/operacion/limpiar-datos-prueba.mjs
 *
 * EJECUTA las actas de limpieza de datos de prueba previas a la operación.
 * El script tiene RONDAS: cada ronda es un acta autorizada por el propietario,
 * con su lista literal. Se elige con `--ronda`. El motor es el mismo para
 * todas — no se duplica lógica de escritura, que es donde se cometen los
 * errores caros.
 *
 * LA LISTA ES LITERAL. Lo ejecutado es exactamente lo autorizado: los ids
 * están escritos aquí y en el acta, no se re-derivan de consultas — si los
 * datos cambiaron desde el inventario, la huella dactilar lo detecta y el
 * script ABORTA COMPLETO sin tocar nada (todo-o-nada).
 *
 * DOS TRATAMIENTOS, por qué:
 *  - BORRAR: registros FUERA de las series consecutivas oficiales (el botón
 *    E2E generaba `1-WEB-2026-{8 dígitos ALEATORIOS}` sin tocar el contador;
 *    `SIM-UAT-*`; expedientes de serie demo). Eliminarlos no deja hueco.
 *  - ANULAR: registros que CONSUMIERON número de la serie anual. NO se
 *    borran: se marcan isTest+excludeFromMetrics (el mecanismo que ya oculta
 *    de bandeja y métricas), guardan bloque `anulado` con referencia al acta,
 *    y reciben entrada de trazabilidad. Como en el libro de papel: el número
 *    se pierde CON CONSTANCIA, el registro queda.
 *
 * CÓMO SE SABE CUÁL ES CUÁL — y por qué NO por el aspecto del número. El
 * consecutivo anual es UNO SOLO (`counters/radicados-{año}`) y solo cambió la
 * máscara del id (ver lib/radicado-institucional.ts): `1-WEB-…`, `1-OFICIO-…`,
 * `1-EMAIL-…`, `1-PRESENCIAL-…` son etiquetas HISTÓRICAS POR CANAL de esa
 * misma serie, no una serie aparte — la consulta pública las acepta en la
 * misma expresión que `1-110-…`. Mirar el prefijo lleva a borrar un número de
 * la serie legal creyendo que está fuera de ella. La prueba dura de que un
 * registro consumió el contador es que el documento GUARDA el campo
 * `consecutivo`; de ahí la guarda estructural de FASE 1.
 *
 * GUARDAS: credencial debe coincidir con --proyecto · sin CONFIRMO_LIMPIEZA=SI
 * es DRY-RUN (solo lectura) · jamás toca counters/ ni unicidad_* (DF-9) ·
 * NINGÚN objetivo de BORRAR puede tener campo `consecutivo` (si lo tiene,
 * consumió la serie y borrarlo dejaría hueco: aborta) · verifica que ningún
 * radicado LEGÍTIMO apunte (vinculoExpediente) a un expediente a borrar ·
 * --ensayo-stage solo funciona contra stage: siembra dobles ENSAYO-*, ejecuta
 * el mismo camino de escritura sobre ellos y limpia.
 *
 * Uso:
 *   ... node scripts/operacion/limpiar-datos-prueba.mjs --proyecto <id> --ronda <id>   # dry-run
 *   CONFIRMO_LIMPIEZA=SI ... node scripts/... --proyecto <id> --ronda <id>             # ejecuta
 *   ... node scripts/... --proyecto ventanilla-simacota-stage --ronda <id> --ensayo-stage
 */
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const AHORA = new Date().toISOString();

/* Huella de la ronda 2: el número del id y el campo `consecutivo` del
   documento deben COINCIDIR. No es decorativa — si un doc `…-00000012`
   guardara `consecutivo: 45`, la base no es la que inventariamos y hay que
   parar. De paso prueba lo que autoriza el tratamiento: consumió el contador,
   luego se ANULA y no se borra. */
const consecutivoEs = (n) => (d) => d?.consecutivo === n;

const RONDAS = {
  /* ── Ronda 1: acta del 23-ago-2026 (EJECUTADA) ─────────────────────── */
  '2026-08-23': {
    acta: 'docs/actas/ACTA_LIMPIEZA_DATOS_PRUEBA_2026-08-23.md',
    motivo: 'Dato de prueba — anulación con acta previa a la operación con contrato',
    borrarRadicados: [
      { id: '1-WEB-2026-64476419', huella: (d) => d.isTest === true },
      { id: '1-WEB-2026-81440313', huella: (d) => d.isTest === true },
      { id: '1-WEB-2026-82744426', huella: (d) => d.isTest === true },
      { id: '1-WEB-2026-82843811', huella: (d) => d.isTest === true },
      { id: 'SIM-UAT-1780191487988', huella: (d) => /UAT/i.test(d?.solicitante?.nombreCompleto ?? '') },
    ],
    borrarExpedientes: [
      { id: '31d5ef52-bc52-464a-a77b-7949ce81ccc0', huella: (d) => d.esPrueba === true && d?.numeroExpediente?.serieId === 'demo' },
      { id: '3fd53fd2-dbbf-4800-8e6e-7ecdaae28db9', huella: (d) => d.esPrueba === true && d?.numeroExpediente?.serieId === 'demo' },
      { id: 'acd849c8-8033-462e-ab2f-241af6915340', huella: (d) => d.esPrueba === true && d?.numeroExpediente?.serieId === 'demo' },
    ],
    anularRadicados: [
      { id: '1-110-2026-00000025', huella: (d) => /prueba/i.test(d?.solicitante?.nombreCompleto ?? ''), doble: { solicitante: { nombreCompleto: 'Prueba doble' } } },
      { id: '1-110-202607-00000026', huella: (d) => /prueba/i.test(d?.detalle?.asunto ?? ''), doble: { detalle: { asunto: 'PRUEBA doble' } } },
    ],
  },

  /* ── Ronda 2: acta del 24-ago-2026 ──────────────────────────────────────
     El propietario confirmó por chat que los radicados 9 a 24 y el 27 son
     TODOS datos de prueba propios (suyos, de Andrés o inventados) y que
     ninguno corresponde a una petición de un ciudadano real — condición sin
     la cual esto no se ejecuta, porque varios están vencidos y borrar una
     petición real vencida destruye la prueba de un incumplimiento.
     Los 17 consumieron el contador `radicados-2026` (numeración continua
     9…24 → 25, 26 ya anulados → 27), de modo que TODOS se anulan. Ninguno
     se borra: por eso esta ronda no tiene listas de borrado. */
  '2026-08-24': {
    acta: 'docs/actas/ACTA_ANULACION_SERIE_PRUEBA_2026-08-24.md',
    motivo: 'Dato de prueba de la etapa de construcción — anulación con acta antes de abrir la operación real',
    borrarRadicados: [],
    borrarExpedientes: [],
    anularRadicados: [
      { id: '1-OFICIO-2026-00000009', huella: consecutivoEs(9), doble: { consecutivo: 9 } },
      { id: '1-WEB-2026-00000010', huella: consecutivoEs(10), doble: { consecutivo: 10 } },
      { id: '1-WEB-2026-00000011', huella: consecutivoEs(11), doble: { consecutivo: 11 } },
      { id: '1-WEB-2026-00000012', huella: consecutivoEs(12), doble: { consecutivo: 12 } },
      { id: '1-WEB-2026-00000013', huella: consecutivoEs(13), doble: { consecutivo: 13 } },
      { id: '1-WEB-2026-00000014', huella: consecutivoEs(14), doble: { consecutivo: 14 } },
      { id: '1-WEB-2026-00000015', huella: consecutivoEs(15), doble: { consecutivo: 15 } },
      { id: '1-WEB-2026-00000016', huella: consecutivoEs(16), doble: { consecutivo: 16 } },
      { id: '1-OFICIO-2026-00000017', huella: consecutivoEs(17), doble: { consecutivo: 17 } },
      { id: '1-OFICIO-2026-00000018', huella: consecutivoEs(18), doble: { consecutivo: 18 } },
      { id: '1-OFICIO-2026-00000019', huella: consecutivoEs(19), doble: { consecutivo: 19 } },
      { id: '1-PRESENCIAL-2026-00000020', huella: consecutivoEs(20), doble: { consecutivo: 20 } },
      { id: '1-OFICIO-2026-00000021', huella: consecutivoEs(21), doble: { consecutivo: 21 } },
      { id: '1-EMAIL-2026-00000022', huella: consecutivoEs(22), doble: { consecutivo: 22 } },
      { id: '1-OFICIO-2026-00000023', huella: consecutivoEs(23), doble: { consecutivo: 23 } },
      { id: '1-WEB-2026-00000024', huella: consecutivoEs(24), doble: { consecutivo: 24 } },
      { id: '1-110-202608-00000027', huella: consecutivoEs(27), doble: { consecutivo: 27 } },
    ],
  },
};

function arg(n) { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; }
const proyectoOrdenado = arg('--proyecto');
const rondaPedida = arg('--ronda');
const modoEnsayo = process.argv.includes('--ensayo-stage');
const ejecutar = process.env.CONFIRMO_LIMPIEZA === 'SI';
if (!proyectoOrdenado) { console.error('Uso: --proyecto <project_id> --ronda <id> [--ensayo-stage]'); process.exit(1); }
/* La ronda es OBLIGATORIA y explícita: sin valor por defecto. Un default
   silencioso significaría que un comando incompleto ejecuta el acta
   equivocada sobre producción. */
if (!rondaPedida || !RONDAS[rondaPedida]) {
  console.error(`⛔ Falta --ronda o no existe. Rondas disponibles: ${Object.keys(RONDAS).join(', ')}`);
  process.exit(1);
}
const RONDA = RONDAS[rondaPedida];
const ACTA = RONDA.acta;
const BORRAR_RADICADOS = RONDA.borrarRadicados;
const BORRAR_EXPEDIENTES = RONDA.borrarExpedientes;
const ANULAR_RADICADOS = RONDA.anularRadicados;
const TOTAL_OBJETIVOS = BORRAR_RADICADOS.length + BORRAR_EXPEDIENTES.length + ANULAR_RADICADOS.length;

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

/* Lo que el humano compara contra su pantalla. El dry-run es la ÚNICA
   oportunidad de detectar que la lista señala a otra cosa de la que se cree:
   quien autoriza no puede confirmar ids a ciegas. */
function retrato(d) {
  const nombre = d?.esAnonimo ? '(identidad protegida)' : (d?.solicitante?.nombreCompleto ?? '—');
  const fecha = String(d?.fechaRadicacion ?? d?.fechaCreacion ?? '—').slice(0, 10);
  const asunto = String(d?.detalle?.asunto ?? '—').slice(0, 40);
  return `${fecha}  ${nombre.padEnd(34).slice(0, 34)}  ${d?.estadoActual ?? '—'}  ${asunto}`;
}

async function main() {
  console.log(`Ronda ${rondaPedida} · acta ${ACTA} · proyecto ${proyectoOrdenado}${modoEnsayo ? ' · ENSAYO' : ''}`);

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
      await db.collection('ventanilla_radicados').doc(pref(o.id)).set({
        ...(o.doble ?? {}), estadoActual: 'ASIGNADO', ensayoLimpieza: true,
      });
    }
  }

  /* ── FASE 1: verificación completa ANTES de cualquier escritura ────── */
  const fallos = [];
  const plan = [];
  for (const o of BORRAR_RADICADOS) {
    const ref = db.collection('ventanilla_radicados').doc(pref(o.id));
    const snap = await ref.get();
    if (!snap.exists) { fallos.push(`${pref(o.id)}: NO EXISTE`); continue; }
    const d = snap.data();
    if (!o.huella(d)) { fallos.push(`${pref(o.id)}: la huella NO coincide — el dato cambió desde el inventario`); continue; }
    /* GUARDA ESTRUCTURAL — la que faltaba. Un objetivo de BORRADO que guarda
       `consecutivo` consumió la serie anual: borrarlo deja un hueco
       indistinguible de una pérdida documental (AGN 060/2001). No se
       "corrige" reclasificándolo aquí: se aborta y se decide en un acta. */
    if (typeof d.consecutivo === 'number') {
      fallos.push(`${pref(o.id)}: tiene consecutivo ${d.consecutivo} — CONSUMIÓ la serie anual, NO se borra (debe ANULARSE con acta)`);
      continue;
    }
    plan.push({ accion: 'BORRAR', ref, id: pref(o.id), retrato: retrato(d) });
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
    else plan.push({ accion: 'BORRAR', ref, id: pref(o.id), retrato: 'expediente' });
  }
  for (const o of ANULAR_RADICADOS) {
    const ref = db.collection('ventanilla_radicados').doc(pref(o.id));
    const snap = await ref.get();
    if (!snap.exists) { fallos.push(`${pref(o.id)}: NO EXISTE`); continue; }
    const d = snap.data();
    if (!o.huella(d)) { fallos.push(`${pref(o.id)}: la huella NO coincide (consecutivo=${d.consecutivo ?? 'ausente'})`); continue; }
    if (d.anulado) { fallos.push(`${pref(o.id)}: YA está anulado`); continue; }
    plan.push({ accion: 'ANULAR', ref, id: pref(o.id), retrato: retrato(d) });
  }

  if (fallos.length) {
    console.error('⛔ VERIFICACIÓN FALLIDA — NADA se tocó (todo-o-nada):');
    for (const f of fallos) console.error('   · ' + f);
    process.exitCode = 4;
    return;
  }

  console.log(`Verificación: ${plan.length}/${TOTAL_OBJETIVOS} objetivos confirmados contra su huella.`);
  if (!ejecutar && !modoEnsayo) {
    console.log('\nDRY-RUN (sin CONFIRMO_LIMPIEZA=SI no se escribe nada).');
    console.log('COMPARE esta lista con lo que ve en pantalla antes de autorizar:\n');
    console.log('  ACCIÓN   RADICADO                     FECHA       SOLICITANTE                         ESTADO  ASUNTO');
    for (const p of plan) console.log(`  ${p.accion.padEnd(7)}  ${p.id.padEnd(27)}  ${p.retrato}`);
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
        anulado: { fecha: AHORA, motivo: RONDA.motivo, acta: ACTA },
        ultimaActualizacion: AHORA,
      });
      await p.ref.collection('trazabilidad').add({
        fecha: AHORA,
        accion: 'ANULACION_DATO_PRUEBA',
        actorUid: 'acta-limpieza',
        actorNombre: `Acta de limpieza pre-operación (autorizada por el propietario, ronda ${rondaPedida})`,
        nota: `Número anulado con constancia: dato de prueba dentro de la serie anual. Ver ${ACTA}.`,
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
  console.log(`\n✔ Ronda ${rondaPedida} ejecutada. Registrar el resultado en ${ACTA}.`);
}
await main();
