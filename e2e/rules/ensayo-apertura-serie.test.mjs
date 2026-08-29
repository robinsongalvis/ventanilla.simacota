/**
 * ENSAYO GENERAL DE LA APERTURA DE SERIE — el día real, ensayado antes.
 *
 * No es una prueba unitaria más: es el ORDEN COMPLETO de lo que va a pasar el
 * día que la plataforma empiece a radicar de verdad, corrido contra el emulador
 * real de Firestore, con el handler real de radicación y las funciones reales
 * de apertura. Nada reimplementado.
 *
 *   1. El contador está en un valor cualquiera (hoy, 27 de pruebas anuladas).
 *   2. Ensayo en seco: enseña el número real que se va a emitir. No escribe.
 *   3. Apertura: el contador queda listo, con el salto firmado por quien lo autoriza.
 *   4. Primera radicación real: sale EXACTAMENTE el número anunciado.
 *   5. EL ATAQUE — alguien mueve el contador hacia atrás a mano.
 *   6. La emisión falla EN ROJO y no escribe absolutamente nada.
 *   7. La vigilancia semanal lo nombra, con quién autorizó la apertura y cuándo.
 *   8. Restaurar "a ojo" tampoco basta: un número ya entregado no se re-entrega.
 *   9. Restaurado bien, la serie continúa donde iba.
 *
 * El paso 5 es el que pidió el propietario ver funcionando, no el de la
 * apertura limpia: «mover el contador hacia atrás a mano, intentar emitir, y
 * ver que falla en rojo sin escribir nada».
 *
 * DÓNDE CORRE. Contra el emulador, dentro del job `laboratorio-emulador`
 * (`npm run test:rules`, Java 21). No corre en esta máquina (Java 8) y NUNCA
 * contra Firestore real: `iniciarEntorno()` lanza si falta
 * `FIRESTORE_EMULATOR_HOST`. Cuando exista el proyecto de stage, el mismo
 * guion se corre allí apuntando el Admin SDK a stage — la secuencia no cambia.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/fase3-entorno.mjs';

let entorno;
let db;
let tipoSolicitudId;
let formatearRadicadoInstitucional;
let decidirApertura;
let construirRegistroApertura;
let describirIncoherenciaApertura;

const ANIO = new Date().getFullYear();
const COUNTER = `counters/radicados-${ANIO}`;

/** Lo que hay hoy en producción: 27 números, todos de prueba, ya anulados. */
const VALOR_ANTES_DE_ABRIR = 27;
/** Punto de apertura del ensayo. El del día real lo fija el propietario mirando el libro. */
const PUNTO_APERTURA = 1600;
const AUTORIZA = 'Secretaría General — ensayo';

/** Estado que había en el emulador antes del ensayo; se devuelve al final. */
let contadorOriginal;
const radicadosCreados = [];

before(async () => {
  entorno = await iniciarEntorno();
  db = entorno.getFirebaseAdminDb();

  const catalogo = await entorno.cargarModulo('@/lib/catalogos/tipos-solicitud');
  tipoSolicitudId = catalogo.TIPOS_SOLICITUD_INTERNOS_IDS[0];

  ({ formatearRadicadoInstitucional } = await entorno.cargarModulo('@/lib/radicado-institucional'));
  ({ decidirApertura, construirRegistroApertura } =
    await entorno.cargarModulo('@/lib/server/apertura-series'));
  ({ describirIncoherenciaApertura } =
    await entorno.cargarModulo('@/lib/server/consecutivo-legal'));

  const snap = await db.doc(COUNTER).get();
  contadorOriginal = snap.exists ? snap.data() : null;
});

after(async () => {
  // Deja el emulador como estaba: los radicados del ensayo y SUS RESERVAS.
  for (const id of radicadosCreados) {
    const traz = await db.collection(`ventanilla_radicados/${id}/trazabilidad`).get();
    await Promise.all(traz.docs.map((d) => d.ref.delete()));
    await db.doc(`ventanilla_radicados/${id}`).delete().catch(() => {});
    await db.doc(`unicidad_radicados/${id}`).delete().catch(() => {});
  }
  if (contadorOriginal) await db.doc(COUNTER).set(contadorOriginal);
  else await db.doc(COUNTER).delete().catch(() => {});
  await detenerEntorno();
});

// ── utilidades ────────────────────────────────────────────────────────────
async function leerCounter() {
  const snap = await db.doc(COUNTER).get();
  return snap.data() ?? {};
}

