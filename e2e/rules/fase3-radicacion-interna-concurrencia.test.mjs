/**
 * Fase 3 — precondición #1 (pieza angular, decisión del propietario en el
 * PdC 2, ver `docs/CRONOGRAMA_PIEZA_ANGULAR.md`): concurrencia + fallo del
 * endpoint `POST /api/radicacion/interna` contra el EMULADOR REAL de
 * Firestore. Se ejecuta en CI dentro del job `laboratorio-emulador` (glob
 * `test:rules`, Java 21); NO corre localmente (Java 8, sin Docker —
 * ADR-0002/ADR-0007).
 *
 * Diferencia deliberada con el antipatrón `h3-atomicidad-integracion.test.mjs`
 * (hallazgo H1, QA): ese archivo REIMPLEMENTA inline la lógica de
 * consecutivo+documento y por tanto solo prueba que "un patrón similar"
 * funciona contra el emulador — nunca ejercita el código real del endpoint.
 * Este archivo importa y llama el HANDLER POST REAL de
 * `app/api/radicacion/interna/route.ts` (Admin SDK, transacción, `tx.create`,
 * trazabilidad, `consecutivo-legal.ts`) sin reimplementar nada de eso — ver
 * `support/fase3-entorno.mjs`.
 *
 * ── Fronteras mockeadas (documentadas, NINGUNA otra) ──────────────────────
 * 1. `@/lib/server/internal-auth` (auth de sesión) — el job solo levanta
 *    emulador de FIRESTORE (`--only firestore`); no hay emulador de Auth, y
 *    `requireActiveInternalUser()` real depende de `cookies()` de
 *    `next/headers` (contexto de petición Next.js real, inexistente al
 *    invocar el handler directamente). Ver `support/fase3-stub-internal-auth.mjs`.
 * 2. `@/lib/firebase-admin` → SOLO `getFirebaseAdminStorage()` (no hay
 *    emulador de Storage en el job). `getFirebaseAdminApp`/`getFirebaseAdminDb`
 *    se REEXPORTAN reales sin modificar. Ver `support/fase3-stub-firebase-admin.mjs`.
 *
 * TODO LO DEMÁS es real contra el emulador: transacciones, `tx.create`,
 * contadores (`counters/radicados-{año}`), trazabilidad
 * (`ventanilla_radicados/{id}/trazabilidad`), validación de magic bytes,
 * `consecutivo-legal.ts` SIN MODIFICAR.
 *
 * Aislamiento entre archivos de `e2e/rules/*.test.mjs`: comparten UN mismo
 * emulador dentro de la misma corrida de `firebase emulators:exec`, pero
 * `node --test` corre cada archivo en su propio proceso, y NINGÚN otro
 * archivo del repo toca `counters/radicados-{añoActual}` (el antipatrón usa
 * el año aislado 2999 a propósito). Aun así, este archivo NUNCA asume un
 * contador en cero: lee el valor base ANTES de cada caso y verifica por
 * DELTA — robusto sin importar qué haya en el contador al arrancar — y
 * restaura el contador + borra los radicados que crea, para no dejar
 * residuo si algo más comparte este proyecto de emulador en el futuro.
 */
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/fase3-entorno.mjs';

let entorno;
let db;
let tipoSolicitudId;
let formatearRadicadoInstitucional;

before(async () => {
  entorno = await iniciarEntorno();
  db = entorno.getFirebaseAdminDb();

  // Catálogo real — nunca se hardcodea un tipoSolicitudId textual (el
  // catálogo puede cambiar; el test no debe acoplarse a un valor concreto).
  const catalogo = await entorno.cargarModulo('@/lib/catalogos/tipos-solicitud');
  tipoSolicitudId = catalogo.TIPOS_SOLICITUD_INTERNOS_IDS[0];
  assert.ok(
    typeof tipoSolicitudId === 'string' && tipoSolicitudId.length > 0,
    'el catálogo debe exponer al menos un tipo de solicitud interno',
  );

  // Formateador puro REAL (el mismo que usa route.ts) — para predecir el id
  // del próximo radicado en el caso (b) sin duplicar la máscara a mano.
  const modIdInstitucional = await entorno.cargarModulo('@/lib/radicado-institucional');
  formatearRadicadoInstitucional = modIdInstitucional.formatearRadicadoInstitucional;
});

after(async () => {
  await detenerEntorno();
});

afterEach(() => {
  entorno.clearSession();
  entorno.limpiarAlmacenFalso();
});

function sesionMock(uid) {
  return {
    uid,
    email: `${uid}@simacota.gov.co`,
    nombre: `Recepción de prueba (${uid})`,
    rol: 'RECEPCIONISTA',
    tenantId: 'VENTANILLA_UNICA',
    activo: true,
  };
}

