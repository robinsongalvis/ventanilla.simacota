/**
 * EL ACTO DE RADICAR, BAJO CONCURRENCIA REAL — contra el emulador de Firestore.
 *
 * Lo que se prueba aquí no se puede probar con dobles: que dos peticiones
 * simultáneas sobre el MISMO expediente no produzcan dos radicaciones, que un
 * rechazo no consuma un número de la serie legal, y que un fallo a mitad no
 * deje ni el contador avanzado ni el estado movido.
 *
 * Corre el HANDLER REAL. Tres fronteras mockeadas y ninguna más — auth,
 * Storage y el candado R10; ver `support/acto-radicar-entorno.mjs`.
 *
 * DÓNDE CORRE. Job `laboratorio-emulador` (`npm run test:rules`, Java 21). No
 * corre en esta máquina (Java 8) y NUNCA contra Firestore real.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/acto-radicar-entorno.mjs';

let entorno;
let db;
let definicion;

const TENANT = 'SEC_PLANEACION';
const ANIO = new Date().getFullYear();
const COUNTER = `counters/expedientes-${ANIO}`;
/** Punto de apertura del ensayo — la serie exige apertura explícita. */
const ABRE_EN = 400;

const creados = [];

before(async () => {
  entorno = await iniciarEntorno();
  db = entorno.getFirebaseAdminDb();
  const mod = await entorno.cargarModulo('@/lib/motor-expedientes/definiciones/licencia-construccion-parcial');
  definicion = mod.DEFINICION_LICENCIA_CONSTRUCCION_PARCIAL;
});