/** Escribe el contador tal cual — es lo que hace "alguien a mano". */
async function fijarCounter(datos) {
  await db.doc(COUNTER).set(datos);
}

async function contarDocs(coleccion) {
  const snap = await db.collection(coleccion).get();
  return snap.size;
}

function peticionRadicacion() {
  const fd = new FormData();
  const campos = {
    tipoSolicitudId,
    tipoPersona: 'NATURAL',
    tipoDocumento: 'CC',
    medioRecepcion: 'PRESENCIAL',
    nombreCompleto: 'Solicitante del ensayo de apertura',
    numeroDocumento: '900000777',
    asunto: 'Ensayo general de apertura de serie',
    descripcion: 'Generado por ensayo-apertura-serie.test.mjs — no es un trámite real.',
  };
  for (const [k, v] of Object.entries(campos)) fd.set(k, String(v));
  entorno.setSession({
    uid: 'ensayo-apertura',
    email: 'ensayo@simacota.gov.co',
    nombre: 'Recepción (ensayo)',
    rol: 'RECEPCIONISTA',
    tenantId: 'VENTANILLA_UNICA',
    activo: true,
  });
  return new Request('http://ensayo.local/api/radicacion/interna', { method: 'POST', body: fd });
}

async function radicar() {
  const res = await entorno.POST(peticionRadicacion());
  const body = await res.json();
  if (res.status === 200) radicadosCreados.push(body.radicadoId);
  return { status: res.status, body };
}

// ══════════════════════════════════════════════════════════════════════════
// PASO 1-2 · El ensayo en seco enseña el número real y NO escribe nada.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 1 · el dry-run anuncia el número real sin tocar el contador', async () => {
  await fijarCounter({ ultimo: VALOR_ANTES_DE_ABRIR, anio: ANIO });

  const decision = decidirApertura('radicados', VALOR_ANTES_DE_ABRIR, {
    desde: PUNTO_APERTURA,
    autorizadoPor: AUTORIZA,
  });

  assert.equal(decision.accion, 'ABRIR');
  assert.equal(decision.veniaDe, VALOR_ANTES_DE_ABRIR);
  assert.equal(decision.nuevoUltimo, PUNTO_APERTURA - 1);
  // Lo que verá el propietario en pantalla es el PRIMER RADICADO, no el interno.
  assert.equal(decision.nuevoUltimo + 1, PUNTO_APERTURA);

  const despues = await leerCounter();
  assert.equal(despues.ultimo, VALOR_ANTES_DE_ABRIR, 'el ensayo en seco no escribe');
  assert.equal(despues.apertura, undefined, 'el ensayo en seco no deja registro de apertura');
});

// ══════════════════════════════════════════════════════════════════════════
// PASO 3 · La apertura, con el salto firmado.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 2 · la apertura deja el contador listo y el salto con dueño', async () => {
  const decision = decidirApertura('radicados', VALOR_ANTES_DE_ABRIR, {
    desde: PUNTO_APERTURA,
    autorizadoPor: AUTORIZA,
    referencia: 'Acta de ensayo',
  });
  const registro = construirRegistroApertura(
    decision,
    { desde: PUNTO_APERTURA, autorizadoPor: AUTORIZA, referencia: 'Acta de ensayo' },
    new Date().toISOString(),
  );

  await fijarCounter({ ultimo: decision.nuevoUltimo, anio: ANIO, apertura: registro });

  const c = await leerCounter();
  assert.equal(c.ultimo, PUNTO_APERTURA - 1);
  assert.equal(c.apertura.abiertoEn, PUNTO_APERTURA);
  assert.equal(c.apertura.veniaDe, VALOR_ANTES_DE_ABRIR);
  assert.equal(c.apertura.autorizadoPor, AUTORIZA);
  // El porqué del salto viaja en el dato, no solo en un acta guardada aparte.
  assert.match(c.apertura.motivoDelSalto, /un hueco en la serie se explica/i);
});

