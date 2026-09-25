/**
 * Ejecutor TONTO del importador de históricos (consecutivo de licencias) —
 * Bloque "Importador de históricos", ago-2026.
 *
 * "TONTO" a propósito: este script NO decide nada — no resuelve
 * equivalencias, no clasifica cuarentenas, no calcula fechas. Toda esa
 * lógica vive en TypeScript, PURA, en
 * `lib/migracion/planificar-importacion-consecutivo.ts` (`planificarImportacion`),
 * y se ejecuta ANTES, fuera de este script (test/step "puente", ver
 * `__tests__/migracion-reconciliacion-snapshot-real.test.ts`), que serializa
 * el resultado a un `PlanImportacion` en JSON. Este script solo LEE esa
 * decisión ya tomada y, si se le autoriza explícitamente, la ESCRIBE.
 * Resuelve así el problema "un script `.mjs` plano no puede importar
 * módulos TypeScript del proyecto" sin duplicar ninguna regla de negocio
 * aquí — ni siquiera el conteo por motivo de cuarentena copia lógica de
 * `generarReporteDryRun`: es una tabulación trivial sobre datos YA
 * clasificados, no una decisión nueva.
 *
 * Uso:
 *   node scripts/migracion/importar-consecutivo-licencias.mjs --plan <archivo.json>              # dry-run (default) — SOLO imprime, NUNCA escribe
 *   CONFIRMO_ESCRITURA=si FIREBASE_SERVICE_ACCOUNT='<json>' \
 *     node scripts/migracion/importar-consecutivo-licencias.mjs --plan <archivo.json> --ejecutar  # ESCRIBE
 *
 * Candado de ejecución (dos capas, ninguna opcional):
 *  1. La bandera `--ejecutar` por sí sola NO basta: además exige la
 *     variable de entorno `CONFIRMO_ESCRITURA=si` EXACTA — un typo o un
 *     "true"/"1" no cuentan, evita activaciones accidentales por copiar-
 *     pegar un comando de otro contexto.
 *  2. Sin `--ejecutar`, el script SIEMPRE corre en dry-run, sin excepción
 *     ni atajo — no existe ninguna combinación de flags que escriba sin
 *     pasar por la bandera Y la variable de entorno a la vez.
 *
 * Alcance de escritura — JAMÁS toca `counters/` ni `unicidad_expedientes/`
 * (assert defensivo en tiempo de ejecución, no solo un comentario: ver
 * `assertPathSeguro`). Los expedientes RECONSTRUIDOS de este importador NO
 * consumen la serie legal REAL (DF-9, ADR-0029) — el `numeroExpediente` ya
 * viene resuelto como ATRIBUTO en el plan (el número histórico del libro),
 * nunca se reserva ni se emite aquí.
 */

import { readFileSync } from 'node:fs';

const RUTAS_PROHIBIDAS = [/^counters\//, /^unicidad_expedientes\//];

/** Guarda defensiva: lanza si algún path de escritura toca una colección fuera del alcance de este importador (DF-9). */
function assertPathSeguro(path) {
  if (RUTAS_PROHIBIDAS.some((re) => re.test(path))) {
    throw new Error(`[importador-historicos] BLOQUEADO: intento de escribir en "${path}" — este importador JAMÁS toca counters/ ni unicidad_expedientes/ (DF-9).`);
  }
}

function leerPlan(rutaPlan) {
  const crudo = readFileSync(rutaPlan, 'utf8');
  const plan = JSON.parse(crudo);
  if (!Array.isArray(plan.expedientes) || !Array.isArray(plan.cuarentena) || !plan.reconciliacion) {
    throw new Error(`[importador-historicos] "${rutaPlan}" no tiene la forma de un PlanImportacion (faltan "expedientes"/"cuarentena"/"reconciliacion").`);
  }
  return plan;
}

/** Tabulación TRIVIAL sobre datos ya clasificados — NO es una decisión nueva, solo cuenta lo que el plan ya trae. */
function tabularPorMotivo(cuarentena) {
  const conteos = new Map();
  for (const c of cuarentena) {
    for (const m of c.motivos ?? []) conteos.set(m, (conteos.get(m) ?? 0) + 1);
  }
  return conteos;
}

function imprimirResumen(plan) {
  const { reconciliacion } = plan;
  console.log('══════════ Importador de históricos — consecutivo de licencias ══════════');
  console.log(`Total en el snapshot:      ${reconciliacion.totalSnapshot}`);
  console.log(`Planificados (importables): ${reconciliacion.planificados}`);
  console.log(`En cuarentena:              ${reconciliacion.enCuarentena}`);
  console.log(`Colisiones de radicado:     ${reconciliacion.colisiones}`);
  console.log('');
  console.log('── Cuarentena por motivo ──');
  for (const [motivo, n] of tabularPorMotivo(plan.cuarentena)) {
    console.log(`  ${motivo}: ${n}`);
  }
  if (Array.isArray(plan.advertencias) && plan.advertencias.length > 0) {
    console.log('');
    console.log('── Advertencias ──');
    for (const a of plan.advertencias) console.log(`  ⚠ ${a}`);
  }
  console.log('');
}

async function conectarFirestore() {
  const { getFirestore } = await import('firebase-admin/firestore');
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('[importador-historicos] FIREBASE_SERVICE_ACCOUNT no configurado.');
    process.exit(2);
  }
  const sa = JSON.parse(raw);
  sa.private_key = sa.private_key?.replace(/\\n/g, '\n');

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
  }
  return { db: getFirestore(), proyecto: sa.project_id };
}

