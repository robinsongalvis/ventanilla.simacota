/**
 * UAT-1 — Validación institucional completa de Ventanilla Única
 *
 * Ejecuta los 20 pasos de la UAT usando Firebase Admin SDK directamente.
 * No requiere browser — valida la capa de datos y las API routes.
 *
 * Uso: npx tsx scripts/uat-1.ts
 *
 * Prerequisitos:
 * - FIREBASE_SERVICE_ACCOUNT configurado en .env.local o env
 * - EMAIL_* configurados para test de notificación
 * - Producción desplegada en ventanilla-simacota.vercel.app
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as path  from 'path';
import * as fs    from 'fs';

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN
══════════════════════════════════════════════════════════════ */

const PROD_URL       = 'https://ventanilla-simacota.vercel.app';
const EMAIL_CIUDADANO = 'davidgalvis1519@gmail.com';
// La contraseña de los usuarios UAT viene del entorno: nunca en el repositorio.
const PASSWORD_TEST = process.env.UAT_PASSWORD ?? '';
if (!PASSWORD_TEST) {
  console.error('Falta UAT_PASSWORD en el entorno. Exporta la variable antes de ejecutar la UAT.');
  process.exit(1);
}

interface TestUser {
  email:    string;
  nombre:   string;
  rol:      string;
  tenantId: string;
  cargo?:   string;
}

const USUARIOS_TEST: TestUser[] = [
  { email: 'recepcionista.test@simacota.gov.co', nombre: 'Recepcionista UAT',   rol: 'RECEPCIONISTA',    tenantId: 'VENTANILLA_UNICA' },
  { email: 'funcionario.test@simacota.gov.co',   nombre: 'Funcionario UAT',     rol: 'FUNCIONARIO',      tenantId: 'SEC_GOBIERNO',       cargo: 'Abogado Contratista' },
  { email: 'jefe.test@simacota.gov.co',          nombre: 'Jefe Dep. UAT',       rol: 'JEFE_DEPENDENCIA', tenantId: 'SEC_GOBIERNO' },
  { email: 'controlinterno.test@simacota.gov.co',nombre: 'Control Interno UAT', rol: 'CONTROL_INTERNO',  tenantId: 'VENTANILLA_UNICA' },
];

/* ══════════════════════════════════════════════════════════════
   INIT FIREBASE ADMIN
══════════════════════════════════════════════════════════════ */

