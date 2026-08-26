/**
 * DEMOSTRACIÓN DEL ACTO DE RADICAR — de extremo a extremo, con el número y la
 * fecha reales a la vista.
 *
 * No es una prueba más: es el guion que el propietario pidió ver funcionando.
 * Imprime, en lenguaje llano, el expediente ANTES y DESPUÉS del acto, con lo
 * que la funcionaria vería en pantalla en cada momento.
 *
 * ── QUÉ ES REAL AQUÍ Y QUÉ NO ────────────────────────────────────────────
 *
 * REAL: el handler del acto, la transacción, la emisión del consecutivo, la
 * reserva de unicidad, el cálculo del término y la vista previa. Nada de eso
 * se reimplementa.
 *
 * SINTÉTICO, y dicho para que nadie lo confunda:
 *
 *  · La base de datos es el EMULADOR. Ningún contador de producción se toca,
 *    ni se puede: el arnés lanza si `FIRESTORE_EMULATOR_HOST` no está.
 *
 *  · El contador de la serie se siembra aquí, en un número inventado. El
 *    número que sale tiene la FORMA del número legal —`{dane}-{curaduría}-
 *    {AA}-{CCCC}`— pero pertenece a una base desechable. No es un número de
 *    la serie de Simacota, y no lo será hasta que el propietario abra la
 *    serie de verdad el día del arranque.
 *
 *  · El expediente se siembra SIN la marca `esPrueba`. Es deliberado y va
 *    dicho: el guard de `esPrueba` es lo que impide que un expediente de
 *    demostración consuma la serie legal, y NO se aflojó para que la
 *    demostración fuera más cómoda. Lo que se hizo fue sembrar, en el
 *    laboratorio, un expediente que no es de demostración.
 *
 *  · El candado R10 sigue CERRADO en el código. El arnés lo abre en una
 *    frontera declarada (`support/acto-radicar-stub-candado.mjs`). Esta
 *    demostración NO prueba que el candado esté cerrado; eso lo asevera
 *    `__tests__/expedientes-licencias-rutas-ejecucion.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/acto-radicar-entorno.mjs';

let entorno;
let db;
let definicion;

const TENANT = 'SEC_PLANEACION';
const ANIO = new Date().getFullYear();
const COUNTER = `counters/expedientes-${ANIO}`;
const EXP = 'demo-acto-radicar';
/** Punto de apertura inventado para el laboratorio. */
const ABRE_EN = 46;

const L = (texto = '') => console.log(`# ${texto}`);
const fecha = (iso) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'long' }).format(new Date(iso));

before(async () => {
  entorno = await iniciarEntorno();
  db = entorno.getFirebaseAdminDb();
  const mod = await entorno.cargarModulo('@/lib/motor-expedientes/definiciones/licencia-construccion-parcial');
  definicion = mod.DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL;
});

after(async () => {
  for (const sub of ['actuaciones', 'documentos']) {
    const snap = await db.collection(`expedientes/${EXP}/${sub}`).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await db.doc(`expedientes/${EXP}`).delete().catch(() => {});
  const reservas = await db.collection('unicidad_expedientes').get();
  await Promise.all(reservas.docs.map((d) => d.ref.delete()));
  await db.doc(COUNTER).delete().catch(() => {});
  await detenerEntorno();
});

function sesion() {
  entorno.setSession({
    uid: 'uid-planeacion', email: 'planeacion@simacota.gov.co',
    nombre: 'Ing. Planeación (demostración)', rol: 'FUNCIONARIO',
    tenantId: TENANT, activo: true,
  });
}

async function verDetalle() {
  const { GET } = await entorno.cargarModulo('@/app/api/licencias/expedientes/[id]/route.ts');
  sesion();
  const res = await GET(new Request(`http://demo.local/api/licencias/expedientes/${EXP}`), {
    params: Promise.resolve({ id: EXP }),
  });
  return res.json();
}

async function radicar(body) {
  sesion();
  const res = await entorno.POST(
    new Request(`http://demo.local/api/licencias/expedientes/${EXP}/radicar`, {
      method: 'POST', body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: EXP }) },
  );
  return { status: res.status, body: await res.json() };
}

