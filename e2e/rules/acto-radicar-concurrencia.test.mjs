/**
 * EL ACTO DE RADICAR, BAJO CONCURRENCIA REAL — contra el emulador de Firestore.
 *
 * EL NÚMERO NO SE EMITE: SE TRANSCRIBE del libro de ventanilla (decisión del
 * propietario, 26-ago-2026). Eso cambia lo que hay que probar: ya no es que un
 * contador avance sin huecos, sino que DOS TRÁMITES NO PUEDAN LLEVARSE EL MISMO
 * NÚMERO del libro — ni escribiéndolo igual, ni escribiéndolo distinto.
 *
 * Lo que aquí se prueba no se puede probar con dobles: la reserva es una
 * garantía del motor de la base de datos, no de nuestro código.
 *
 * Corre el HANDLER REAL. Fronteras mockeadas: auth y Storage, ninguna más.
 * DÓNDE CORRE: job `laboratorio-emulador` (Java 21). Nunca contra Firestore real.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/acto-radicar-entorno.mjs';

let entorno;
let db;
let definicion;

const TENANT = 'SEC_PLANEACION';
/** Como lo escribe el operario mirando el libro: cinco dígitos. */
const LIBRO = (n) => `1-110-202608-${String(n).padStart(5, '0')}`;
/** Como queda grabado: la forma canónica del sistema, ocho dígitos. */
const CANONICO = (n) => `1-110-202608-${String(n).padStart(8, '0')}`;

const creados = [];

before(async () => {
  entorno = await iniciarEntorno();
  db = entorno.getFirebaseAdminDb();
  const mod = await entorno.cargarModulo('@/lib/motor-expedientes/definiciones/licencia-construccion-parcial');
  definicion = mod.DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL;
});

async function borrarReservasDelEnsayo() {
  const reservas = await db.collection('unicidad_radicados').get();
  await Promise.all(
    reservas.docs.filter((d) => d.id.startsWith('1-110-202608-')).map((d) => d.ref.delete()),
  );
}

