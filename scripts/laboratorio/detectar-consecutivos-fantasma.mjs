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
 * Salida: JSON estructurado (evidencia objetiva) — 0 huecos y 0 duplicados ⇒
 * cierre limpio; N huecos y/o M duplicados ⇒ lista exacta para las constancias
 * de subsanación (AGN 060/2001 art. 5, que exige unicidad Y continuidad).
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
 * Unicidad (AGN 060/2001): dada la LISTA de consecutivos presentes (con posibles
 * repeticiones), devuelve los que aparecen más de una vez, ascendente. Un mismo
 * consecutivo en dos documentos es tan grave como un hueco — un `Set` lo oculta,
 * por eso este chequeo opera sobre la lista completa (hallazgo de seguridad).
 */
export function duplicadosDe(consecutivosLista) {
  const conteo = new Map();
  for (const c of consecutivosLista) conteo.set(c, (conteo.get(c) ?? 0) + 1);
  return [...conteo.entries()]
    .filter(([, n]) => n > 1)
    .map(([c]) => c)
    .sort((a, b) => a - b);
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

/**
 * ADR-0024: el id de un documento del año `anio` lleva ese año en el tercer
 * segmento, ya sea puro (`-{anio}-`, formato anterior — nunca se reescribe)
 * o con el mes pegado (`-{anio}{MM}-`, formato vigente). Ambos conviven en
 * el mismo año: esta función es la ÚNICA fuente de verdad de "pertenece al
 * año" para que el detector no quede ciego a ninguno de los dos.
 */
export function perteneceAlAnio(docId, anio) {
  const re = new RegExp(`-${anio}-|-${anio}(?:0[1-9]|1[0-2])-`);
  return re.test(String(docId));
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
    const presentesLista = [];
    for (const d of docs.docs) {
      if (!perteneceAlAnio(d.id, anio)) continue;
      const c = consecutivoDeId(d.id);
      if (c !== null) presentesLista.push(c);
    }
    const presentes = new Set(presentesLista);

    const huecos = huecosDe(ultimo, presentes);
    const duplicados = duplicadosDe(presentesLista);
    reporte.series[serie] = {
      coleccion, ultimo,
      documentos: presentesLista.length,
      distintos: presentes.size,
      huecos, duplicados,
    };
  }

  // JSON a stdout = evidencia objetiva.
  console.log(JSON.stringify(reporte, null, 2));
  const totalHuecos = Object.values(reporte.series).reduce((a, s) => a + s.huecos.length, 0);
  const totalDuplicados = Object.values(reporte.series).reduce((a, s) => a + s.duplicados.length, 0);
  console.error(totalHuecos === 0 && totalDuplicados === 0
    ? '[detector] CERO HUECOS y CERO DUPLICADOS — cierre limpio (AGN 060/2001: unicidad + continuidad).'
    : `[detector] ${totalHuecos} hueco(s) + ${totalDuplicados} duplicado(s) — requieren constancia de subsanación (AGN 060/2001 art. 5).`);
  process.exit(0);
}

// Solo ejecuta si se invoca directamente (permite importar las funciones puras en tests).
if (process.argv[1] && process.argv[1].endsWith('detectar-consecutivos-fantasma.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
