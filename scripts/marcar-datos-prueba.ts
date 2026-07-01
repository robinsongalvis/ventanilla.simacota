/**
 * scripts/marcar-datos-prueba.ts
 *
 * Sprint Preoperación B — marca radicados anteriores a la fecha de corte del
 * piloto como datos de prueba (`isTest: true`, `excludeFromMetrics: true`)
 * para que no aparezcan en dashboard, búsqueda avanzada ni reportes MIPG,
 * pero se preserven íntegros para auditoría.
 *
 * NO borra documentos. NO toca trazabilidad, adjuntos, usuarios ni contadores.
 * NO toca Storage. NO modifica auditorías.
 *
 * Uso:
 *   npx tsx scripts/marcar-datos-prueba.ts                                    # dry-run (default)
 *   npx tsx scripts/marcar-datos-prueba.ts --execute --confirmar-produccion   # ejecución real
 *
 * Prerrequisitos:
 *   1. Backup de Firestore ejecutado (gcloud firestore export).
 *   2. GOOGLE_APPLICATION_CREDENTIALS apuntando al service account, o
 *      FIREBASE_SERVICE_ACCOUNT como JSON en env.
 */

import * as admin from 'firebase-admin';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN
══════════════════════════════════════════════════════════════ */

interface Opciones {
  fechaCorte:            Date;
  dryRun:                boolean;
  confirmarProduccion:   boolean;
  tenant:                string | null;
  limitePreview:         number;
  tamanoBatch:           number;
}

const CONFIRMACION_LITERAL = 'SIMACOTA CONFIRMO';
const COLECCION_OBJETIVO   = 'ventanilla_radicados';

/* ══════════════════════════════════════════════════════════════
   PARSEO DE ARGUMENTOS
══════════════════════════════════════════════════════════════ */

function parsearArgs(argv: readonly string[]): Opciones {
  const flags = new Set(argv);
  const valor = (key: string): string | null => {
    const idx = argv.indexOf(key);
    return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : null;
  };

  const fechaCorteRaw = valor('--fecha-corte');
  const fechaCorte    = fechaCorteRaw ? new Date(fechaCorteRaw) : new Date();
  if (Number.isNaN(fechaCorte.getTime())) {
    throw new Error(`--fecha-corte inválida: "${fechaCorteRaw}". Use ISO (ej: 2026-07-01T00:00:00Z).`);
  }

  return {
    fechaCorte,
    dryRun:              !flags.has('--execute'),
    confirmarProduccion: flags.has('--confirmar-produccion'),
    tenant:              valor('--tenant'),
    limitePreview:       Number(valor('--preview') ?? 10),
    tamanoBatch:         400,
  };
}

/* ══════════════════════════════════════════════════════════════
   INICIALIZACIÓN DE ADMIN SDK
══════════════════════════════════════════════════════════════ */

function inicializarAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const credsEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (credsEnv) {
    const creds = JSON.parse(credsEnv) as admin.ServiceAccount;
    return admin.initializeApp({ credential: admin.credential.cert(creds) });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  throw new Error(
    'Credenciales ausentes. Configure GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT.',
  );
}

/* ══════════════════════════════════════════════════════════════
   LÓGICA DE ANÁLISIS Y MARCADO
══════════════════════════════════════════════════════════════ */

interface DocResumen {
  radicadoId:    string;
  fechaRadicado: string;
  tenant:        string;
  estado:        string;
  yaMarcado:     boolean;
}

function extraerResumen(doc: FirebaseFirestore.QueryDocumentSnapshot): DocResumen {
  const data = doc.data() as {
    radicadoId?: string;
    control?: { fechaRadicado?: string };
    clasificacion?: { oficinaDestino?: string };
    estadoActual?: string;
    isTest?: boolean;
    excludeFromMetrics?: boolean;
  };
  return {
    radicadoId:    data.radicadoId ?? doc.id,
    fechaRadicado: data.control?.fechaRadicado ?? '',
    tenant:        data.clasificacion?.oficinaDestino ?? '(sin tenant)',
    estado:        data.estadoActual ?? '',
    yaMarcado:     Boolean(data.isTest) || Boolean(data.excludeFromMetrics),
  };
}

function distribucionPorTenant(docs: readonly DocResumen[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of docs) {
    m.set(d.tenant, (m.get(d.tenant) ?? 0) + 1);
  }
  return new Map([...m.entries()].sort((a, b) => b[1] - a[1]));
}

