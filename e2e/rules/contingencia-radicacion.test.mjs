/** Handler real + Firestore emulator. Auth/Storage son fronteras declaradas;
 * NO equivale a la prueba Stage con sesión legítima. Nunca conecta a Production. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, detenerEntorno } from './support/fase3-entorno.mjs';

let entorno;
let db;
let anio;
let tipoSolicitudId;
let reservaColision;
let contadorOriginal;
let auditoriaAperturaId;
const radicadosCreados = [];
const PRIMER_NUMERO_SINTETICO = 41;
const actor = { uid: 'contingencia-emulador', nombre: 'Recepción sintética local', email: 'test@example.invalid', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA', activo: true };

before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-ventanilla-lab');
  assert.equal(Boolean(process.env.FIREBASE_SERVICE_ACCOUNT), false, 'No se aceptan credenciales reales');
  entorno = await iniciarEntorno({
    contingencia: true,
    proyectoAdminEmulado: 'ventanilla-simacota-stage',
  });
  assert.equal(entorno.getFirebaseAdminProjectId(), 'ventanilla-simacota-stage');
  db = entorno.getFirebaseAdminDb();
  const fechas = await entorno.cargarModulo('@/lib/fecha-colombia');
  const fechaApertura = new Date();
  anio = fechas.periodoColombia(fechaApertura).anio;
  const catalogo = await entorno.cargarModulo('@/lib/catalogos/tipos-solicitud');
  tipoSolicitudId = catalogo.TIPOS_SOLICITUD_INTERNOS_IDS[0];
  const counterRef = db.doc(`counters/radicados-${anio}`);
  const counterSnap = await counterRef.get();
  contadorOriginal = counterSnap.exists ? counterSnap.data() : null;
  await counterRef.set({ ultimo: PRIMER_NUMERO_SINTETICO - 1, anio });

  const { abrirSerieRadicadosUnaVez } = await entorno.cargarModulo('@/lib/server/apertura-series');
  const apertura = await abrirSerieRadicadosUnaVez({
    db,
    primerNumero: PRIMER_NUMERO_SINTETICO,
    actor: {
      uid: 'admin-apertura-emulador',
      nombre: 'Administración sintética local',
      rol: 'ADMIN',
      tenantId: 'VENTANILLA_UNICA',
    },
    fecha: fechaApertura,
  });
  assert.equal(apertura.ultimo, PRIMER_NUMERO_SINTETICO - 1);
  assert.equal(apertura.apertura.primerNumero, PRIMER_NUMERO_SINTETICO);
  auditoriaAperturaId = apertura.apertura.auditoriaId;
});
after(async () => {
  if (db) {
    // Solo datos sintéticos del emulador local; no existe credencial real.
    if (reservaColision) await reservaColision.delete().catch(() => {});
    for (const id of radicadosCreados) {
      const trazas = await db.collection(`ventanilla_radicados/${id}/trazabilidad`).get();
      await Promise.all(trazas.docs.map((doc) => doc.ref.delete()));
      await db.doc(`ventanilla_radicados/${id}`).delete().catch(() => {});
      await db.doc(`unicidad_radicados/${id}`).delete().catch(() => {});
    }
    if (auditoriaAperturaId) {
      await db.doc(`admin_auditoria/${auditoriaAperturaId}`).delete().catch(() => {});
    }
    const counterRef = db.doc(`counters/radicados-${anio}`);
    if (contadorOriginal) await counterRef.set(contadorOriginal);
    else await counterRef.delete().catch(() => {});
    entorno.limpiarAlmacenFalso();
  }
  await detenerEntorno();
});

function formulario(conArchivo = false) {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    tipoSolicitudId, tipoPresentacion: 'IDENTIFICADA', tipoPersona: 'NATURAL',
    tipoDocumento: 'CC', medioRecepcion: 'PRESENCIAL', nombreCompleto: 'Persona sintética emulador',
    numeroDocumento: 'EMULADOR-001', asunto: 'Contingencia sintética local', descripcion: 'Ningún dato ciudadano. Ensayo local.',
    soportesPendientes: JSON.stringify({ descripcion: 'Soporte sintético exclusivamente de emulador', cantidad: 1, custodiaTipo: 'FISICA_EN_VENTANILLA', custodiaReferencia: 'Archivador ficticio A', confirmacionCustodia: true }),
  })) f.set(key, value);
  if (conArchivo) f.set('archivos', new File(['%PDF-1.4 ficticio'], 'prueba.pdf', { type: 'application/pdf' }));
  return f;
}
function solicitar(conArchivo = false) {
  return entorno.POST(new Request('http://localhost/api/radicacion/interna', { method: 'POST', body: formulario(conArchivo) }));
}
async function contador() { return (await db.doc(`counters/radicados-${anio}`).get()).data()?.ultimo ?? 0; }

test('sin sesión/rol/archivo: ningún incremento ni Storage', async () => {
  const antes = await contador();
  entorno.clearSession();
  assert.equal((await solicitar()).status, 401);
  entorno.setSession({ ...actor, rol: 'FUNCIONARIO' });
  assert.equal((await solicitar()).status, 403);
  entorno.setSession(actor);
  assert.equal((await solicitar(true)).status, 400);
  assert.equal(await contador(), antes);
  assert.equal(entorno.inspeccionarAlmacenFalso().size, 0);
});

test('concurrencia real de contingencia: dos registros, dos reservas y trazas atómicas', async () => {
  entorno.setSession(actor);
  const antes = await contador();
  const respuestas = await Promise.all([solicitar(), solicitar()]);
  const datos = await Promise.all(respuestas.map((r) => r.json()));
  assert.deepEqual(respuestas.map((r) => r.status), [200, 200]);
  assert.deepEqual(datos.map((d) => d.consecutivo).sort((a, b) => a - b), [antes + 1, antes + 2]);
  for (const resultado of datos) {
    radicadosCreados.push(resultado.radicadoId);
    assert.equal(resultado.estadoAdjuntos, 'PENDIENTE_STORAGE');
    const ref = db.doc(`ventanilla_radicados/${resultado.radicadoId}`);
    const radicado = (await ref.get()).data();
    assert.equal(radicado.gestionAdjuntos.estado, 'PENDIENTE_STORAGE');
    assert.equal(radicado.gestionAdjuntos.registradoPor.uid, actor.uid);
    assert.equal(radicado.archivos.length, 0);
    assert.equal((await db.doc(`unicidad_radicados/${resultado.radicadoId}`).get()).exists, true);
    const trazas = await ref.collection('trazabilidad').get();
    assert.ok(trazas.docs.some((d) => d.data().accion === 'RADICACION'));
    assert.ok(trazas.docs.some((d) => d.data().accion === 'ADJUNTOS_PENDIENTES_STORAGE'));
  }
  assert.equal(await contador(), antes + 2);
  assert.equal(entorno.inspeccionarAlmacenFalso().size, 0);
});

test('reserva existente aborta toda la transacción sin incrementar ni crear radicado', async () => {
  entorno.setSession(actor);
  const antes = await contador();
  const { formatearRadicadoInstitucional } = await entorno.cargarModulo('@/lib/radicado-institucional');
  const id = formatearRadicadoInstitucional(antes + 1, new Date());
  reservaColision = db.doc(`unicidad_radicados/${id}`);
  await reservaColision.create({ consecutivo: antes + 1, origen: 'COLISION_SINTETICA_LOCAL' });
  assert.equal((await solicitar()).status, 500);
  assert.equal(await contador(), antes);
  assert.equal((await db.doc(`ventanilla_radicados/${id}`).get()).exists, false);
  assert.equal((await db.collection(`ventanilla_radicados/${id}/trazabilidad`).get()).size, 0);
});
