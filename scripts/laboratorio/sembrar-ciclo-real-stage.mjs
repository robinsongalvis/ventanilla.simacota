/**
 * scripts/laboratorio/sembrar-ciclo-real-stage.mjs
 *
 * Monta EN STAGE el ensayo del ciclo completo autorizado por el propietario
 * (31-ago-2026): un expediente REAL (esPrueba: false) detenido exactamente en
 * el paso 3 del camino —«Radicar en legal y debida forma»— para que el
 * propietario pulse el botón y vea todo lo que viene después: la emisión, el
 * término arrancando, el semáforo, el acta.
 *
 * POR QUÉ ESTO NO PUEDE PASAR EN PRODUCCIÓN: allá el candado R10 fuerza
 * esPrueba en la creación y la puerta (c) de `planRadicarEnDebidaForma` lo
 * rechaza por dato. Aquí se siembra el dato que producción no puede fabricar,
 * porque stage NO es el registro oficial de nada: se borra entero sin
 * consecuencia (--limpiar) y ningún número de la serie legal se toca.
 *
 * LO QUE SIEMBRA, coherente con las puertas (a)–(g) del plan:
 *   · counters/expedientes-2026 con apertura en FORMA ÚNICA (abiertoEn
 *     numérico — la grafía del defecto del 26-ago, vigilada por
 *     apertura-forma-unica.test.ts).
 *   · la reserva en unicidad_expedientes (una serie POR COLECCIÓN, como exige
 *     el barrido del 30-ago).
 *   · el expediente PRESENTADA con contexto COMPLETO (las 4 claves de la
 *     definición) y los 13 obligatorios APORTADOS.
 *   · los 13 documentos con `creadoEn` inmutable escalonado — el ancla del
 *     término saldrá del ÚLTIMO (ayer), no del reloj (puerta g).
 *
 * GUARDA ANTI-PRODUCCIÓN: idéntica a los demás guiones del laboratorio.
 *
 * Uso:
 *   node scripts/laboratorio/sembrar-ciclo-real-stage.mjs [--limpiar]
 */
import { readFileSync } from 'node:fs';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const LOTE = 'CICLO-REAL-STAGE';
const EXP_ID = 'ensayo-ciclo-real-1';
const NUMERO = '68745-0-26-0001';
/* El radicado de VENTANILLA del que nace el expediente (ADR-0034: todo entra
   por ventanilla). Es el MISMO número que el propietario transcribe en el
   modal de radicar: al declararse la debida forma, la transacción escribe
   `vinculoExpediente` en este documento y ventanilla queda afirmando el
   número legal — la mitad del flujo que un expediente suelto no enseña. */
const RADICADO_ORIGEN = '1-110-202609-00000001';

const env = readFileSync('.env.stage', 'utf8');
const m = /^FIREBASE_SERVICE_ACCOUNT=(.*)$/m.exec(env);
if (!m) { console.error('No hay FIREBASE_SERVICE_ACCOUNT en .env.stage'); process.exit(2); }
const sa = JSON.parse(m[1]);
sa.private_key = sa.private_key?.replace(/\\n/g, '\n');
if (sa.project_id === PROYECTO_PROD) {
  console.error('⛔ GUARDA: el service account apunta a PRODUCCIÓN. Abortado.');
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
}
const db = getFirestore();
console.log(`Proyecto: ${sa.project_id} (stage verificado)`);

const hoy = new Date();
const dias = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d.toISOString(); };

/* Copia vigilada por __tests__/siembra-stage-coherente.test.ts (misma lista que
   sembrar-licencias-stage.mjs — si la definición cambia, ese test la caza). */
const REQUISITOS_OBLIGATORIOS = ['solicitud-escrita-titular', 'formulario-unico-nacional', 'certificado-tradicion-libertad', 'escritura-publica-predio', 'identidad-o-representacion-legal', 'declaracion-impuesto-predial', 'paz-y-salvo-municipal', 'certificacion-redam', 'proyecto-arquitectonico', 'disponibilidad-servicios-publicos', 'memorial-responsabilidad-profesionales', 'valla-citacion-vecinos', 'cancelacion-expensas'];

