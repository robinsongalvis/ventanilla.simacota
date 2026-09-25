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
 *  · El número lo TRANSCRIBE el operario del libro de ventanilla — el sistema
 *    no lo inventa. Aquí se usa uno de los de PRUEBA (`1-110-202608-00027`),
 *    de la serie que se anuló con acta. El día del arranque, Robinson mira el
 *    libro real y escribe el que corresponda.
 *
 *  · El expediente se siembra SIN la marca `esPrueba`. Es deliberado y va
 *    dicho: el guard de `esPrueba` es lo que impide que un expediente de
 *    demostración consuma la serie legal, y NO se aflojó para que la
 *    demostración fuera más cómoda. Lo que se hizo fue sembrar, en el
 *    laboratorio, un expediente que no es de demostración.
 *
 *  · El acto ya NO emite de la serie `expedientes`, así que el candado R10 no
 *    le aplica: no se relajó nada — se quitó la emisión que ese candado
 *    custodiaba. Lo asevera `__tests__/radicar-no-emite-serie-propia.test.ts`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/acto-radicar-entorno.mjs';

let entorno;
let db;
let definicion;

const TENANT = 'SEC_PLANEACION';
const ANIO = new Date().getFullYear();
const EXP = 'demo-acto-radicar';
/** Lo que el operario lee en el libro y teclea, tal cual. */
const NUMERO_DEL_LIBRO = '1-110-202608-00027';
/** Lo que queda grabado: la forma canónica del sistema. */
const NUMERO_CANONICO = '1-110-202608-00000027';

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
  const reservas = await db.collection('unicidad_radicados').get();
  await Promise.all(reservas.docs.filter((d) => d.id === NUMERO_CANONICO).map((d) => d.ref.delete()));
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
  L(`  La funcionaria mira el LIBRO DE VENTANILLA y escribe:  ${NUMERO_DEL_LIBRO}`);
  L('  Y confirma el día que la pantalla le mostró.');
  L('');
  const { status, body } = await radicar({
    confirmo: true,
    numeroRadicado: NUMERO_DEL_LIBRO,
    anclaEsperada: p0.anclaPropuesta,
  });
  assert.equal(status, 200, `esperaba 200, obtuvo ${status}: ${JSON.stringify(body)}`);

  // ── DESPUÉS ────────────────────────────────────────────────────────────
  const despues = await verDetalle();
  const e1 = despues.expediente;
  const act = (await db.doc(`expedientes/${EXP}/actuaciones/${EXP}-radicacion`).get()).data();
  const reserva = await db.doc(`unicidad_radicados/${body.numeroExpediente}`).get();

  L('════════════════════════════════════════════════════════════════');
  L('  DESPUÉS DEL ACTO — el mismo expediente');
  L('════════════════════════════════════════════════════════════════');
  L(`  Estado .............. ${e1.estadoJuridico}`);
  L(`  NÚMERO DE RADICADO .. ${e1.numeroExpediente.numero}    ← el oficial, el del libro`);
  L(`  Lo que ella escribió  ${body.loQueEscribio}${body.seNormalizo ? '          (el sistema lo completó con ceros)' : ''}`);
  L(`  Serie ............... "${e1.numeroExpediente.serieId}" — la de ventanilla, año ${e1.numeroExpediente.año}`);
  L(`  El plazo corre desde  ${fecha(e1.fechaRadicacionDebidaForma)}          ← la fecha con efecto legal`);
  L(`  Vence (conservador) . ${fecha(e1.fechaAlertaConservadora)}`);
  L('');
  L('  Lo que quedó escrito, para quien lo audite dentro de un año:');
  L(`    Actuación ............ ${act.tipo}`);
  L(`    Quién lo declaró ..... ${act.actorNombre} (${act.actorRol})`);
  L(`    Fecha jurídica ....... ${fecha(act.fecha)}   — NO el instante del botón`);
  L(`    Hora del acto ........ la puso la base de datos (serverTimestamp)`);
  L(`    Requisitos faltantes . ${act.evidenciaRadicacion.requisitosFaltantes}`);
  L(`    De dónde sale la fecha ${act.evidenciaRadicacion.baseDelAncla === 'MOMENTO_REGISTRADO_DE_COMPLETITUD'
        ? 'del momento REGISTRADO en que la solicitud quedó completa'
        : `del documento ${act.evidenciaRadicacion.documentoQueFijaElAncla} (deducida)`}`);
  L(`    Último documento ..... ${act.evidenciaRadicacion.ultimoDocumentoAportado}`);
  L(`      su huella .......... ${act.evidenciaRadicacion.hashSha256}`);
  L(`    Número reservado en .. unicidad_radicados/${body.numeroExpediente}  (existe: ${reserva.exists})`);
  L('');
  L('  Y la pantalla ya no ofrece el acto:');
  L(`    ¿Procede radicar? ...... ${despues.computos.debidaForma.procede ? 'SÍ' : 'NO'} — ${despues.computos.debidaForma.motivo}`);
  L('');
  L('  ── Sobre este número ─────────────────────────────────────────');
  L('  Es uno de los de PRUEBA, de la serie anulada con acta, y la base es el');
  L('  emulador. El sistema NO lo inventó: lo recibió. El día del arranque,');
  L('  Robinson mira el libro real y escribe el que corresponda.');
  L('════════════════════════════════════════════════════════════════');
  L('');

  assert.equal(e1.estadoJuridico, 'RADICADA_EN_DEBIDA_FORMA');
  assert.equal(e1.numeroExpediente.numero, NUMERO_CANONICO, 'queda grabado el número del libro, normalizado');
  assert.equal(body.loQueEscribio, NUMERO_DEL_LIBRO, 'y consta lo que ella escribió');
  assert.equal(e1.numeroExpediente.serieId, 'radicados', 'la serie es la de ventanilla');
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