async function ejecutar(opciones: Opciones): Promise<void> {
  const app = inicializarAdmin();
  const db  = app.firestore();

  const credsInline = process.env.FIREBASE_SERVICE_ACCOUNT
    ? (JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as { project_id?: string })
    : {};
  const projectId = app.options.projectId ?? credsInline.project_id ?? '(desconocido)';

  console.error(`\n▶ Proyecto Firebase objetivo: ${projectId}`);
  console.error(`▶ Modo: ${opciones.dryRun ? 'DRY-RUN (no escribe)' : 'EJECUCIÓN REAL'}`);
  console.error(`▶ Fecha de corte: ${opciones.fechaCorte.toISOString()}`);
  console.error(`▶ Tenant: ${opciones.tenant ?? 'todos'}\n`);

  let consulta: FirebaseFirestore.Query = db
    .collection(COLECCION_OBJETIVO)
    .where('control.fechaRadicado', '<', opciones.fechaCorte.toISOString());

  if (opciones.tenant) {
    consulta = consulta.where('clasificacion.oficinaDestino', '==', opciones.tenant);
  }

  const snap = await consulta.get();
  const todos      = snap.docs.map(extraerResumen);
  const yaMarcados = todos.filter((d) => d.yaMarcado);
  const paraMarcar = todos.filter((d) => !d.yaMarcado);

  console.error('═══════════════════════════════════════════════');
  console.error(`Total de radicados encontrados antes de la fecha de corte: ${todos.length}`);
  console.error(`Ya marcados como prueba: ${yaMarcados.length}`);
  console.error(`Pendientes por marcar:   ${paraMarcar.length}`);
  console.error('═══════════════════════════════════════════════\n');

  const distribucion = distribucionPorTenant(paraMarcar);
  if (distribucion.size > 0) {
    console.error('Distribución por dependencia (pendientes por marcar):');
    for (const [tenant, cantidad] of distribucion) {
      console.error(`  - ${tenant.padEnd(30)} ${cantidad}`);
    }
    console.error('');
  }

  const muestra = paraMarcar.slice(0, opciones.limitePreview);
  if (muestra.length > 0) {
    console.error(`Muestra de los primeros ${muestra.length} radicados a marcar:`);
    console.error('radicadoId'.padEnd(28), 'fecha'.padEnd(22), 'dependencia'.padEnd(30), 'estado');
    for (const d of muestra) {
      console.error(
        d.radicadoId.padEnd(28),
        d.fechaRadicado.padEnd(22),
        d.tenant.padEnd(30),
        d.estado,
      );
    }
    if (paraMarcar.length > opciones.limitePreview) {
      console.error(`... y ${paraMarcar.length - opciones.limitePreview} más.\n`);
    } else {
      console.error('');
    }
  }

  if (opciones.dryRun) {
    console.error('✓ Dry-run finalizado. NO se escribió nada.');
    console.error('  Para ejecutar cambios reales, use: --execute --confirmar-produccion');
    return;
  }

  if (!opciones.confirmarProduccion) {
    throw new Error(
      '--execute requiere también --confirmar-produccion. Abortando por seguridad.',
    );
  }

  if (paraMarcar.length === 0) {
    console.error('✓ Nada por marcar. Salida sin cambios.');
    return;
  }

  console.error(`\n⚠  Está a punto de marcar ${paraMarcar.length} radicados en ${projectId}.`);
  console.error('⚠  Los campos agregados serán: isTest=true, excludeFromMetrics=true.');
  console.error('⚠  Esta acción es reversible manualmente pero requiere script inverso.\n');

  const rl = createInterface({ input, output });
  const respuesta = await rl.question(
    `Para confirmar, escriba exactamente:\n${CONFIRMACION_LITERAL}\n> `,
  );
  await rl.close();

  if (respuesta.trim() !== CONFIRMACION_LITERAL) {
    console.error('✗ Confirmación no coincide. Abortado sin cambios.');
    process.exitCode = 2;
    return;
  }

  console.error(`\n▶ Aplicando marcado en batches de ${opciones.tamanoBatch}...`);
  let actualizados = 0;
  for (let i = 0; i < paraMarcar.length; i += opciones.tamanoBatch) {
    const lote = paraMarcar.slice(i, i + opciones.tamanoBatch);
    const batch = db.batch();
    for (const d of lote) {
      batch.update(db.collection(COLECCION_OBJETIVO).doc(d.radicadoId), {
        isTest:                   true,
        excludeFromMetrics:       true,
        marcadoPreoperacionFecha: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    actualizados += lote.length;
    console.error(`  ✓ ${actualizados} / ${paraMarcar.length}`);
  }

  console.error(`\n✓ Completado. ${actualizados} radicados marcados como prueba.`);
  console.error('  Documentos preservados íntegramente. Trazabilidad, adjuntos y auditorías intactos.');
}

/* ══════════════════════════════════════════════════════════════
   ENTRY POINT
══════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  const opciones = parsearArgs(process.argv.slice(2));
  await ejecutar(opciones);
}

main().catch((err) => {
  console.error(`\n✗ ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
