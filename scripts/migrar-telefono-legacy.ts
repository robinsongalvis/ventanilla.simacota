/**
 * scripts/migrar-telefono-legacy.ts
 *
 * Sprint 1.5 — copia `solicitante.telefono` legacy a
 * `solicitante.telefonoMovil` en radicados donde este último esté vacío.
 *
 * NO borra `solicitante.telefono`. NO toca Storage, trazabilidad ni
 * adjuntos. NO modifica ningún otro campo del solicitante.
 *
 * Uso:
 *   npx tsx scripts/migrar-telefono-legacy.ts                                    # dry-run (default)
 *   npx tsx scripts/migrar-telefono-legacy.ts --execute --confirmar-produccion   # ejecución real
 *
 * Opcionales:
 *   --tenant SEC_GOBIERNO   Filtra por una dependencia específica.
 *   --preview 25            Cantidad de candidatos a listar en la salida.
 *
 * Prerrequisitos:
 *   1. Backup de Firestore ejecutado (gcloud firestore export).
 *   2. GOOGLE_APPLICATION_CREDENTIALS apuntando al service account, o
 *      FIREBASE_SERVICE_ACCOUNT como JSON en env.
 *
 * Idempotencia:
 *   Reejecutar el script salta los radicados que ya tienen
 *   `telefonoMovil` con valor. Es seguro correrlo varias veces.
 *
 * Rollback:
 *   Cada documento migrado queda marcado con `migracionTelefonoLegacyFecha`
 *   (timestamp de servidor). El campo `solicitante.telefono` queda
 *   intacto, por lo que un script inverso puede restaurar el estado
 *   previo vaciando `telefonoMovil` en los documentos marcados.
 *   La forma más segura de rollback es el backup previo a --execute.
 */

import * as admin from 'firebase-admin';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN
══════════════════════════════════════════════════════════════ */

interface Opciones {
  dryRun:              boolean;
  confirmarProduccion: boolean;
  tenant:              string | null;
  limitePreview:       number;
  tamanoBatch:         number;
}

const CONFIRMACION_LITERAL = 'SIMACOTA CONFIRMO';
const COLECCION_OBJETIVO   = 'ventanilla_radicados';

/* ══════════════════════════════════════════════════════════════
   FILTRO PURO (exportado para tests)
══════════════════════════════════════════════════════════════ */

export interface SolicitanteMinimo {
  telefono?:      string | null;
  telefonoMovil?: string | null;
}

/**
 * Un radicado es candidato a migración si:
 *   - `solicitante.telefono` es un string no vacío tras trim(), y
 *   - `solicitante.telefonoMovil` es null, undefined o vacío tras trim().
 *
 * Nunca sobreescribe un `telefonoMovil` con valor.
 */
export function esCandidatoMigracion(s: SolicitanteMinimo): boolean {
  const telefono = (s.telefono ?? '').trim();
  if (telefono.length === 0) return false;
  const movil = (s.telefonoMovil ?? '').trim();
  return movil.length === 0;
}

/* ══════════════════════════════════════════════════════════════
   PARSEO DE ARGUMENTOS
══════════════════════════════════════════════════════════════ */