// ── limpieza del lote previo (siempre; --limpiar se queda ahí) ─────────────
const previos = await db.collection('expedientes').where('loteVerificacion', '==', LOTE).get();
for (const d of previos.docs) {
  const docsSub = await d.ref.collection('documentos').get();
  const actsSub = await d.ref.collection('actuaciones').get();
  const batchSub = db.batch();
  docsSub.docs.forEach((x) => batchSub.delete(x.ref));
  actsSub.docs.forEach((x) => batchSub.delete(x.ref));
  batchSub.delete(d.ref);
  await batchSub.commit();
}
await db.doc(`unicidad_expedientes/${NUMERO}`).delete().catch(() => {});
await db.doc(`ventanilla_radicados/${RADICADO_ORIGEN}`).delete().catch(() => {});
if (previos.size) console.log(`Lote previo eliminado: ${previos.size} expediente(s) con sus subcolecciones.`);

if (process.argv.includes('--limpiar')) {
  await db.doc('counters/expedientes-2026').delete().catch(() => {});
  console.log('Limpieza completada (contador incluido). No se sembró nada.');
  process.exit(0);
}

// ── 1 · el contador, con apertura en forma única ───────────────────────────
await db.doc('counters/expedientes-2026').set({
  ultimo: 1,
  apertura: {
    abiertoEn: 1,
    autorizadoPor: 'Robinson Galvis — ensayo del ciclo completo en stage (31-ago-2026)',
    fecha: hoy.toISOString(),
  },
});

// ── 2 · la reserva de unicidad, en SU colección ────────────────────────────
await db.doc(`unicidad_expedientes/${NUMERO}`).set({
  serie: 'expedientes',
  consecutivo: 1,
  expedienteId: EXP_ID,
  tenantId: 'SEC_PLANEACION',
  creadoEn: hoy.toISOString(),
  origen: 'REAL',
  loteVerificacion: LOTE,
});

// ── 3 · el expediente, parado en el paso 3 ─────────────────────────────────
const aportes = REQUISITOS_OBLIGATORIOS.map((requisitoId, i) => ({
  requisitoId, estado: 'APORTADO', documentoIds: [`ciclo-doc-${i + 1}`],
}));
await db.doc(`expedientes/${EXP_ID}`).set({
  id: EXP_ID,
  tenantId: 'SEC_PLANEACION',
  tramiteId: 'licencia-construccion-obra-nueva',
  estado: 'EN_REVISION',
  estadoJuridico: 'PRESENTADA',
  solicitanteNombre: 'Ensayo Ciclo Completo (stage)',
  solicitanteDocumento: '00.000.001',
  solicitanteContacto: { correo: 'ciudadano.ensayo@example.com', capturadoEn: hoy.toISOString() },
  contexto: {
    esApoderado: false,
    predioRodeadoEspacioPublico: false,
    categoriaComplejidad: 'BAJA',
    sujetoTituloENSR10: false,
  },
  aportes,
  radicadoId: RADICADO_ORIGEN,
  creadoEn: dias(-3),
  actualizadoEn: dias(-1),
  numeroExpediente: { numero: NUMERO, serieId: 'expedientes', año: 2026, colision: false },
  subtipos: ['CONSTRUCCION'],
  origen: 'REAL',
  esPrueba: false,
  fechaAlertaConservadora: null,
  predio: { barrioVereda: 'CENTRO', matriculaInmobiliaria: '321-00001' },
  loteVerificacion: LOTE,
  casoVerificacion: 'Ensayo del ciclo completo — parado en «Radicar en legal y debida forma»',
});