test('DEMOSTRACIÓN — un expediente llevado de presentada a radicado', async () => {
  // ── Preparar el mostrador ──────────────────────────────────────────────
  const aportes = definicion.requisitos.map((r, i) => ({
    requisitoId: r.id, estado: 'APORTADO', documentoIds: [`${EXP}-doc-${i}`],
  }));
  const DIA_COMPLETO = '2026-08-18T12:00:00.000Z';

  await db.doc(COUNTER).set({
    ultimo: ABRE_EN - 1, anio: ANIO, actualizadoEn: new Date().toISOString(),
    apertura: {
      veniaDe: 0, abiertoEn: ABRE_EN, fecha: new Date().toISOString(),
      autorizadoPor: 'laboratorio (demostración)',
      motivoDelSalto: 'Serie sintética del emulador. NO es la serie de Simacota.',
    },
  });

  await db.doc(`expedientes/${EXP}`).set({
    id: EXP, tenantId: TENANT, tramiteId: definicion.id,
    estado: 'EN_REVISION', estadoJuridico: 'PRESENTADA',
    solicitanteNombre: 'Ana Lucía Martínez Peña', solicitanteDocumento: '37451209',
    contexto: {
      esApoderado: false, predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA', sujetoTituloENSR10: true,
    },
    aportes, radicadoId: null,
    creadoEn: '2026-07-30T14:20:00.000Z',
    actualizadoEn: DIA_COMPLETO,
    origen: 'REAL',
    esPrueba: false,
    completitud: {
      completo: true, faltantes: [], aplicables: definicion.requisitos.length,
      evaluadoEn: DIA_COMPLETO, completoDesde: DIA_COMPLETO,
    },
  });
  await Promise.all(definicion.requisitos.map((r, i) =>
    db.doc(`expedientes/${EXP}/documentos/${EXP}-doc-${i}`).set({
      id: `${EXP}-doc-${i}`, tenantId: TENANT, nombre: r.nombre, requisitoId: r.id,
      creadoEn: DIA_COMPLETO,
      versionVigente: { hashSha256: `sha256-sintetico-${i}`, subidoEn: DIA_COMPLETO },
    })));

  // ── ANTES ──────────────────────────────────────────────────────────────
  const antes = await verDetalle();
  const e0 = antes.expediente;
  const p0 = antes.computos.debidaForma;

  L('');
  L('════════════════════════════════════════════════════════════════');
  L('  ANTES DEL ACTO — lo que la funcionaria ve en pantalla');
  L('════════════════════════════════════════════════════════════════');
  L(`  Solicitante ......... ${e0.solicitanteNombre} — CC ${e0.solicitanteDocumento}`);
  L(`  Estado .............. ${e0.estadoJuridico}   (presentada, sin verificar)`);
  L(`  Número de expediente. ${e0.numeroExpediente?.numero ?? '— (todavía no tiene)'}`);
  L(`  Plazo legal ......... ${e0.fechaAlertaConservadora ?? 'AÚN NO HA EMPEZADO A CORRER'}`);
  L('');
  L('  La vista previa dice:');
  L(`    ¿Procede radicar? ...... ${p0.procede ? 'SÍ' : 'NO'}`);
  L(`    Documentos exigidos .... ${p0.requisitosAplicables} de ${definicion.requisitos.length} (los condicionales que no aplican no cuentan)`);
  L(`    El plazo arrancará el .. ${fecha(p0.anclaIso)}`);
  L(`    Esa fecha viene de ..... ${p0.baseDelAncla === 'MOMENTO_REGISTRADO_DE_COMPLETITUD'
        ? 'el momento REGISTRADO en que la solicitud quedó completa'
        : 'la fecha del último documento (deducida)'}`);
  L(`    Vencerá el ............. ${fecha(p0.venceraEl)}${p0.naceVencido ? '   ⚠ NACERÍA VENCIDO' : ''}`);
  L('');

  assert.equal(e0.estadoJuridico, 'PRESENTADA');
  assert.equal(e0.numeroExpediente, undefined, 'antes del acto NO hay número');
  assert.equal(e0.fechaAlertaConservadora ?? null, null, 'antes del acto el plazo NO corre');
  assert.equal(p0.procede, true);

  // ── EL ACTO ────────────────────────────────────────────────────────────
  L('  La funcionaria confirma el día que la pantalla le mostró.');
  L('');
  const { status, body } = await radicar({ confirmo: true, anclaEsperada: p0.anclaPropuesta });
  assert.equal(status, 200, `esperaba 200, obtuvo ${status}: ${JSON.stringify(body)}`);

  // ── DESPUÉS ────────────────────────────────────────────────────────────
  const despues = await verDetalle();
  const e1 = despues.expediente;
  const act = (await db.doc(`expedientes/${EXP}/actuaciones/${EXP}-radicacion`).get()).data();
  const reserva = await db.doc(`unicidad_expedientes/${body.numeroExpediente}`).get();

  L('════════════════════════════════════════════════════════════════');
  L('  DESPUÉS DEL ACTO — el mismo expediente');
  L('════════════════════════════════════════════════════════════════');
  L(`  Estado .............. ${e1.estadoJuridico}`);
  L(`  NÚMERO DE EXPEDIENTE  ${e1.numeroExpediente.numero}          ← el número oficial`);
  L(`  Consecutivo ......... ${body.consecutivo} de la serie "${e1.numeroExpediente.serieId}", año ${e1.numeroExpediente.año}`);
  L(`  El plazo corre desde  ${fecha(e1.fechaRadicacionDebidaForma)}          ← la fecha con efecto legal`);
  L(`  Vence (conservador) . ${fecha(e1.fechaAlertaConservadora)}`);
  L('');
  L('  Lo que quedó escrito, para quien lo audite dentro de un año:');
  L(`    Actuación ............ ${act.tipo}`);
  L(`    Quién lo declaró ..... ${act.actorNombre} (${act.actorRol})`);
  L(`    Fecha jurídica ....... ${fecha(act.fecha)}   — NO el instante del botón`);
  L(`    Hora del acto ........ la puso la base de datos (serverTimestamp)`);
  L(`    Requisitos faltantes . ${act.evidenciaRadicacion.requisitosFaltantes}`);
  L(`    Documento que fija    `);
  L(`      la fecha ........... ${act.evidenciaRadicacion.documentoQueFijaElAncla}`);
  L(`      su huella .......... ${act.evidenciaRadicacion.hashSha256}`);
  L(`    Base de la fecha ..... ${act.evidenciaRadicacion.baseDelAncla}`);
  L(`    Número reservado en .. unicidad_expedientes/${body.numeroExpediente}  (existe: ${reserva.exists})`);
  L('');
  L('  Y la pantalla ya no ofrece el acto:');
  L(`    ¿Procede radicar? ...... ${despues.computos.debidaForma.procede ? 'SÍ' : 'NO'} — ${despues.computos.debidaForma.motivo}`);
  L('');
  L('  ── Sobre este número ─────────────────────────────────────────');
  L('  Tiene la FORMA del número legal, pero salió de un contador sembrado');
  L('  en el emulador. NO pertenece a la serie de Simacota, y no lo hará');
  L('  hasta que se abra la serie de verdad el día del arranque.');
  L('════════════════════════════════════════════════════════════════');
  L('');

  assert.equal(e1.estadoJuridico, 'RADICADA_EN_DEBIDA_FORMA');
  assert.equal(body.consecutivo, ABRE_EN, 'el primer número es el punto de apertura sembrado');
  assert.ok(e1.fechaRadicacionDebidaForma, 'la fecha con efecto legal quedó en el expediente');
  assert.ok(e1.fechaAlertaConservadora, 'el término dejó de estar sin anclar');
  assert.equal(reserva.exists, true, 'el número quedó reservado');
  assert.equal(despues.computos.debidaForma.yaRadicada, true, 'no puede ofrecerse dos veces');

  // El plazo arranca el día en que la solicitud quedó completa, NO el día
  // del acto ni el día en que se abrió la carpeta.
  assert.equal(
    e1.fechaRadicacionDebidaForma.slice(0, 10),
    '2026-08-18',
    'el término ancla en el día registrado de completitud',
  );
  assert.notEqual(e1.fechaRadicacionDebidaForma.slice(0, 10), e0.creadoEn.slice(0, 10));
});