function construirFormData({ archivos = [], ...overrides } = {}) {
  const fd = new FormData();
  const base = {
    tipoSolicitudId,
    tipoPersona: 'NATURAL',
    tipoDocumento: 'CC',
    medioRecepcion: 'PRESENCIAL',
    nombreCompleto: 'Solicitante de prueba — Fase 3',
    numeroDocumento: '900000001',
    asunto: 'Prueba de concurrencia H1 — Fase 3 (precondición #1)',
    descripcion: 'Radicación generada por fase3-radicacion-interna-concurrencia.test.mjs',
    ...overrides,
  };
  for (const [clave, valor] of Object.entries(base)) {
    if (valor !== undefined && valor !== null) fd.set(clave, String(valor));
  }
  for (const archivo of archivos) fd.append('archivos', archivo);
  return fd;
}

function peticion(formData) {
  return new Request('http://fase3-lab.local/api/radicacion/interna', {
    method: 'POST',
    body: formData,
  });
}

/** PDF mínimo válido para `verificarMagicBytes` (H-08) — firma `%PDF-` real. */
function archivoPdfFalso(nombre = 'evidencia-fase3.pdf') {
  const contenido = Buffer.from(
    '%PDF-1.4\n% fase3-radicacion-interna-concurrencia — evidencia sintética, no es un PDF real.\n',
  );
  return new File([contenido], nombre, { type: 'application/pdf' });
}

async function leerContador(anio) {
  const snap = await db.doc(`counters/radicados-${anio}`).get();
  return Number(snap.data()?.ultimo ?? 0);
}

async function restaurarContador(anio, valor) {
  await db.doc(`counters/radicados-${anio}`).set(
    { ultimo: valor, anio, actualizadoEn: new Date().toISOString() },
    { merge: true },
  );
}

async function borrarRadicado(radicadoId) {
  const trazSnap = await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).get();
  await Promise.all(trazSnap.docs.map((d) => d.ref.delete()));
  await db.doc(`ventanilla_radicados/${radicadoId}`).delete();
}

// ══════════════════════════════════════════════════════════════════════════
// (a) Dos POST CONCURRENTES reales → ambos 200, consecutivos DISTINTOS y sin
//     hueco. Incluye UN adjunto por petición para ejercitar también la
//     frontera de Storage mockeada (staging → finalize).
// ══════════════════════════════════════════════════════════════════════════
test('concurrencia real: 2 POST simultáneos → ambos 200, consecutivos distintos y sin hueco', async () => {
  entorno.setSession(sesionMock('fase3-uid-2-concurrentes'));
  const anio = new Date().getFullYear();
  const baseline = await leerContador(anio);

  const [r1, r2] = await Promise.all([
    entorno.POST(peticion(construirFormData({ archivos: [archivoPdfFalso('adjunto-1.pdf')] }))),
    entorno.POST(peticion(construirFormData({ archivos: [archivoPdfFalso('adjunto-2.pdf')] }))),
  ]);
  const [b1, b2] = await Promise.all([r1.json(), r2.json()]);

  assert.equal(r1.status, 200, `petición 1 esperaba 200, obtuvo ${r1.status}: ${JSON.stringify(b1)}`);
  assert.equal(r2.status, 200, `petición 2 esperaba 200, obtuvo ${r2.status}: ${JSON.stringify(b2)}`);

  assert.notEqual(b1.radicadoId, b2.radicadoId, 'los dos radicadoId deben ser distintos');
  assert.notEqual(b1.consecutivo, b2.consecutivo, 'los dos consecutivos deben ser distintos');

  const consecutivos = [b1.consecutivo, b2.consecutivo].sort((x, y) => x - y);
  assert.deepEqual(
    consecutivos,
    [baseline + 1, baseline + 2],
    `esperaba [${baseline + 1}, ${baseline + 2}] sin hueco, obtuvo [${consecutivos}]`,
  );

  const final = await leerContador(anio);
  assert.equal(final, baseline + 2, 'el contador final debe reflejar exactamente 2 incrementos');

  assert.equal(b1.archivosSubidos, 1, 'la petición 1 debe reportar 1 archivo subido');
  assert.equal(b2.archivosSubidos, 1, 'la petición 2 debe reportar 1 archivo subido');

  // Frontera de Storage: el "finalize" (move staging→final) debe haberse
  // completado para los 2 adjuntos, en la ruta final esperada.
  const almacen = entorno.inspeccionarAlmacenFalso();
  const rutasFinal = [...almacen.entries()]
    .filter(([, meta]) => meta.etapa === 'final')
    .map(([ruta]) => ruta);
  assert.ok(
    rutasFinal.some((r) => r.startsWith(`radicados/${b1.radicadoId}/`)),
    'debe existir un adjunto finalizado bajo la ruta del radicado 1',
  );
  assert.ok(
    rutasFinal.some((r) => r.startsWith(`radicados/${b2.radicadoId}/`)),
    'debe existir un adjunto finalizado bajo la ruta del radicado 2',
  );

  await Promise.all([borrarRadicado(b1.radicadoId), borrarRadicado(b2.radicadoId)]);
  await restaurarContador(anio, baseline);
});

