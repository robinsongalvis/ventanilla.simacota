/**
 * scripts/cargar-normograma-nucleo.ts
 *
 * Sprint SIMI Fase 2 — carga el paquete núcleo del normograma a
 * `normatividad_nacional` para que el motor RAG empiece a citar
 * fundamento real (hoy la colección está vacía).
 *
 * NO borra nada. NO toca otras colecciones. Idempotente: cada norma se
 * escribe con su `slug` como id del documento, así reejecutar
 * actualiza en vez de duplicar. Un jurista de la alcaldía ratifica o
 * ajusta el estado sobre la base ya cargada.
 *
 * Uso:
 *   npx tsx scripts/cargar-normograma-nucleo.ts                                   # dry-run (default)
 *   npx tsx scripts/cargar-normograma-nucleo.ts --execute --confirmar-produccion  # carga real
 *
 * Prerrequisitos:
 *   1. Backup de Firestore recomendado (gcloud firestore export).
 *   2. GOOGLE_APPLICATION_CREDENTIALS apuntando al service account, o
 *      FIREBASE_SERVICE_ACCOUNT como JSON en env.
 */

import { applicationDefault, cert, getApp, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { NORMOGRAMA_NUCLEO, validarSemilla } from '../lib/simi/normograma-nucleo';

const COLECCION = 'normatividad_nacional';
const CONFIRMACION = '--confirmar-produccion';

interface Opciones {
  dryRun:              boolean;
  confirmarProduccion: boolean;
}

function parseArgs(): Opciones {
  const flags = new Set(process.argv.slice(2));
  return {
    dryRun:              !flags.has('--execute'),
    confirmarProduccion: flags.has(CONFIRMACION),
  };
}

function inicializarAdmin(): App {
  if (getApps().length > 0) return getApp();

  const credsEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (credsEnv) {
    const creds = JSON.parse(credsEnv) as ServiceAccount;
    return initializeApp({ credential: cert(creds) });
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault() });
  }
  throw new Error(
    'Credenciales ausentes. Configure GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT.',
  );
}

async function ejecutar(opts: Opciones): Promise<void> {
  // La semilla nunca se carga si tiene problemas de estructura.
  const problemas = validarSemilla();
  if (problemas.length > 0) {
    console.error('✖ La semilla tiene problemas y no se cargará:');
    for (const p of problemas) console.error(`  - ${p.slug} · ${p.campo}: ${p.detalle}`);
    process.exit(1);
  }

  console.log(`▸ Paquete núcleo: ${NORMOGRAMA_NUCLEO.length} normas → ${COLECCION}`);
  console.log(`▸ Modo: ${opts.dryRun ? 'DRY-RUN (no escribe)' : 'EJECUCIÓN REAL'}\n`);

  for (const n of NORMOGRAMA_NUCLEO) {
    const etiqueta = `${n.slug.padEnd(38)} ${n.estado.padEnd(10)} ${n.titulo.slice(0, 60)}`;
    console.log(`  ${opts.dryRun ? '·' : '✔'} ${etiqueta}`);
  }

  if (opts.dryRun) {
    console.log('\nDry-run: no se escribió nada. Para cargar de verdad:');
    console.log('  npx tsx scripts/cargar-normograma-nucleo.ts --execute --confirmar-produccion');
    return;
  }

  if (!opts.confirmarProduccion) {
    console.error(`\n✖ Falta ${CONFIRMACION}. Abortado por seguridad.`);
    process.exit(1);
  }

  const app = inicializarAdmin();
  const db  = getFirestore(app);
  const ahora = new Date().toISOString();
  let escritos = 0;

  // Lotes de 400 (bien bajo el límite de 500 por batch).
  for (let i = 0; i < NORMOGRAMA_NUCLEO.length; i += 400) {
    const lote = NORMOGRAMA_NUCLEO.slice(i, i + 400);
    const batch = db.batch();
    for (const { slug, ...doc } of lote) {
      const ref = db.collection(COLECCION).doc(slug);
      // merge: reejecutar actualiza metadatos sin pisar createdAt.
      batch.set(ref, { ...doc, createdAt: ahora, updatedAt: ahora }, { merge: true });
      escritos += 1;
    }
    await batch.commit();
  }

  console.log(`\n✔ ${escritos} normas cargadas/actualizadas en ${COLECCION}.`);
  console.log('  Un jurista de la alcaldía puede ratificar o ajustar el estado desde el normograma.');
}

ejecutar(parseArgs()).catch((err) => {
  console.error('Error del cargador:', err instanceof Error ? err.message : err);
  process.exit(1);
});