// ── 3-bis · el radicado de ventanilla del que nace el expediente ───────────
await db.doc(`ventanilla_radicados/${RADICADO_ORIGEN}`).set({
  radicadoId: RADICADO_ORIGEN,
  estadoActual: 'EN_PROCESO',
  ultimaActualizacion: dias(-3),
  prioridad: 'AMARILLO',
  cumplioTermino: null,
  esAnonimo: false,
  tipoPresentacion: 'IDENTIFICADA',
  identidadReservada: false,
  canalRespuesta: 'CORREO',
  solicitante: {
    tipoPersona: 'NATURAL',
    tipoDocumento: 'CC',
    numeroDocumento: '00.000.001',
    nombreCompleto: 'Ensayo Ciclo Completo (stage)',
    email: 'ciudadano.ensayo@example.com',
    ubicacion: { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
  },
  control: {
    radicadoId: RADICADO_ORIGEN,
    consecutivo: 1,
    fechaRadicado: dias(-3),
    horaRadicado: '08:00',
    medioRecepcion: 'PRESENCIAL',
    origen: 'PRESENCIAL',
  },
  termino: {
    tipoSolicitudId: 'LICENCIA_CONSTRUCCION',
    tipoSolicitudNombre: 'Licencia de construcción',
    /* Del CATÁLOGO REAL (lib/catalogos/tipos-solicitud.ts): 45 días HÁBILES —
       no los 15 de una petición general, que fue el primer error de esta
       siembra (el propietario lo cazó en pantalla el 1-sep). El vencimiento
       va aproximado en calendario (~63 d ≈ 45 hábiles): el reloj que manda
       para la licencia es el del EXPEDIENTE (ADR-0034), no éste. */
    diasRespuesta: 45,
    unidad: 'HABILES',
    fechaVencimiento: dias(60),
    prorrogasAplicadas: 0,
  },
  clasificacion: { oficinaDestino: 'SEC_PLANEACION', zonaGeografica: 'CASCO_URBANO' },
  detalle: {
    asunto: 'Solicitud de licencia de construcción — ensayo del ciclo completo',
    descripcion: 'Radicado de origen del ensayo autorizado (31-ago-2026). Stage: se borra entero con --limpiar.',
    numeroFolios: 13,
  },
  archivos: [],
  alertaNotificacionFallida: false,
  respuestaOficial: null,
  vinculoExpediente: null,
  loteVerificacion: LOTE,
});

// ── 4 · los 13 documentos: fechas inmutables escalonadas; la última es AYER ─
const batch = db.batch();
REQUISITOS_OBLIGATORIOS.forEach((requisitoId, i) => {
  const esUltimo = i === REQUISITOS_OBLIGATORIOS.length - 1;
  batch.set(db.doc(`expedientes/${EXP_ID}/documentos/ciclo-doc-${i + 1}`), {
    id: `ciclo-doc-${i + 1}`,
    requisitoId,
    /* El ancla del término debe salir de AQUÍ (el último requisito llegó ayer),
       no del reloj de hoy — es exactamente la puerta (g). */
    creadoEn: esUltimo ? dias(-1) : dias(-3),
    nombre: `${requisitoId}.pdf`,
    loteVerificacion: LOTE,
  });
});
await batch.commit();

// ── verificación de lectura ────────────────────────────────────────────────
const exp = (await db.doc(`expedientes/${EXP_ID}`).get()).data();
const nDocs = (await db.doc(`expedientes/${EXP_ID}`).get().then(() => db.collection(`expedientes/${EXP_ID}/documentos`).get())).size;
const contador = (await db.doc('counters/expedientes-2026').get()).data();
console.log(JSON.stringify({
  expediente: EXP_ID,
  esPrueba: exp.esPrueba,
  estadoJuridico: exp.estadoJuridico,
  numero: exp.numeroExpediente.numero,
  aportes: exp.aportes.length,
  documentos: nDocs,
  contador,
  radicadoOrigen: RADICADO_ORIGEN,
}, null, 2));
console.log('\n✔ Listo. El botón «Radicar en legal y debida forma» debe proceder — el ancla saldrá de AYER (último documento).');