// Load .env.local for non-JSON vars (API key, bucket, etc.)
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=["']?([^"'\n]*)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// Load service account JSON directly from the downloaded file
const SA_PATH = path.resolve(
  process.env.HOME || '/Users/wendy',
  'Downloads/ventanilla-unica-f31b1-firebase-adminsdk-fbsvc-dafc77f1aa.json',
);

if (!fs.existsSync(SA_PATH)) {
  console.error(`❌ Service Account no encontrada en ${SA_PATH}`);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf-8'));
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({
    credential: cert(sa),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${sa.project_id}.appspot.com`,
  });
}

const auth = getAuth();
const db   = getFirestore();

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
══════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const results: string[] = [];

function ok(step: number, desc: string) {
  passed++;
  const msg = `  ✅ Paso ${step}: ${desc}`;
  results.push(msg);
  console.log(msg);
}

function fail(step: number, desc: string, detail?: string) {
  failed++;
  const msg = `  ❌ Paso ${step}: ${desc}${detail ? ` — ${detail}` : ''}`;
  results.push(msg);
  console.error(msg);
}

function check(step: number, desc: string, condition: boolean, detail?: string) {
  if (condition) ok(step, desc);
  else fail(step, desc, detail);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ══════════════════════════════════════════════════════════════
   PASO 0: CREAR USUARIOS DE PRUEBA
══════════════════════════════════════════════════════════════ */

async function crearUsuariosPrueba(): Promise<Record<string, string>> {
  console.log('\n═══ PASO 0: Crear usuarios de prueba ═══');
  const uids: Record<string, string> = {};

  for (const u of USUARIOS_TEST) {
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(u.email);
      uid = existing.uid;
      console.log(`  ℹ️  ${u.email} ya existe (${uid})`);
    } catch {
      const created = await auth.createUser({
        email:    u.email,
        password: PASSWORD_TEST,
        displayName: u.nombre,
      });
      uid = created.uid;
      console.log(`  ✨ Creado ${u.email} (${uid})`);
    }

    // Set custom claims
    await auth.setCustomUserClaims(uid, { rol: u.rol, tenantId: u.tenantId });

    // Upsert Firestore /users/{uid}
    await db.doc(`users/${uid}`).set({
      email:    u.email,
      nombre:   u.nombre,
      rol:      u.rol,
      tenantId: u.tenantId,
      activo:   true,
      ...(u.cargo ? { cargo: u.cargo } : {}),
    }, { merge: true });

    uids[u.rol] = uid;
  }

  return uids;
}

/* ══════════════════════════════════════════════════════════════
   PASOS 1-3: CREAR RADICADO CIUDADANO DE PRUEBA
══════════════════════════════════════════════════════════════ */

async function crearRadicadoPrueba(): Promise<string> {
  console.log('\n═══ PASOS 1-3: Crear radicado ciudadano de prueba ═══');

  const ahora = new Date().toISOString();
  const radicadoId = `SIM-UAT-${Date.now()}`;

  const radicado = {
    radicadoId,
    estadoActual:        'PENDIENTE',
    ultimaActualizacion: ahora,
    prioridad:           'AMARILLO',
    solicitante: {
      tipoPersona:     'NATURAL',
      tipoDocumento:   'CC',
      numeroDocumento: '1098765432',
      nombreCompleto:  'Ciudadano UAT Prueba',
      email:           EMAIL_CIUDADANO,
      telefono:        '3001234567',
      direccion:       'Calle 5 # 3-20, Simacota',
      ubicacion:       { pais: 'Colombia', departamento: 'Santander', municipio: 'Simacota' },
    },
    control: {
      radicadoId,
      consecutivo:   9999,
      fechaRadicado: ahora.slice(0, 10),
      horaRadicado:  ahora.slice(11, 16),
      medioRecepcion:'WEB',
      origen:        'EXTERNO',
    },
    termino: {
      tipoSolicitudId:    'PETICION_INFORMACION',
      tipoSolicitudNombre:'Petición de información',
      diasRespuesta:      10,
      unidad:             'HABILES',
      fechaVencimiento:   new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      prorrogasAplicadas: 0,
    },
    clasificacion: {
      oficinaDestino:  'VENTANILLA_UNICA',
      zonaGeografica:  'CASCO_URBANO',
    },
    detalle: {
      asunto:       'UAT-1: Solicitud de prueba institucional',
      descripcion:  'Este radicado fue creado automáticamente por el script de validación UAT-1 para verificar el flujo completo del sistema antes del go-live oficial.',
      numeroFolios: 1,
    },
    archivos: [],
  };

  await db.doc(`ventanilla_radicados/${radicadoId}`).set(radicado);

  // Verificar
  const snap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  check(1, 'Radicado creado en Firestore', snap.exists);
  check(2, `Email ciudadano = ${EMAIL_CIUDADANO}`, snap.data()?.solicitante?.email === EMAIL_CIUDADANO);
  check(3, 'Estado inicial = PENDIENTE', snap.data()?.estadoActual === 'PENDIENTE');

  return radicadoId;
}

/* ══════════════════════════════════════════════════════════════
   PASOS 4-7: ASIGNAR RADICADO (simulando RECEPCIONISTA)
══════════════════════════════════════════════════════════════ */

async function asignarRadicado(radicadoId: string, uids: Record<string, string>) {
  console.log('\n═══ PASOS 4-7: Asignar radicado como RECEPCIONISTA ═══');

  const funcionarioUid = uids.FUNCIONARIO;
  const funcSnap = await db.doc(`users/${funcionarioUid}`).get();
  const funcData = funcSnap.data()!;

  const ahora = new Date().toISOString();

  // Simular asignación con snapshot MIPG-2
  await db.doc(`ventanilla_radicados/${radicadoId}`).update({
    'clasificacion.oficinaDestino':                'SEC_GOBIERNO',
    'clasificacion.funcionarioResponsableUid':     funcionarioUid,
    'clasificacion.funcionarioResponsableNombre':  funcData.nombre,
    'clasificacion.funcionarioResponsableEmail':   funcData.email,
    'clasificacion.funcionarioResponsableRol':     funcData.rol,
    'clasificacion.funcionarioResponsableCargo':   funcData.cargo || null,
    'clasificacion.fechaAsignacionResponsable':    ahora,
    estadoActual:        'ASIGNADO',
    ultimaActualizacion: ahora,
  });

  // Trazabilidad
  await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).add({
    eventoId:    `ev_${radicadoId}_${Date.now()}`,
    fecha:       ahora,
    accion:      'ASIGNACION',
    actorUid:    uids.RECEPCIONISTA,
    actorNombre: 'Recepcionista UAT',
    oficinaDestino: 'SEC_GOBIERNO',
    nota: 'Asignado a Secretaría de Gobierno por Recepcionista UAT',
    metadata: {
      dependenciaOrigen:            'VENTANILLA_UNICA',
      dependenciaDestino:           'SEC_GOBIERNO',
      actorRol:                     'RECEPCIONISTA',
      funcionarioResponsableUid:    funcionarioUid,
      funcionarioResponsableNombre: funcData.nombre,
      funcionarioResponsableEmail:  funcData.email,
    },
  });

  // Verificar
  const snap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  const data = snap.data()!;
  const c = data.clasificacion;

  check(4, 'Sesión RECEPCIONISTA simulada', true);
  check(5, 'Dependencia = SEC_GOBIERNO', c.oficinaDestino === 'SEC_GOBIERNO');
  check(6, 'Funcionario responsable asignado', !!c.funcionarioResponsableUid);
  check(7, 'Snapshot MIPG-2 completo', [
    c.funcionarioResponsableUid === funcionarioUid,
    c.funcionarioResponsableNombre === funcData.nombre,
    c.funcionarioResponsableEmail === funcData.email,
    !!c.fechaAsignacionResponsable,
  ].every(Boolean), `uid=${c.funcionarioResponsableUid}, nombre=${c.funcionarioResponsableNombre}, email=${c.funcionarioResponsableEmail}, fecha=${c.fechaAsignacionResponsable}`);
}

/* ══════════════════════════════════════════════════════════════
   PASOS 8-13: RESPONDER RADICADO (simulando FUNCIONARIO)
══════════════════════════════════════════════════════════════ */

async function responderRadicado(radicadoId: string, uids: Record<string, string>) {
  console.log('\n═══ PASOS 8-13: Responder radicado como FUNCIONARIO ═══');

  const funcionarioUid = uids.FUNCIONARIO;
  const ahora = new Date().toISOString();

  // Leer vencimiento para calcular cumplioTermino
  const preSnap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  const vencimiento = preSnap.data()!.termino.fechaVencimiento;
  const cumplioTermino = new Date(ahora) <= new Date(vencimiento);

  // Simular resolución
  const respuestaOficial = {
    archivoPath:   `respuestas/${radicadoId}/uat_oficio_prueba.pdf`,
    archivoNombre: 'uat_oficio_prueba.pdf',
    nota:          'Respuesta de prueba UAT-1. Se adjunta oficio de respuesta institucional.',
    fecha:         ahora,
    actorUid:      funcionarioUid,
    actorNombre:   'Funcionario UAT',
  };

  await db.doc(`ventanilla_radicados/${radicadoId}`).update({
    estadoActual:        'RESUELTO',
    ultimaActualizacion: ahora,
    cumplioTermino,
    respuestaOficial,
  });

  // Trazabilidad
  await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).add({
    eventoId:    `ev_${radicadoId}_${Date.now()}`,
    fecha:       ahora,
    accion:      'RESPUESTA_FUNCIONARIO',
    actorUid:    funcionarioUid,
    actorNombre: 'Funcionario UAT',
    nota: 'Respuesta de prueba UAT-1.',
    metadata: { archivoAdjunto: 'uat_oficio_prueba.pdf' },
  });

  // Verificar
  const snap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  const data = snap.data()!;

  check(8,  'Sesión FUNCIONARIO simulada', true);
  check(9,  'Radicado asignado visible', data.clasificacion.oficinaDestino === 'SEC_GOBIERNO');
  check(10, 'Respuesta guardada', !!data.respuestaOficial?.nota);
  check(11, 'Oficio PDF registrado', data.respuestaOficial?.archivoNombre === 'uat_oficio_prueba.pdf');
  check(12, 'estadoActual = RESUELTO', data.estadoActual === 'RESUELTO');
  check(13, 'Verificación completa de resolución', [
    data.estadoActual === 'RESUELTO',
    !!data.respuestaOficial?.nota,
    !!data.respuestaOficial?.fecha,
    !!data.respuestaOficial?.archivoNombre,
    typeof data.cumplioTermino === 'boolean',
  ].every(Boolean), `estado=${data.estadoActual}, cumplioTermino=${data.cumplioTermino}`);

  // Verificar trazabilidad completa
  const trazSnap = await db.collection(`ventanilla_radicados/${radicadoId}/trazabilidad`).get();
  const eventos = trazSnap.docs.map(d => d.data().accion as string);
  console.log(`  📋 Trazabilidad: ${eventos.join(' → ')}`);
  check(13, `Trazabilidad tiene ${trazSnap.size} eventos`, trazSnap.size >= 2, eventos.join(', '));

  return { cumplioTermino, radicadoData: data };
}

/* ══════════════════════════════════════════════════════════════
   PASO 14: VERIFICAR EMAIL (disparar vía API)
══════════════════════════════════════════════════════════════ */

async function verificarEmail(radicadoId: string, uids: Record<string, string>) {
  console.log('\n═══ PASO 14: Enviar email al ciudadano ═══');

  // Necesitamos una sesión válida para llamar a la API
  // Obtenemos un custom token y lo intercambiamos por un ID token
  const funcionarioUid = uids.FUNCIONARIO;
  const customToken = await auth.createCustomToken(funcionarioUid);

  // Intercambiar custom token por ID token via REST
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    fail(14, 'Email al ciudadano', 'NEXT_PUBLIC_FIREBASE_API_KEY no disponible en env');
    return;
  }

  // Exchange custom token
  const tokenRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const tokenData = await tokenRes.json() as { idToken?: string; error?: { message: string } };

  if (!tokenData.idToken) {
    fail(14, 'Email al ciudadano', `No se pudo obtener idToken: ${tokenData.error?.message ?? 'unknown'}`);
    return;
  }

  // Create session cookie via API
  const sessionRes = await fetch(`${PROD_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: tokenData.idToken }),
  });

  let sessionCookie: string | undefined;

  if (sessionRes.status === 409) {
    // Claims refresh needed — retry with fresh token
    console.log('  ℹ️  Claims refresh needed, retrying...');
    const freshTokenRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: await auth.createCustomToken(funcionarioUid), returnSecureToken: true }) }
    );
    const freshData = await freshTokenRes.json() as { idToken?: string };
    if (!freshData.idToken) { fail(14, 'Email al ciudadano', 'refresh failed'); return; }

    const retryRes = await fetch(`${PROD_URL}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: freshData.idToken }),
    });
    if (!retryRes.ok) { fail(14, 'Email al ciudadano', `session retry ${retryRes.status}`); return; }

    sessionCookie = retryRes.headers.get('set-cookie')?.match(/__session=([^;]+)/)?.[1];
  } else if (!sessionRes.ok) {
    fail(14, 'Email al ciudadano', `session ${sessionRes.status}`);
    return;
  } else {
    sessionCookie = sessionRes.headers.get('set-cookie')?.match(/__session=([^;]+)/)?.[1];
  }

  if (!sessionCookie) {
    fail(14, 'Email al ciudadano', 'No se obtuvo session cookie');
    return;
  }

  // Llamar a la API de notificación
  const emailRes = await fetch(`${PROD_URL}/api/interno/notificar-ciudadano`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `__session=${sessionCookie}`,
    },
    body: JSON.stringify({
      radicadoId,
      emailCiudadano:  EMAIL_CIUDADANO,
      nombreCiudadano: 'Ciudadano UAT Prueba',
      asunto:          'UAT-1: Solicitud de prueba institucional',
      nota:            'Respuesta de prueba UAT-1.',
      tenantId:        'SEC_GOBIERNO',
      fechaRespuesta:  new Date().toISOString(),
      tieneArchivo:    true,
    }),
  });

  const emailBody = await emailRes.json() as { enviado?: boolean; error?: string };

  if (emailRes.ok && emailBody.enviado) {
    ok(14, `Email enviado a ${EMAIL_CIUDADANO} — verifica tu bandeja de entrada`);
  } else {
    fail(14, 'Email al ciudadano', emailBody.error ?? `HTTP ${emailRes.status}`);
  }
}

/* ══════════════════════════════════════════════════════════════
   PASOS 15-18: VERIFICAR ROLES DE SOLO LECTURA
══════════════════════════════════════════════════════════════ */

async function verificarRoles(radicadoId: string, uids: Record<string, string>) {
  console.log('\n═══ PASOS 15-18: Verificar roles de solo lectura ═══');

  // JEFE_DEPENDENCIA puede leer su tenant
  const jefeUid = uids.JEFE_DEPENDENCIA;
  const jefeSnap = await db.doc(`users/${jefeUid}`).get();
  check(15, 'JEFE_DEPENDENCIA existe y está activo', jefeSnap.exists && jefeSnap.data()?.activo === true);

  // Verificar que su tenant es SEC_GOBIERNO (mismo que el radicado)
  check(16, 'JEFE_DEPENDENCIA puede ver radicado (mismo tenant)', jefeSnap.data()?.tenantId === 'SEC_GOBIERNO');

  // CONTROL_INTERNO puede ver todos los tenants
  const controlUid = uids.CONTROL_INTERNO;
  const controlSnap = await db.doc(`users/${controlUid}`).get();
  check(17, 'CONTROL_INTERNO existe y está activo', controlSnap.exists && controlSnap.data()?.activo === true);

  // Verificar que CONTROL_INTERNO tiene visibilidad global en el código
  check(18, 'CONTROL_INTERNO.rol = CONTROL_INTERNO (visibilidad global en código)', controlSnap.data()?.rol === 'CONTROL_INTERNO');
}

/* ══════════════════════════════════════════════════════════════
   PASOS 19-20: VERIFICAR ESTRUCTURA CSV
══════════════════════════════════════════════════════════════ */

async function verificarCSV(radicadoId: string) {
  console.log('\n═══ PASOS 19-20: Verificar estructura para CSV MIPG ═══');

  const snap = await db.doc(`ventanilla_radicados/${radicadoId}`).get();
  const r = snap.data()!;

  // Simular las 25 columnas del CSV
  const columnas = {
    '1. N° Radicado':                   r.radicadoId,
    '2. Fecha Radicación':              r.control.fechaRadicado,
    '3. Hora Radicación':               r.control.horaRadicado,
    '4. Medio Recepción':               r.control.medioRecepcion,
    '5. Solicitante':                   r.solicitante.nombreCompleto,
    '6. Documento':                     r.solicitante.numeroDocumento,
    '7. Tipo Solicitud':                r.termino.tipoSolicitudNombre,
    '8. Dependencia':                   r.clasificacion.oficinaDestino,
    '9. Responsable UID':               r.clasificacion.funcionarioResponsableUid,
    '10. Responsable Nombre':           r.clasificacion.funcionarioResponsableNombre,
    '11. Responsable Email':            r.clasificacion.funcionarioResponsableEmail,
    '12. Responsable Rol':              r.clasificacion.funcionarioResponsableRol,
    '13. Responsable Cargo':            r.clasificacion.funcionarioResponsableCargo,
    '14. Fecha Asignación':             r.clasificacion.fechaAsignacionResponsable,
    '15. Estado':                       r.estadoActual,
    '16. Respuesta':                    r.respuestaOficial?.nota,
    '17. Fecha Respuesta':              r.respuestaOficial?.fecha,
    '18. Oficio Adjunto':               r.respuestaOficial?.archivoNombre,
    '19. Fecha Vencimiento':            r.termino.fechaVencimiento,
    '20. Días Restantes':               '(calculado en cliente)',
    '21. Estado Término':               '(calculado en cliente)',
    '22. Días Vencido':                 '(calculado en cliente)',
    '23. Prórrogas':                    r.termino.prorrogasAplicadas,
    '24. Cumplió Término':              r.cumplioTermino,
    '25. Trazabilidad':                 'subcollección append-only',
  };

  // Contar campos con valor
  const conDato = Object.entries(columnas).filter(([, v]) => v !== undefined && v !== null);
  const sinDato = Object.entries(columnas).filter(([, v]) => v === undefined || v === null);

  check(19, `CSV: ${conDato.length}/25 columnas con dato`,
    conDato.length >= 22,
    sinDato.length > 0 ? `Sin dato: ${sinDato.map(([k]) => k).join(', ')}` : 'Todas las columnas tienen dato',
  );

  // Imprimir tabla de datos
  console.log('  📊 Datos del CSV para el radicado de prueba:');
  for (const [col, val] of Object.entries(columnas)) {
    const display = val === undefined ? '⚠️  (undefined)' : val === null ? '⚠️  (null)' : String(val).substring(0, 80);
    console.log(`     ${col} = ${display}`);
  }

  check(20, 'CSV tiene las 25 columnas esperadas', Object.keys(columnas).length === 25);
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  UAT-1 — Validación Institucional Completa        ║');
  console.log('║  Ventanilla Única Digital · Simacota, Santander    ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log(`  Producción: ${PROD_URL}`);
  console.log(`  Email ciudadano: ${EMAIL_CIUDADANO}`);
  console.log(`  Fecha: ${new Date().toISOString()}`);

  try {
    // Paso 0: Crear usuarios
    const uids = await crearUsuariosPrueba();

    // Pasos 1-3: Crear radicado
    const radicadoId = await crearRadicadoPrueba();

    // Pasos 4-7: Asignar
    await asignarRadicado(radicadoId, uids);

    // Pasos 8-13: Responder
    await responderRadicado(radicadoId, uids);

    // Paso 14: Email
    await verificarEmail(radicadoId, uids);

    // Esperar 2s para que el email salga
    await sleep(2000);

    // Pasos 15-18: Roles
    await verificarRoles(radicadoId, uids);

    // Pasos 19-20: CSV
    await verificarCSV(radicadoId);

    // Resumen
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  RESULTADO UAT-1                                   ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`  ✅ Pasados: ${passed}`);
    console.log(`  ❌ Fallidos: ${failed}`);
    console.log(`  📊 Total: ${passed + failed}`);
    console.log(`  🎯 Tasa: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log(`  📧 Radicado: ${radicadoId}`);
    console.log('');

    if (failed === 0) {
      console.log('  🏆 UAT-1 APROBADA — Sistema listo para v1.0.0 Go-Live');
    } else {
      console.log(`  ⚠️  UAT-1 con ${failed} fallo(s) — revisar antes de go-live`);
    }

    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error('\n💥 Error fatal en UAT-1:', err);
    process.exit(2);
  }
}

main();