after(async () => {
  for (const id of creados) {
    for (const sub of ['actuaciones', 'documentos']) {
      const snap = await db.collection(`expedientes/${id}/${sub}`).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    await db.doc(`expedientes/${id}`).delete().catch(() => {});
  }
  await borrarReservasDelEnsayo();
  await detenerEntorno();
});

/**
 * Cada caso arranca sin reservas de este ensayo y con los expedientes en
 * PRESENTADA. Borrar las reservas es obligatorio: son justamente lo que impide
 * que un número se entregue dos veces, así que dejarlas vivas entre casos haría
 * fallar a los siguientes por un motivo que no es el suyo — el mismo residuo
 * que ya se corrigió dos veces en este repositorio.
 */
beforeEach(async () => {
  await borrarReservasDelEnsayo();
  for (const id of creados) {
    const actuaciones = await db.collection(`expedientes/${id}/actuaciones`).get();
    await Promise.all(actuaciones.docs.map((d) => d.ref.delete()));
  }
});

/** Siembra (o restaura) un expediente COMPLETO y listo para radicar. */
async function sembrarExpedienteCompleto(sufijo) {
  const id = `exp-concurrencia-${sufijo}`;
  const aportes = definicion.requisitos.map((r, i) => ({
    requisitoId: r.id, estado: 'APORTADO', documentoIds: [`${id}-doc-${i}`],
  }));

  await db.doc(`expedientes/${id}`).set({
    id, tenantId: TENANT, tramiteId: definicion.id,
    estado: 'EN_REVISION', estadoJuridico: 'PRESENTADA',
    solicitanteNombre: 'Solicitante del ensayo de concurrencia',
    solicitanteDocumento: '900000123',
    contexto: {
      esApoderado: false, predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA', sujetoTituloENSR10: true,
    },
    aportes, radicadoId: null,
    creadoEn: '2026-07-01T12:00:00.000Z',
    actualizadoEn: '2026-08-01T12:00:00.000Z',
    origen: 'REAL',
    /* SIN la marca de demostración, a propósito y dicho aquí: ese guard es lo
       que impide que un expediente de demostración se lleve un número del libro
       de ventanilla, y no se afloja para que una prueba sea más cómoda. */
    esPrueba: false,
    completitud: {
      completo: true, faltantes: [], aplicables: definicion.requisitos.length,
      evaluadoEn: '2026-08-01T12:00:00.000Z', completoDesde: '2026-08-01T12:00:00.000Z',
    },
  });

  await Promise.all(definicion.requisitos.map((r, i) =>
    db.doc(`expedientes/${id}/documentos/${id}-doc-${i}`).set({
      id: `${id}-doc-${i}`, tenantId: TENANT, nombre: r.nombre, requisitoId: r.id,
      creadoEn: '2026-08-01T12:00:00.000Z',
      versionVigente: { hashSha256: `hash-${i}`, subidoEn: '2026-08-01T12:00:00.000Z' },
    })));

  if (!creados.includes(id)) creados.push(id);
  return id;
}

async function radicar(id, numeroRadicado, extra = {}) {
  entorno.setSession({
    uid: 'uid-planeacion', email: 'planeacion@simacota.gov.co',
    nombre: 'Funcionaria de Planeación', rol: 'FUNCIONARIO',
    tenantId: TENANT, activo: true,
  });
  const res = await entorno.POST(
    new Request(`http://ensayo.local/api/licencias/expedientes/${id}/radicar`, {
      method: 'POST',
      body: JSON.stringify({ confirmo: true, numeroRadicado, ...extra }),
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: res.status, body: await res.json() };
}

const existeReserva = async (n) => (await db.doc(`unicidad_radicados/${n}`).get()).exists;

// ══════════════════════════════════════════════════════════════════════════
test('el camino feliz: queda grabado el número del libro, en forma canónica', async () => {
  const id = await sembrarExpedienteCompleto('feliz');

  const { status, body } = await radicar(id, LIBRO(1342));
  assert.equal(status, 200, `esperaba 200, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.equal(body.numeroExpediente, CANONICO(1342), 'se graba la forma canónica');
  assert.equal(body.loQueEscribio, LIBRO(1342), 'y consta lo que el operario escribió');
  assert.equal(body.seNormalizo, true, 'la pantalla debe poder avisarle del relleno');

  const exp = (await db.doc(`expedientes/${id}`).get()).data();
  assert.equal(exp.estadoJuridico, 'RADICADA_EN_DEBIDA_FORMA');
  assert.equal(exp.numeroExpediente.numero, CANONICO(1342));
  assert.equal(exp.numeroExpediente.serieId, 'radicados', 'la serie es la de VENTANILLA');
  assert.ok(exp.fechaRadicacionDebidaForma, 'la fecha jurídica queda en el raíz');
  assert.ok(exp.fechaAlertaConservadora, 'el término dejó de estar sin anclar');

  assert.equal(await existeReserva(CANONICO(1342)), true, 'el número queda reservado');
  const reserva = (await db.doc(`unicidad_radicados/${CANONICO(1342)}`).get()).data();
  assert.equal(reserva.origenDelNumero, 'TRANSCRITO_DEL_LIBRO');
  assert.equal(reserva.expedienteId, id);

  const act = (await db.doc(`expedientes/${id}/actuaciones/${id}-radicacion`).get()).data();
  assert.equal(act.tipo, 'radicacion-debida-forma');
  assert.ok(act.selloServidor, 'la hora del acto la pone la base de datos');
});

// ══════════════════════════════════════════════════════════════════════════
test('dos peticiones SIMULTÁNEAS sobre el mismo expediente: una radica, la otra reproduce', async () => {
  const id = await sembrarExpedienteCompleto('simultaneas');

  const [a, b] = await Promise.all([radicar(id, LIBRO(1350)), radicar(id, LIBRO(1350))]);
  const ok = [a, b].filter((r) => r.status === 200);
  assert.equal(ok.length, 2, `ambas debían responder 200: ${JSON.stringify([a, b])}`);
  assert.equal(ok.filter((r) => r.body.radicoAhora).length, 1, 'EXACTAMENTE una radica');
  assert.equal(ok.filter((r) => r.body.yaEstaba).length, 1, 'la otra reproduce lo escrito');

  const actuaciones = await db.collection(`expedientes/${id}/actuaciones`).get();
  const deRadicacion = actuaciones.docs.filter((d) => d.data().tipo === 'radicacion-debida-forma');
  assert.equal(deRadicacion.length, 1, 'una sola actuación de radicación');
});

// ══════════════════════════════════════════════════════════════════════════
/* LA PROPIEDAD QUE MÁS IMPORTA DEL MODELO NUEVO. Dos trámites distintos no
   pueden llevarse el mismo número del libro — ni aunque dos funcionarias lo
   tecleen a la vez. Antes lo garantizaba un contador; ahora lo garantiza la
   reserva, que es una garantía del motor de la base de datos. */
test('dos expedientes DISTINTOS con el MISMO número: uno lo toma, el otro se rechaza', async () => {
  const a = await sembrarExpedienteCompleto('mismo-numero-a');
  const b = await sembrarExpedienteCompleto('mismo-numero-b');

  const [ra, rb] = await Promise.all([radicar(a, LIBRO(1360)), radicar(b, LIBRO(1360))]);
  const exitos = [ra, rb].filter((r) => r.status === 200);
  const rechazos = [ra, rb].filter((r) => r.status !== 200);

  assert.equal(exitos.length, 1, `solo uno podía quedárselo: ${JSON.stringify([ra, rb])}`);
  assert.equal(rechazos.length, 1, 'el otro tiene que ser rechazado, no duplicar');

  const perdedor = ra.status === 200 ? b : a;
  const doc = (await db.doc(`expedientes/${perdedor}`).get()).data();
  assert.equal(doc.estadoJuridico, 'PRESENTADA', 'el rechazado no se movió');
});

// ══════════════════════════════════════════════════════════════════════════
/* Dos escrituras del MISMO número. Si la normalización no fuera canónica,
   `01370` y `00001370` parecerían números distintos y la reserva no vería la
   colisión: dos licencias con el mismo radicado, en silencio. */
test('el mismo número escrito de dos formas colisiona igual', async () => {
  const a = await sembrarExpedienteCompleto('forma-corta');
  const b = await sembrarExpedienteCompleto('forma-larga');

  const primera = await radicar(a, '1-110-202608-1370');
  assert.equal(primera.status, 200, JSON.stringify(primera.body));
  assert.equal(primera.body.numeroExpediente, CANONICO(1370));

  const segunda = await radicar(b, '1-110-202608-00001370');
  assert.notEqual(segunda.status, 200, 'la segunda forma del MISMO número debe rechazarse');
});

// ══════════════════════════════════════════════════════════════════════════
test('un número mal escrito se rechaza sin tocar nada', async () => {
  const id = await sembrarExpedienteCompleto('mal-escrito');

  const { status, body } = await radicar(id, '68745-0-26-0046');
  assert.equal(status, 400, `esperaba 400, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.match(String(body.error), /libro de ventanilla/i);

  const doc = (await db.doc(`expedientes/${id}`).get()).data();
  assert.equal(doc.estadoJuridico, 'PRESENTADA', 'nada se movió');
  assert.equal((await db.doc(`expedientes/${id}/actuaciones/${id}-radicacion`).get()).exists, false);
});

// ══════════════════════════════════════════════════════════════════════════
test('un rechazo por incompletitud NO quema el número: se puede volver a usar', async () => {
  const id = await sembrarExpedienteCompleto('incompleto');
  const exp = (await db.doc(`expedientes/${id}`).get()).data();
  await db.doc(`expedientes/${id}`).update({ aportes: exp.aportes.slice(0, 3) });

  const rechazo = await radicar(id, LIBRO(1380));
  assert.equal(rechazo.status, 409, JSON.stringify(rechazo.body));
  assert.equal(await existeReserva(CANONICO(1380)), false, 'un intento fallido no reserva el número');

  await db.doc(`expedientes/${id}`).update({ aportes: exp.aportes });
  const segundo = await radicar(id, LIBRO(1380));
  assert.equal(segundo.status, 200, JSON.stringify(segundo.body));
  assert.equal(segundo.body.numeroExpediente, CANONICO(1380));
});

// ══════════════════════════════════════════════════════════════════════════
test('el control optimista: si la evidencia cambió, se rechaza sin reservar el número', async () => {
  const id = await sembrarExpedienteCompleto('optimista');

  const { status, body } = await radicar(id, LIBRO(1390), { anclaEsperada: '2020-01-01' });
  assert.equal(status, 409, `esperaba 409, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.match(String(body.error), /cambió mientras revisaba/i);
  assert.equal(await existeReserva(CANONICO(1390)), false, 'tampoco quema el número');
});