// ══════════════════════════════════════════════════════════════════════════
// (b) Fallo inyectado a mitad de la transacción: se siembra DE ANTEMANO un
//     documento en el id exacto que `tx.create` va a tomar → colisión →
//     ALREADY_EXISTS → la tx entera aborta → 500. Verifica que NI el
//     contador avanzó NI se creó trazabilidad NI se alteró el doc sembrado.
// ══════════════════════════════════════════════════════════════════════════
test('fallo inyectado (colisión de tx.create) → 500 y nada se compromete (contador, doc, trazabilidad)', async () => {
  entorno.setSession(sesionMock('fase3-uid-colision'));
  const anio = new Date().getFullYear();
  const baseline = await leerContador(anio);
  const consecutivoPredicho = baseline + 1;
  const ahora = new Date();
  const radicadoIdPredicho = formatearRadicadoInstitucional(consecutivoPredicho, ahora);

  // Siembra la colisión: mismo id que tomará el próximo tx.create.
  await db.doc(`ventanilla_radicados/${radicadoIdPredicho}`).set({
    __fase3TestFixture: true,
    nota: 'Sembrado a propósito por fase3-radicacion-interna-concurrencia.test.mjs para forzar colisión en tx.create.',
  });

  const res = await entorno.POST(peticion(construirFormData()));
  const body = await res.json();

  assert.equal(
    res.status,
    500,
    `esperaba 500 por colisión de tx.create, obtuvo ${res.status}: ${JSON.stringify(body)}`,
  );

  const finalCounter = await leerContador(anio);
  assert.equal(
    finalCounter,
    baseline,
    'el contador NO debe avanzar: confirmarConsecutivosLegales está en la MISMA tx que el tx.create que colisionó',
  );

  const snapDespues = await db.doc(`ventanilla_radicados/${radicadoIdPredicho}`).get();
  assert.equal(
    snapDespues.data()?.__fase3TestFixture,
    true,
    'el doc pre-existente no debe haberse sobrescrito (tx.create es fail-closed)',
  );

  const traz = await db.collection(`ventanilla_radicados/${radicadoIdPredicho}/trazabilidad`).get();
  assert.equal(traz.size, 0, 'no debe existir trazabilidad para una tx que abortó');

  await db.doc(`ventanilla_radicados/${radicadoIdPredicho}`).delete();
});

// ══════════════════════════════════════════════════════════════════════════
// (c) N=5 concurrentes → contención real del contador bajo transacciones que
//     reintentan → serie COMPLETA sin huecos ni duplicados.
// ══════════════════════════════════════════════════════════════════════════
test('reintento de contención real: N=5 concurrentes → serie completa sin huecos ni duplicados', async () => {
  entorno.setSession(sesionMock('fase3-uid-n5-contencion'));
  const N = 5;
  const anio = new Date().getFullYear();
  const baseline = await leerContador(anio);

  const resultados = await Promise.all(
    Array.from({ length: N }, () => entorno.POST(peticion(construirFormData()))),
  );
  const cuerpos = await Promise.all(resultados.map((r) => r.json()));

  resultados.forEach((r, i) => {
    assert.equal(r.status, 200, `petición ${i} esperaba 200, obtuvo ${r.status}: ${JSON.stringify(cuerpos[i])}`);
  });

  const consecutivos = cuerpos.map((b) => b.consecutivo).sort((x, y) => x - y);
  const esperados = Array.from({ length: N }, (_, i) => baseline + i + 1);
  assert.deepEqual(
    consecutivos,
    esperados,
    `serie sin huecos ni duplicados esperada [${esperados}], obtuvo [${consecutivos}]`,
  );

  const idsUnicos = new Set(cuerpos.map((b) => b.radicadoId));
  assert.equal(idsUnicos.size, N, `los ${N} radicadoId deben ser todos únicos`);

  const finalCounter = await leerContador(anio);
  assert.equal(finalCounter, baseline + N, `el contador final debe ser exactamente baseline+${N}`);

  await Promise.all(cuerpos.map((b) => borrarRadicado(b.radicadoId)));
  await restaurarContador(anio, baseline);
});
