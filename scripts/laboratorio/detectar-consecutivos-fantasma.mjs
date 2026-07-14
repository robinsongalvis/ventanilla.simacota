/**
 * Detector de consecutivos fantasma — barrida de cierre de H3 (Bloque 2).
 *
 * SOLO LECTURA. Nunca escribe. Seguro para ejecutar contra PRODUCCIÓN: por cada
 * serie legal (radicados, salidas, planillas) y año, compara el valor del
 * contador (`counters/{serie}-{año}.ultimo`) contra los consecutivos realmente
 * persistidos, y reporta los huecos (números consumidos sin documento).
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT='<json>' node scripts/laboratorio/detectar-consecutivos-fantasma.mjs [--anio 2026]
 *
 * Salida: JSON estructurado (evidencia objetiva) — 0 huecos ⇒ cierre limpio;
 * N huecos ⇒ lista exacta para generar las constancias de subsanación (AGN
 * 060/2001 art. 5).
 */

/** Colección de cada serie. */
export const COLECCION_POR_SERIE = {
  radicados: 'ventanilla_radicados',
  salidas:   'ventanilla_salidas',
  planillas: 'ventanilla_planillas',
};

/**
 * Lógica pura de detección (testeable sin Firebase): dado el `ultimo` del
 * contador y el conjunto de consecutivos presentes, devuelve los huecos
 * (1..ultimo que no están presentes), en orden ascendente.
 */
export function huecosDe(ultimo, consecutivosPresentes) {
  const presentes = consecutivosPresentes instanceof Set
    ? consecutivosPresentes
    : new Set(consecutivosPresentes);
  const huecos = [];
  for (let i = 1; i <= ultimo; i += 1) {
    if (!presentes.has(i)) huecos.push(i);
  }
  return huecos;
}

/**
 * Extrae el consecutivo (entero) del id de documento: el número va SIEMPRE en
 * el último segmento separado por `-` (1-110-2026-00000042 → 42; PL-2026-0007
 * → 7; 2-110-2026-00000005 → 5). Devuelve null si no es parseable.
 */
export function consecutivoDeId(docId) {
  const ultimo = String(docId).split('-').pop();
  const n = Number(ultimo);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ── Ejecución contra Firestore (solo lectura) ─────────────────────────── */

async function main() {
  const { getFirestore } = await import('firebase-admin/firestore');
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT no configurado.');
    process.exit(2);
  }
  const sa = JSON.parse(raw);
  sa.private_key = sa.private_key?.replace(/\\n/g, '\n');

  if (!getApps().length) {
    initializeApp({ credential: cert({
      projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key,
    }) });
  }
  const db = getFirestore();

  const anioArg = process.argv.indexOf('--anio');
  const anio = anioArg >= 0 ? Number(process.argv[anioArg + 1]) : new Date().getFullYear();

  console.error(`[detector] SOLO LECTURA · proyecto=${sa.project_id} · año=${anio}`);

  const reporte = { proyecto: sa.project_id, anio, generadoEn: new Date().toISOString(), series: {} };

  for (const [serie, coleccion] of Object.entries(COLECCION_POR_SERIE)) {
    const counterSnap = await db.doc(`counters/${serie}-${anio}`).get();
    const ultimo = Number(counterSnap.data()?.ultimo ?? 0);

    // Lectura de solo los ids del año (nunca escribe).
    const docs = await db.collection(coleccion).get();
    const presentes = new Set();
    for (const d of docs.docs) {
      if (!d.id.includes(`-${anio}-`)) continue;
      const c = consecutivoDeId(d.id);
      if (c !== null) presentes.add(c);
    }

    const huecos = huecosDe(ultimo, presentes);
    reporte.series[serie] = { coleccion, ultimo, presentes: presentes.size, huecos };
  }

  // JSON a stdout = evidencia objetiva.
  console.log(JSON.stringify(reporte, null, 2));
  const totalHuecos = Object.values(reporte.series).reduce((a, s) => a + s.huecos.length, 0);
  console.error(totalHuecos === 0
    ? '[detector] CERO HUECOS — cierre limpio.'
    : `[detector] ${totalHuecos} hueco(s) — requieren constancia de subsanación (AGN 060/2001 art. 5).`);
  process.exit(0);
}

// Solo ejecuta si se invoca directamente (permite importar las funciones puras en tests).
if (process.argv[1] && process.argv[1].endsWith('detectar-consecutivos-fantasma.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
