/**
 * scripts/laboratorio/sembrar-licencias-stage.mjs
 *
 * Siembra en STAGE los expedientes de Licencias necesarios para la
 * verificación E2E del módulo (bandeja → libro → búsqueda → detalle →
 * términos → vigencia → impresión → responsive).
 *
 * POR QUÉ EXISTE: hasta el 12-ago-2026 el módulo de Licencias solo se había
 * ejercitado contra PRODUCCIÓN — de ahí salieron los expedientes marcados
 * `esPrueba` que siguen en la base real. Este script traslada esa práctica a
 * stage, que es donde corresponde.
 *
 * GUARDA ANTI-PRODUCCIÓN: aborta si el service account no es de stage. Es la
 * misma protección que ya llevan los demás scripts de `scripts/laboratorio/`.
 *
 * IDENTIFICACIÓN Y REPETIBILIDAD: cada documento sembrado lleva
 * `loteVerificacion: 'E2E-LICENCIAS'` y un id con prefijo `e2e-lic-`, de modo
 * que la validación se puede repetir cuantas veces haga falta:
 *   node scripts/laboratorio/sembrar-licencias-stage.mjs --limpiar   # borra el lote
 *   node scripts/laboratorio/sembrar-licencias-stage.mjs             # lo vuelve a sembrar
 *
 * Uso:
 *   node scripts/laboratorio/sembrar-licencias-stage.mjs [--limpiar]
 */
import { readFileSync } from 'node:fs';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const PROYECTO_PROD = 'ventanilla-unica-f31b1';
const LOTE = 'E2E-LICENCIAS';
const PREFIJO = 'e2e-lic-';

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
const TENANT = 'SEC_PLANEACION';

const hoy = new Date();
const dias = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + n); return d.toISOString(); };

/** Casos representativos — uno por comportamiento que la verificación debe poder observar. */
/* ── Coherencia con la máquina de estados (ADR-0033) ──────────────────────
   Un stage que produce estados que producción YA NO PUEDE producir es un stage
   que miente. Desde que existe PRESENTADA, ningún expediente nace en debida
   forma sin documentos — así que sembrar `RADICADA_EN_DEBIDA_FORMA` con
   `aportes: []`, como se hacía aquí, fabricaba justo la contradicción que el
   ADR eliminó.

   Estos son los requisitos OBLIGATORIOS de la definición vigente. Van copiados
   porque este script es `.mjs` y no puede importar TypeScript; la copia NO se
   deja a la buena fe: `__tests__/siembra-stage-coherente.test.ts` falla si se
   desvía de la definición real. */
const REQUISITOS_OBLIGATORIOS = ['solicitud-escrita-titular', 'formulario-unico-nacional', 'certificado-tradicion-libertad', 'escritura-publica-predio', 'identidad-o-representacion-legal', 'declaracion-impuesto-predial', 'paz-y-salvo-municipal', 'certificacion-redam', 'proyecto-arquitectonico', 'disponibilidad-servicios-publicos', 'memorial-responsabilidad-profesionales', 'valla-citacion-vecinos', 'cancelacion-expensas'];

/** Aportes de un expediente COMPLETO — el estado en que se radica en debida forma. */
const APORTES_COMPLETOS = REQUISITOS_OBLIGATORIOS.map((requisitoId, i) => ({
  requisitoId, estado: 'APORTADO', documentoIds: [`doc-siembra-${i + 1}`],
}));