after(async () => {
  for (const id of creados) {
    for (const sub of ['actuaciones', 'documentos']) {
      const snap = await db.collection(`expedientes/${id}/${sub}`).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    await db.doc(`expedientes/${id}`).delete().catch(() => {});
  }
  const reservas = await db.collection('unicidad_expedientes').get();
  await Promise.all(reservas.docs.map((d) => d.ref.delete()));
  await db.doc(COUNTER).delete().catch(() => {});
  await detenerEntorno();
});

/** Siembra un expediente COMPLETO y listo para radicar. Devuelve su id. */
async function sembrarExpedienteCompleto(sufijo, { completoDesde } = {}) {
  const id = `exp-concurrencia-${sufijo}`;
  const aportes = definicion.requisitos.map((r, i) => ({
    requisitoId: r.id,
    estado: 'APORTADO',
    documentoIds: [`${id}-doc-${i}`],
  }));

  await db.doc(`expedientes/${id}`).set({
    id,
    tenantId: TENANT,
    tramiteId: definicion.id,
    estado: 'EN_REVISION',
    estadoJuridico: 'PRESENTADA',
    solicitanteNombre: 'Solicitante del ensayo de concurrencia',
    solicitanteDocumento: '900000123',
    /* El contexto decide QUÉ requisitos aplican: sin él los condicionales
       quedan indeterminados y la completitud no puede afirmarse. */
    contexto: {
      esApoderado: false,
      predioRodeadoEspacioPublico: false,
      categoriaComplejidad: 'BAJA',
      sujetoTituloENSR10: true,
    },
    aportes,
    radicadoId: null,
    creadoEn: '2026-07-01T12:00:00.000Z',
    actualizadoEn: '2026-08-01T12:00:00.000Z',
    origen: 'REAL',
    /* SIN la marca de demostración, a propósito y dicho aquí: el guard de
       `esPrueba` es lo que impide que un expediente de demostración consuma la
       serie legal, y no se afloja para que una prueba sea más cómoda. Se
       siembra un expediente que NO es de demostración, en el laboratorio. */
    esPrueba: false,
    completitud: {
      completo: true,
      faltantes: [],
      aplicables: definicion.requisitos.length,
      evaluadoEn: '2026-08-01T12:00:00.000Z',
      completoDesde: completoDesde ?? '2026-08-01T12:00:00.000Z',
    },
  });

  // Los documentos que respaldan cada requisito (de ellos sale el ancla
  // cuando el expediente no trae el hecho registrado).
  await Promise.all(
    definicion.requisitos.map((r, i) =>
      db.doc(`expedientes/${id}/documentos/${id}-doc-${i}`).set({
        id: `${id}-doc-${i}`,
        tenantId: TENANT,
        nombre: r.nombre,
        requisitoId: r.id,
        creadoEn: '2026-08-01T12:00:00.000Z',
        versionVigente: { hashSha256: `hash-${i}`, subidoEn: '2026-08-01T12:00:00.000Z' },
      }),
    ),
  );

  creados.push(id);
  return id;
}

async function abrirSerie(en = ABRE_EN) {
  await db.doc(COUNTER).set({
    ultimo: en - 1,
    anio: ANIO,
    actualizadoEn: new Date().toISOString(),
    apertura: {
      veniaDe: 0,
      abiertoEn: en,
      fecha: new Date().toISOString(),
      autorizadoPor: 'ensayo de concurrencia',
      motivoDelSalto: 'Apertura sintética del laboratorio.',
    },
  });
}

async function leerContador() {
  const snap = await db.doc(COUNTER).get();
  return snap.exists ? Number(snap.data().ultimo) : null;
}

function peticion(id, body = { confirmo: true }) {
  entorno.setSession({
    uid: 'uid-planeacion',
    email: 'planeacion@simacota.gov.co',
    nombre: 'Funcionaria de Planeación',
    rol: 'FUNCIONARIO',
    tenantId: TENANT,
    activo: true,
  });
  return {
    req: new Request(`http://ensayo.local/api/licencias/expedientes/${id}/radicar`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

async function radicar(id, body) {
  const { req, ctx } = peticion(id, body);
  const res = await entorno.POST(req, ctx);
  return { status: res.status, body: await res.json() };
}

/**
 * Cada caso arranca con la serie en el mismo punto — y SIN reservas vivas.
 *
 * Rebobinar el contador dejando las reservas puestas es ilegítimo en
 * producción (detiene la emisión de la serie, que es justo la salvaguarda que
 * este repositorio añadió) y aquí producía un falso fallo: el caso 1 reservaba
 * el 0400, el `beforeEach` devolvía el contador a 399, y todos los casos
 * siguientes chocaban contra esa reserva para siempre.
 *
 * Es el MISMO residuo que se corrigió el 25-ago en
 * `fase3-radicacion-interna-concurrencia.test.mjs`, cometido otra vez en un
 * archivo nuevo. La lección no viajó con la lección: viajó con el archivo.
 */
beforeEach(async () => {
  const reservas = await db.collection('unicidad_expedientes').get();
  await Promise.all(reservas.docs.map((d) => d.ref.delete()));
  for (const id of creados) {
    const actuaciones = await db.collection(`expedientes/${id}/actuaciones`).get();
    await Promise.all(actuaciones.docs.map((d) => d.ref.delete()));
  }
  await abrirSerie();
});

// ══════════════════════════════════════════════════════════════════════════
test('el camino feliz: el número sale de la serie abierta y el término queda anclado', async () => {
  const id = await sembrarExpedienteCompleto('feliz');

  const { status, body } = await radicar(id);
  assert.equal(status, 200, `esperaba 200, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.equal(body.consecutivo, ABRE_EN, 'el primer número debe ser el punto de apertura');
  assert.equal(body.radicoAhora, true);

  const exp = (await db.doc(`expedientes/${id}`).get()).data();
  assert.equal(exp.estadoJuridico, 'RADICADA_EN_DEBIDA_FORMA');
  assert.equal(exp.numeroExpediente.numero, body.numeroExpediente);
  assert.equal(exp.numeroExpediente.año, ANIO, 'la grafía del año es la del modelo');
  assert.ok(exp.fechaRadicacionDebidaForma, 'la fecha jurídica queda en el raíz');
  assert.ok(exp.fechaAlertaConservadora, 'el término dejó de estar sin anclar');

  // El número quedó RESERVADO: es lo que hace imposible repetirlo.
  const reserva = await db.doc(`unicidad_expedientes/${body.numeroExpediente}`).get();
  assert.equal(reserva.exists, true);
  assert.equal(reserva.data().expedienteId, id, 'la reserva guarda su puntero inverso');

  // La actuación, con id determinista y el slug que el motor reconoce.
  const act = await db.doc(`expedientes/${id}/actuaciones/${id}-radicacion`).get();
  assert.equal(act.exists, true);
  assert.equal(act.data().tipo, 'radicacion-debida-forma');
  assert.equal(act.data().origen, 'REAL');
  assert.ok(act.data().selloServidor, 'la hora del acto la pone la base de datos');
});

// ══════════════════════════════════════════════════════════════════════════
/* EL CASO QUE CAZÓ EL DEFECTO. Antes del 26-ago-2026 las dos peticiones
   devolvían 500: ambas leían el contador en 399, ambas proponían 400, y la
   perdedora recibía ALREADY_EXISTS al reservar. Firestore NO reintenta ante
   eso —no es un aborto por contención— así que la operación se perdía. El
   número nunca se entregó dos veces: lo que se perdía era el trabajo de la
   funcionaria, con un mensaje que no le decía que reintentar bastaba. */
test('dos peticiones SIMULTÁNEAS sobre el mismo expediente: una radica, la otra no duplica', async () => {
  const id = await sembrarExpedienteCompleto('simultaneas');
  const antes = await leerContador();

  const [a, b] = await Promise.all([radicar(id), radicar(id)]);

  const ok = [a, b].filter((r) => r.status === 200);
  assert.equal(ok.length, 2, `ambas deben responder 200 (una radica, otra reproduce): ${JSON.stringify([a, b])}`);

  const radicaron = ok.filter((r) => r.body.radicoAhora === true);
  const repitieron = ok.filter((r) => r.body.yaEstaba === true);
  assert.equal(radicaron.length, 1, 'EXACTAMENTE una debe haber radicado');
  assert.equal(repitieron.length, 1, 'la otra debe reproducir lo escrito, no radicar de nuevo');
  assert.equal(
    repitieron[0].body.numeroExpediente,
    radicaron[0].body.numeroExpediente,
    'la que reproduce devuelve el MISMO número, no uno nuevo',
  );

  // Un solo número consumido, una sola actuación, una sola reserva.
  assert.equal(await leerContador(), antes + 1, 'el contador avanzó exactamente uno');
  const actuaciones = await db.collection(`expedientes/${id}/actuaciones`).get();
  const deRadicacion = actuaciones.docs.filter((d) => d.data().tipo === 'radicacion-debida-forma');
  assert.equal(deRadicacion.length, 1, 'una sola actuación de radicación');
});

// ══════════════════════════════════════════════════════════════════════════
test('N=4 peticiones a la vez: un solo número consumido, sin huecos', async () => {
  const id = await sembrarExpedienteCompleto('n4');
  const antes = await leerContador();

  const res = await Promise.all([radicar(id), radicar(id), radicar(id), radicar(id)]);
  res.forEach((r, i) => assert.equal(r.status, 200, `petición ${i}: ${JSON.stringify(r.body)}`));

  const numeros = new Set(res.map((r) => r.body.numeroExpediente));
  assert.equal(numeros.size, 1, `las 4 deben referirse al MISMO número, obtuvo ${[...numeros]}`);
  assert.equal(res.filter((r) => r.body.radicoAhora).length, 1, 'solo una radicó');
  assert.equal(await leerContador(), antes + 1, 'el contador avanzó UNA vez, no cuatro');
});

// ══════════════════════════════════════════════════════════════════════════
test('un rechazo NO consume número: la serie no paga los intentos fallidos', async () => {
  // Incompleto: le falta un requisito, así que el acto debe rechazar.
  const id = await sembrarExpedienteCompleto('incompleto');
  const exp = (await db.doc(`expedientes/${id}`).get()).data();
  await db.doc(`expedientes/${id}`).update({ aportes: exp.aportes.slice(0, 3) });

  const antes = await leerContador();
  const { status, body } = await radicar(id);

  assert.equal(status, 409, `esperaba 409 por incompletitud, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.equal(await leerContador(), antes, 'el contador NO se toca en un rechazo');
  const act = await db.doc(`expedientes/${id}/actuaciones/${id}-radicacion`).get();
  assert.equal(act.exists, false, 'no queda actuación de una radicación que no ocurrió');
  const despues = (await db.doc(`expedientes/${id}`).get()).data();
  assert.equal(despues.estadoJuridico, 'PRESENTADA', 'el estado no se movió');
});

// ══════════════════════════════════════════════════════════════════════════
test('la serie sin abrir se rechaza con su propio mensaje, no con un 500', async () => {
  const id = await sembrarExpedienteCompleto('sin-abrir');
  await db.doc(COUNTER).delete();

  const { status, body } = await radicar(id);
  assert.equal(status, 409, `esperaba 409, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.match(String(body.error), /serie/i, 'el mensaje debe decir qué serie hay que abrir');

  const despues = (await db.doc(`expedientes/${id}`).get()).data();
  assert.equal(despues.estadoJuridico, 'PRESENTADA', 'nada se movió');
});

// ══════════════════════════════════════════════════════════════════════════
test('el control optimista: si la evidencia cambió, el acto se rechaza sin escribir', async () => {
  const id = await sembrarExpedienteCompleto('optimista');
  const antes = await leerContador();

  const { status, body } = await radicar(id, { confirmo: true, anclaEsperada: '2020-01-01' });
  assert.equal(status, 409, `esperaba 409, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.match(String(body.error), /cambió mientras revisaba/i);
  assert.equal(await leerContador(), antes, 'un rechazo por control optimista tampoco consume número');
});

// ══════════════════════════════════════════════════════════════════════════
test('dos expedientes distintos a la vez: números distintos y contiguos, sin hueco', async () => {
  const [a, b] = await Promise.all([
    sembrarExpedienteCompleto('par-a'),
    sembrarExpedienteCompleto('par-b'),
  ]);
  const antes = await leerContador();

  const [ra, rb] = await Promise.all([radicar(a), radicar(b)]);
  assert.equal(ra.status, 200, JSON.stringify(ra.body));
  assert.equal(rb.status, 200, JSON.stringify(rb.body));

  const consecutivos = [ra.body.consecutivo, rb.body.consecutivo].sort((x, y) => x - y);
  assert.deepEqual(
    consecutivos,
    [antes + 1, antes + 2],
    `esperaba dos números contiguos sin hueco, obtuvo ${consecutivos}`,
  );
  assert.equal(await leerContador(), antes + 2);
});
