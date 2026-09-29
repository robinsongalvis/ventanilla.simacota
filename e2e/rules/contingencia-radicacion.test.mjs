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
const actor = { uid: 'contingencia-emulador', nombre: 'Recepción sintética local', email: 'test@example.invalid', rol: 'RECEPCIONISTA', tenantId: 'VENTANILLA_UNICA', activo: true };

before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-ventanilla-lab');
  assert.equal(Boolean(process.env.FIREBASE_SERVICE_ACCOUNT), false, 'No se aceptan credenciales reales');
  entorno = await iniciarEntorno({ contingencia: true });
  db = entorno.getFirebaseAdminDb();
  const fechas = await entorno.cargarModulo('@/lib/fecha-colombia');
  anio = fechas.periodoColombia(new Date()).anio;
  const catalogo = await entorno.cargarModulo('@/lib/catalogos/tipos-solicitud');
  tipoSolicitudId = catalogo.TIPOS_SOLICITUD_INTERNOS_IDS[0];
});
after(async () => {
  // Solo el documento artificial de colisión del emulador local. No dejar
  // bloqueado el siguiente caso de la batería; no existe credencial real.
  if (reservaColision) await reservaColision.delete();
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