const CASOS = [
  {
    /* ADR-0033 — el estado previo NECESITA su caso sembrado, o la interfaz nunca
       lo ejercita: el chip ámbar, el KPI de la bandeja y el filtro del libro
       quedarían sin probar hasta que un expediente real cayera ahí. Sin
       documentos, sin actuación de radicación y SIN fecha de alerta: no tiene
       término que proyectar. */
    id: `${PREFIJO}presentada`, caso: 'Presentada en mostrador — entrega parcial, sin verificar',
    solicitanteNombre: 'Jorge Enrique Suárez Peña', solicitanteDocumento: '91.234.567',
    estadoJuridico: 'PRESENTADA', estado: 'EN_REVISION', origen: 'REAL',
    numero: null, subtipos: ['CONSTRUCCION'],
    creadoEn: dias(-2), fechaAlertaConservadora: null,
    predio: { barrioVereda: 'CENTRO', matriculaInmobiliaria: '321-40012' },
  },
  {
    id: `${PREFIJO}holgado`, caso: 'En trámite con plazo holgado (franja verde)',
    solicitanteNombre: 'María Fernanda López Ortiz', solicitanteDocumento: '1.098.765.432',
    estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION', origen: 'REAL',
    numero: '68745-0-26-9001', subtipos: ['CONSTRUCCION'],
    creadoEn: dias(-10), fechaAlertaConservadora: dias(25),
    predio: { barrioVereda: 'SANTA BARBARA', matriculaInmobiliaria: '321-51890' },
  },
  {
    id: `${PREFIJO}por-vencer`, caso: 'Por vencer (franja ámbar, ≤5 días hábiles)',
    solicitanteNombre: 'Comercializadora El Roble S.A.S. de Simacota y Anexos', solicitanteDocumento: '901.456.789-2',
    estadoJuridico: 'EN_REVISION', estado: 'EN_REVISION', origen: 'REAL',
    numero: '68745-0-26-9002', subtipos: ['CONSTRUCCION', 'APROBACION_PH', 'SUBDIVISION_URBANA'],
    creadoEn: dias(-40), fechaAlertaConservadora: dias(2),
    predio: { barrioVereda: 'CENTRO' },
  },
  {
    id: `${PREFIJO}vencido`, caso: 'VENCIDO (franja roja)',
    solicitanteNombre: 'Carlos Alberto Jaimes Peña', solicitanteDocumento: '91.234.567',
    estadoJuridico: 'CON_ACTA_DE_OBSERVACIONES', estado: 'EN_REVISION', origen: 'REAL',
    numero: '68745-0-26-9003', subtipos: ['RECONOCIMIENTO'],
    creadoEn: dias(-70), fechaAlertaConservadora: dias(-6),
  },
  {
    id: `${PREFIJO}en-firme`, caso: 'EN FIRME — debe mostrar vigencia calculada',
    solicitanteNombre: 'Inversiones del Oriente S.A.S.', solicitanteDocumento: '900.987.654-1',
    estadoJuridico: 'EN_FIRME', estado: 'ARCHIVADO', origen: 'REAL',
    numero: '68745-0-26-9004', subtipos: ['SUBDIVISION_RURAL'],
    creadoEn: dias(-200), fechaAlertaConservadora: dias(30),
    actoFinal: { numero: 'LC-26-9004', fecha: dias(-160), fechaFirmeza: dias(-150) },
    predio: { matriculaInmobiliaria: '321-58185', areaTexto: '2 HA 3368 M2' },
  },
  {
    id: `${PREFIJO}historico`, caso: 'Histórico sin resolver (gris, sin cédula, sin reloj)',
    solicitanteNombre: 'Robinson Galvis Quintero', solicitanteDocumento: '',
    estadoJuridico: 'HISTORICO_SIN_RESOLVER', estado: 'ARCHIVADO', origen: 'RECONSTRUIDO',
    numero: '68745-0-25-9005', subtipos: ['CONSTRUCCION'],
    creadoEn: dias(-500), fechaAlertaConservadora: null,
    actoFinal: { cierreDesconocido: true },
    estadoOriginalHistorico: 'terminado',
    revisionHistorica: { pendiente: true, pendientesAlImportar: ['IDENTIDAD', 'ESTADO_JURIDICO', 'ACTO_FINAL'] },
  },
  {
    id: `${PREFIJO}historico-cuarentena`, caso: 'Histórico con subtipo SIN RESOLVER + sin estado en el libro',
    solicitanteNombre: 'Conjunto Residencial Altos del Valle Etapa II', solicitanteDocumento: '',
    estadoJuridico: 'HISTORICO_SIN_RESOLVER', estado: 'ARCHIVADO', origen: 'RECONSTRUIDO',
    numero: '68745-0-25-9006', subtipos: ['LCR VISR'],
    creadoEn: dias(-480), fechaAlertaConservadora: null,
    actoFinal: { cierreDesconocido: true },
    estadoOriginalHistorico: null,
    revisionHistorica: { pendiente: true, pendientesAlImportar: ['IDENTIDAD', 'ESTADO_JURIDICO', 'ACTO_FINAL', 'SUBTIPO'] },
  },
  {
    id: `${PREFIJO}colision`, caso: 'Radicado en COLISIÓN (número repetido) — primera de las dos filas',
    solicitanteNombre: 'Ana Lucía Avilés Pérez', solicitanteDocumento: '',
    estadoJuridico: 'HISTORICO_SIN_RESOLVER', estado: 'ARCHIVADO', origen: 'RECONSTRUIDO',
    numero: '68745-0-25-9007', subtipos: ['CONSTRUCCION'], colision: true,
    creadoEn: dias(-470), fechaAlertaConservadora: null,
    actoFinal: { cierreDesconocido: true },
    estadoOriginalHistorico: 'REVISADO',
    revisionHistorica: { pendiente: true, pendientesAlImportar: ['IDENTIDAD', 'ESTADO_JURIDICO', 'ACTO_FINAL'] },
  },
  {
    // Gemela de la anterior: MISMO número legal, otro solicitante. Reproduce
    // el caso real `68745-0-25-0037` que ya vive en producción — es lo que
    // permite verificar que el libro dice CON QUIÉN colisiona.
    id: `${PREFIJO}colision-gemela`, caso: 'Radicado en COLISIÓN — segunda fila con el MISMO número',
    solicitanteNombre: 'Pedro Nel Rojas Peña', solicitanteDocumento: '',
    estadoJuridico: 'HISTORICO_SIN_RESOLVER', estado: 'ARCHIVADO', origen: 'RECONSTRUIDO',
    numero: '68745-0-25-9007', subtipos: ['RECONOCIMIENTO'], colision: true,
    creadoEn: dias(-457), fechaAlertaConservadora: null,
    actoFinal: { cierreDesconocido: true },
    estadoOriginalHistorico: 'REVISADO',
    revisionHistorica: { pendiente: true, pendientesAlImportar: ['IDENTIDAD', 'ESTADO_JURIDICO', 'ACTO_FINAL'] },
  },
  {
    id: `${PREFIJO}sin-reloj`, caso: 'REAL sin espejo de término (columna "Vence" en "—")',
    solicitanteNombre: 'Luis Eduardo Pérez Gómez', solicitanteDocumento: '91.111.222',
    estadoJuridico: 'RADICADA_EN_DEBIDA_FORMA', estado: 'EN_REVISION', origen: 'REAL',
    numero: '68745-0-26-9008', subtipos: ['URBANIZACION'],
    creadoEn: dias(-5),
  },
];