function parsearArgs(argv: readonly string[]): Opciones {
  const flags = new Set(argv);
  const valor = (key: string): string | null => {
    const idx = argv.indexOf(key);
    return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : null;
  };

  return {
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
   RESUMEN Y EJECUCIÓN
══════════════════════════════════════════════════════════════ */

interface DocResumen {
  radicadoId:    string;
  tenant:        string;
  fechaRadicado: string;
  telefono:      string;
  candidato:     boolean;
}

function extraerResumen(doc: FirebaseFirestore.QueryDocumentSnapshot): DocResumen {
  const data = doc.data() as {
    radicadoId?: string;
    control?: { fechaRadicado?: string };
    clasificacion?: { oficinaDestino?: string };
    solicitante?: SolicitanteMinimo;
  };
  const solicitante = data.solicitante ?? {};
  return {
    radicadoId:    data.radicadoId ?? doc.id,
    tenant:        data.clasificacion?.oficinaDestino ?? '(sin tenant)',
    fechaRadicado: data.control?.fechaRadicado ?? '',
    telefono:      (solicitante.telefono ?? '').trim(),
    candidato:     esCandidatoMigracion(solicitante),
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
  console.error(`▶ Tenant: ${opciones.tenant ?? 'todos'}\n`);

  let consulta: FirebaseFirestore.Query = db.collection(COLECCION_OBJETIVO);
  if (opciones.tenant) {
    consulta = consulta.where('clasificacion.oficinaDestino', '==', opciones.tenant);
  }

  const snap       = await consulta.get();
  const todos      = snap.docs.map(extraerResumen);
  const candidatos = todos.filter((d) => d.candidato);

  console.error('═══════════════════════════════════════════════');
  console.error(`Total de radicados escaneados: ${todos.length}`);
  console.error(`Candidatos para migración:     ${candidatos.length}`);
  console.error(`Ya migrados o sin telefono:    ${todos.length - candidatos.length}`);
  console.error('═══════════════════════════════════════════════\n');

  const distribucion = distribucionPorTenant(candidatos);
  if (distribucion.size > 0) {
    console.error('Distribución por dependencia (candidatos):');
    for (const [tenant, cantidad] of distribucion) {
      console.error(`  - ${tenant.padEnd(30)} ${cantidad}`);
    }
    console.error('');
  }

  const muestra = candidatos.slice(0, opciones.limitePreview);
  if (muestra.length > 0) {
    console.error(`Muestra de los primeros ${muestra.length} candidatos:`);
    console.error(
      'radicadoId'.padEnd(28),
      'telefono'.padEnd(18),
      'dependencia'.padEnd(30),
      'fecha',
    );
    for (const d of muestra) {
      console.error(
        d.radicadoId.padEnd(28),
        d.telefono.padEnd(18),
        d.tenant.padEnd(30),
        d.fechaRadicado,
      );
    }
    if (candidatos.length > opciones.limitePreview) {
      console.error(`\n... y ${candidatos.length - opciones.limitePreview} más.\n`);
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

  if (candidatos.length === 0) {
    console.error('✓ Nada por migrar. Salida sin cambios.');
    return;
  }

  console.error(`\n⚠  Está a punto de migrar ${candidatos.length} radicados en ${projectId}.`);
  console.error('⚠  Los campos escritos: solicitante.telefonoMovil, migracionTelefonoLegacyFecha.');
  console.error('⚠  El campo `solicitante.telefono` NO se toca. La operación no es transaccional entre batches.\n');

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

  console.error(`\n▶ Aplicando migración en batches de ${opciones.tamanoBatch}...`);
  let actualizados = 0;
  for (let i = 0; i < candidatos.length; i += opciones.tamanoBatch) {
    const lote = candidatos.slice(i, i + opciones.tamanoBatch);
    const batch = db.batch();
    for (const d of lote) {
      batch.update(db.collection(COLECCION_OBJETIVO).doc(d.radicadoId), {
        'solicitante.telefonoMovil':    d.telefono,
        migracionTelefonoLegacyFecha:   admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    actualizados += lote.length;
    console.error(`  ✓ ${actualizados} / ${candidatos.length}`);
  }

  console.error(`\n✓ Completado. ${actualizados} radicados migrados.`);
  console.error('  El campo `solicitante.telefono` legacy quedó preservado íntegro.');
}

/* ══════════════════════════════════════════════════════════════
   ENTRY POINT
══════════════════════════════════════════════════════════════ */

async function main(): Promise<void> {
  const opciones = parsearArgs(process.argv.slice(2));
  await ejecutar(opciones);
}

// Entry point solo se ejecuta cuando el script se invoca directamente
// (npx tsx / node), no cuando se importa desde tests.
const invocadoDirectamente =
  process.argv[1] !== undefined && process.argv[1].endsWith('migrar-telefono-legacy.ts');
if (invocadoDirectamente) {
  main().catch((err) => {
    console.error(`\n✗ ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