// ══════════════════════════════════════════════════════════════════════════
// PASO 4 · La primera radicación real sale con el número anunciado.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 3 · el primer radicado real es exactamente el número anunciado', async () => {
  const esperado = formatearRadicadoInstitucional(PUNTO_APERTURA, new Date());

  const { status, body } = await radicar();
  assert.equal(status, 200, `esperaba 200, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.equal(body.consecutivo, PUNTO_APERTURA);
  assert.equal(body.radicadoId, esperado);

  // Y el número quedó RESERVADO: es lo que hace imposible repetirlo.
  const reserva = await db.doc(`unicidad_radicados/${body.radicadoId}`).get();
  assert.equal(reserva.exists, true, 'la emisión debe reservar el número');
  assert.equal(reserva.data().consecutivo, PUNTO_APERTURA);
});

// ══════════════════════════════════════════════════════════════════════════
// PASO 5-6 · EL ATAQUE. Contador movido a mano hacia atrás → rojo, sin escribir.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 4 · contador movido hacia atrás a mano: la emisión falla en rojo y NO escribe nada', async () => {
  const antes = await leerCounter();
  // El sabotaje: alguien deja el contador donde estaba antes de abrir, con el
  // registro de apertura intacto (restaurar un respaldo viejo hace justo esto).
  await fijarCounter({ ...antes, ultimo: VALOR_ANTES_DE_ABRIR });

  const radicadosAntes = await contarDocs('ventanilla_radicados');
  const reservasAntes = await contarDocs('unicidad_radicados');

  const { status, body } = await radicar();

  assert.notEqual(status, 200, `la emisión NO debía prosperar; obtuvo ${status}: ${JSON.stringify(body)}`);

  const counterDespues = await leerCounter();
  assert.equal(counterDespues.ultimo, VALOR_ANTES_DE_ABRIR, 'el contador no debe moverse');
  assert.equal(counterDespues.apertura.abiertoEn, PUNTO_APERTURA, 'la apertura sigue registrada');
  assert.equal(await contarDocs('ventanilla_radicados'), radicadosAntes, 'ningún radicado nuevo');
  assert.equal(await contarDocs('unicidad_radicados'), reservasAntes, 'ninguna reserva nueva');
});

// ══════════════════════════════════════════════════════════════════════════
// PASO 7 · La vigilancia semanal lo nombra — MISMA función que usa la emisión.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 5 · la vigilancia semanal nombra la incoherencia, con autor y valores', async () => {
  const c = await leerCounter();
  const hallazgo = describirIncoherenciaApertura('radicados', Number(c.ultimo), c.apertura);

  assert.ok(hallazgo, 'la vigilancia debe reportar el contador saboteado');
  assert.match(hallazgo, /radicados/);
  assert.match(hallazgo, new RegExp(String(PUNTO_APERTURA)));
  assert.match(hallazgo, new RegExp(String(VALOR_ANTES_DE_ABRIR)));
  assert.match(hallazgo, /Secretaría General/);
  assert.match(hallazgo, /movió hacia atrás/i);
});

// ══════════════════════════════════════════════════════════════════════════
// PASO 8 · Restaurar "a ojo" no basta. El 1600 ya se entregó.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 6 · restaurar al punto de apertura NO basta: el número ya entregado no se re-entrega', async () => {
  const antes = await leerCounter();
  // El error natural de quien corrige a las prisas: "lo dejo como quedó al abrir".
  await fijarCounter({ ...antes, ultimo: PUNTO_APERTURA - 1 });

  const radicadosAntes = await contarDocs('ventanilla_radicados');
  const { status, body } = await radicar();

  assert.notEqual(
    status,
    200,
    `1600 ya se entregó en el ensayo 3; volver a emitirlo debía abortar. Obtuvo ${status}: ${JSON.stringify(body)}`,
  );
  assert.equal(Number((await leerCounter()).ultimo), PUNTO_APERTURA - 1, 'el contador no avanza');
  assert.equal(await contarDocs('ventanilla_radicados'), radicadosAntes, 'ningún radicado nuevo');
});

// ══════════════════════════════════════════════════════════════════════════
// PASO 9 · Restaurado bien, la serie continúa donde iba.
// ══════════════════════════════════════════════════════════════════════════
test('ensayo 7 · con el contador en su valor verdadero, la serie continúa en el siguiente número', async () => {
  const antes = await leerCounter();
  await fijarCounter({ ...antes, ultimo: PUNTO_APERTURA });

  const { status, body } = await radicar();
  assert.equal(status, 200, `esperaba 200, obtuvo ${status}: ${JSON.stringify(body)}`);
  assert.equal(body.consecutivo, PUNTO_APERTURA + 1, 'continúa, no repite');

  const c = await leerCounter();
  assert.equal(Number(c.ultimo), PUNTO_APERTURA + 1);
  assert.equal(describirIncoherenciaApertura('radicados', Number(c.ultimo), c.apertura), null,
    'restaurada la coherencia, la vigilancia debe callar');
});