/**
 * Construye la actuación 'radicacion-debida-forma' RECONSTRUIDA para un
 * expediente ya planificado — construcción TRIVIAL de campos (copia datos
 * que el plan ya trae más un id nuevo), no una decisión de negocio: por eso
 * puede vivir en el ejecutor "tonto" sin romper la separación de capas.
 */
function construirActuacionRadicacion(expediente, generadoEnIso) {
  return {
    id: `${expediente.id}-radicacion`,
    expedienteId: expediente.id,
    tenantId: expediente.tenantId,
    tipo: 'radicacion-debida-forma',
    etapa: 'radicacion',
    actorUid: 'sistema-migracion-historicos',
    actorNombre: 'Importador de históricos (migración)',
    actorRol: 'SISTEMA',
    fecha: expediente.creadoEn,
    origen: 'RECONSTRUIDO',
    detalle: `Expediente reconstruido desde el libro de consecutivo histórico de Planeación `
      + `(hoja ${expediente.provenance?.hoja ?? '?'}, fila ${expediente.provenance?.fila ?? '?'}) — importado ${generadoEnIso}.`,
  };
}

async function ejecutarEscritura(plan) {
  if (process.env.CONFIRMO_ESCRITURA !== 'si') {
    console.error('══════════════════════════════════════════════════════════════');
    console.error('REQUIERE AUTORIZACIÓN EXPRESA DEL PROPIETARIO (protocolo)');
    console.error('══════════════════════════════════════════════════════════════');
    console.error('--ejecutar exige la variable de entorno CONFIRMO_ESCRITURA=si (exacta). Abortado, NO se escribió nada.');
    process.exit(3);
  }

  console.error('══════════════════════════════════════════════════════════════');
  console.error('REQUIERE AUTORIZACIÓN EXPRESA DEL PROPIETARIO (protocolo) — CONFIRMO_ESCRITURA=si presente, procediendo a ESCRIBIR.');
  console.error('══════════════════════════════════════════════════════════════');

  const { db, proyecto } = await conectarFirestore();
  console.error(`[importador-historicos] proyecto=${proyecto} · ${plan.expedientes.length} expediente(s) a escribir.`);

  const generadoEnIso = new Date().toISOString();
  const operaciones = [];
  for (const expediente of plan.expedientes) {
    const pathExpediente = `expedientes/${expediente.id}`;
    assertPathSeguro(pathExpediente);
    operaciones.push({ path: pathExpediente, data: expediente });

    const actuacion = construirActuacionRadicacion(expediente, generadoEnIso);
    const pathActuacion = `expedientes/${expediente.id}/actuaciones/${actuacion.id}`;
    assertPathSeguro(pathActuacion);
    operaciones.push({ path: pathActuacion, data: actuacion });
  }

  // Firestore permite hasta 500 operaciones por batch — se trocea con margen.
  //
  // `batch.create(...)`, NUNCA `batch.set(...)` (revisión cruzada del
  // coordinador): una migración es un evento IRREPETIBLE — si el documento
  // ya existiera (p. ej. una re-ejecución accidental del importador, o dos
  // corridas superpuestas), `create` hace que la operación FALLE
  // ruidosamente en vez de pisar en silencio datos que ya estaban ahí
  // (fail-closed, mismo patrón anti-duplicado que `tx.create` en D7 —
  // versiones de documento — y coherente con DF-9: "jamás renumerar").
  // Propiedad deliberada: re-ejecutar el PLAN COMPLETO contra un lote que ya
  // se escribió parcialmente FALLA (no es idempotente ni hace upsert). Si
  // eso llega a ocurrir en la práctica, la recuperación de una ejecución
  // parcial la decide el propietario caso por caso — este script no
  // improvisa lógica de "upsert reanudable".
  const TAMANIO_LOTE = 400;
  let escritas = 0;
  for (let i = 0; i < operaciones.length; i += TAMANIO_LOTE) {
    const lote = operaciones.slice(i, i + TAMANIO_LOTE);
    const batch = db.batch();
    for (const op of lote) {
      assertPathSeguro(op.path); // segunda comprobación, inmediatamente antes de encolar en el batch real.
      batch.create(db.doc(op.path), op.data);
    }
    await batch.commit();
    escritas += lote.length;
    console.error(`[importador-historicos] lote escrito: ${escritas}/${operaciones.length} documentos.`);
  }

  console.error(`[importador-historicos] LISTO — ${plan.expedientes.length} expediente(s) + sus actuaciones escritos (${operaciones.length} documentos).`);
}

async function main() {
  const argv = process.argv.slice(2);
  const idxPlan = argv.indexOf('--plan');
  if (idxPlan === -1 || !argv[idxPlan + 1]) {
    console.error('Uso: node scripts/migracion/importar-consecutivo-licencias.mjs --plan <archivo.json> [--ejecutar]');
    process.exit(1);
  }
  const rutaPlan = argv[idxPlan + 1];
  const ejecutar = argv.includes('--ejecutar');

  const plan = leerPlan(rutaPlan);
  imprimirResumen(plan);

  if (!ejecutar) {
    console.error('[importador-historicos] dry-run (default) — NO se escribió nada. Use --ejecutar (+ CONFIRMO_ESCRITURA=si) para escribir de verdad.');
    process.exit(0);
  }

  await ejecutarEscritura(plan);
}

if (process.argv[1] && process.argv[1].endsWith('importar-consecutivo-licencias.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

export { assertPathSeguro, tabularPorMotivo, construirActuacionRadicacion };