function docDe(c) {
  const base = {
    id: c.id,
    tenantId: TENANT,
    tramiteId: 'licencia-construccion-obra-nueva',
    estado: c.estado,
    estadoJuridico: c.estadoJuridico,
    solicitanteNombre: c.solicitanteNombre,
    solicitanteDocumento: c.solicitanteDocumento,
    contexto: {},
    /* Coherencia: un expediente en estado previo NO tiene documentos; uno que
       ya avanzó, SÍ los tiene todos — llegó ahí por estar completo. */
    aportes: c.estadoJuridico === 'PRESENTADA' ? [] : APORTES_COMPLETOS,
    radicadoId: null,
    creadoEn: c.creadoEn,
    actualizadoEn: c.creadoEn,
    numeroExpediente: { numero: c.numero, serieId: 'e2e-stage', año: Number(c.numero.split('-')[2]) + 2000, colision: c.colision === true },
    subtipos: c.subtipos,
    origen: c.origen,
    esPrueba: true,
    // Marca de lote: permite repetir la validación (sembrar/limpiar) sin tocar
    // ningún otro dato de stage.
    loteVerificacion: LOTE,
    casoVerificacion: c.caso,
  };
  if (c.fechaAlertaConservadora !== undefined) base.fechaAlertaConservadora = c.fechaAlertaConservadora;
  if (c.actoFinal) base.actoFinal = c.actoFinal;
  if (c.predio) base.predio = c.predio;
  if (c.estadoOriginalHistorico !== undefined) base.estadoOriginalHistorico = c.estadoOriginalHistorico;
  if (c.revisionHistorica) base.revisionHistorica = c.revisionHistorica;
  return base;
}

const limpiar = process.argv.includes('--limpiar');



const existentes = await db.collection('expedientes').where('loteVerificacion', '==', LOTE).get();
if (!existentes.empty) {
  const batch = db.batch();
  existentes.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`Lote previo eliminado: ${existentes.size} expediente(s).`);
}

if (limpiar) {
  console.log('Limpieza completada (no se sembró nada).');
  process.exit(0);
}

const batch = db.batch();
for (const c of CASOS) {
  const doc = docDe(c);
  batch.set(db.doc(`expedientes/${doc.id}`), doc);
  /* La actuación de radicación SOLO para los que ya radicaron. Un expediente en
     PRESENTADA que la tuviera arrancaría el término — exactamente lo que el
     estado previo existe para impedir. */
  if (c.estadoJuridico !== 'PRESENTADA') batch.set(db.doc(`expedientes/${doc.id}/actuaciones/${doc.id}-radicacion`), {
    id: `${doc.id}-radicacion`,
    expedienteId: doc.id,
    tenantId: TENANT,
    tipo: 'radicacion-debida-forma',
    etapa: 'radicacion',
    actorUid: 'sembrador-e2e',
    actorNombre: 'Siembra de verificación (stage)',
    actorRol: 'SISTEMA',
    fecha: doc.creadoEn,
    origen: doc.origen,
    detalle: `Caso de verificación E2E: ${c.caso}`,
    loteVerificacion: LOTE,
  });
}
await batch.commit();

console.log(JSON.stringify({
  proyecto: sa.project_id,
  lote: LOTE,
  sembrados: CASOS.length,
  casos: CASOS.map((c) => ({ numero: c.numero, caso: c.caso })),
}, null, 1));
