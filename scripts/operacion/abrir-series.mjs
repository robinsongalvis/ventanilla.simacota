/**
 * scripts/operacion/abrir-series.mjs
 *
 * ABRE las series consecutivas: sincroniza los contadores de la plataforma con
 * el libro de la Alcaldía, el día del arranque real.
 *
 * POR QUÉ NO SE FIJA POR ANTICIPADO. El libro avanza todos los días mientras
 * ventanilla radica a mano: cualquier número decidido con antelación queda
 * viejo antes del primer trámite. El propietario consulta el libro EN EL
 * MOMENTO y fija el punto entonces.
 *
 * POR QUÉ CON MARGEN Y NO EN EL SIGUIENTE. Entre la consulta y el arranque
 * puede colarse un radicado manual. Con margen, ese radicado cabe sin chocar:
 * UN HUECO SE EXPLICA CON ACTA, UN DUPLICADO NO SE ARREGLA.
 *
 * ACTO ÚNICO. Si un contador ya está por encima del punto configurado, NO SE
 * TOCA. Bajar un contador es emitir dos veces el mismo número.
 *
 * DÓNDE SE CONFIGURA: documento `configuracion/series` en Firestore, para que
 * el punto se fije SIN DESPLIEGUE. Forma:
 *   { apertura: { radicados: { desde: 1600, autorizadoPor: "...", referencia: "..." }, ... } }
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT="$(grep '^FIREBASE_SERVICE_ACCOUNT=' .env.local | cut -d= -f2-)" \
 *     node scripts/operacion/abrir-series.mjs --proyecto <id>            # DRY-RUN
 *   CONFIRMO_APERTURA=SI ... node scripts/operacion/abrir-series.mjs --proyecto <id>
 */
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

const SERIES = ['radicados', 'salidas', 'planillas', 'expedientes'];

/* Réplica de `decidirApertura` (lib/server/apertura-series.ts). Este script es
   un `.mjs` y no puede importar TypeScript. La copia NO queda a la buena fe:
   `__tests__/abrir-series-coherente.test.ts` enfrenta ambas implementaciones a
   una matriz de casos y falla si divergen. */
export function decidir(serie, ultimoActual, config) {
  if (!config) return { accion: 'NADA', motivo: `La serie '${serie}' no tiene punto de apertura configurado.` };
  if (!Number.isInteger(ultimoActual) || ultimoActual < 0) {
    return { accion: 'RECHAZAR', motivo: `El contador de '${serie}' tiene un valor inválido (${ultimoActual}). No se abre sobre un contador que no se entiende.` };
  }
  if (!Number.isInteger(config.desde) || config.desde <= 0) {
    return { accion: 'RECHAZAR', motivo: `Punto de apertura inválido para '${serie}' (${config.desde}). Debe ser un entero positivo.` };
  }
  if (!config.autorizadoPor?.trim()) {
    return { accion: 'RECHAZAR', motivo: `La apertura de '${serie}' no declara quién la autoriza. Un salto en la serie sin dueño es un salto que nadie puede explicar.` };
  }
  const nuevoUltimo = config.desde - 1;
  if (nuevoUltimo <= ultimoActual) {
    return { accion: 'NADA', motivo: `El contador de '${serie}' ya está en ${ultimoActual}; abrir en ${config.desde} lo dejaría en ${nuevoUltimo}, que no avanza. NO se toca: bajar un contador es emitir dos veces el mismo número.` };
  }
  return { accion: 'ABRIR', veniaDe: ultimoActual, nuevoUltimo };
}

export const MOTIVO_DEL_SALTO =
  'El libro de correspondencia avanza a diario mientras ventanilla radica a mano, ' +
  'así que cualquier número fijado por anticipado queda desactualizado antes del ' +
  'primer trámite real. La serie se abre POR ENCIMA del libro, con margen, para ' +
  'que un radicado manual hecho entre la consulta y el arranque no choque: un ' +
  'hueco en la serie se explica con acta, un duplicado no se arregla.';

/* ── A partir de aquí, solo se ejecuta cuando el script se invoca directamente.
      Así el test puede importar `decidir` sin abrir Firestore. ── */
if (process.argv[1]?.endsWith('abrir-series.mjs')) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i === -1 ? undefined : process.argv[i + 1]; };
  const proyecto = arg('--proyecto');
  const ejecutar = process.env.CONFIRMO_APERTURA === 'SI';
  if (!proyecto) { console.error('Uso: --proyecto <project_id>'); process.exit(1); }

  const crudo = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim().replace(/^['"]/, '').replace(/['"]$/, '');
  if (!crudo) { console.error('Falta FIREBASE_SERVICE_ACCOUNT.'); process.exit(2); }
  let credencial;
  try { credencial = JSON.parse(crudo); } catch (e) { console.error('Credencial no es JSON:', e.message); process.exit(2); }
  if (credencial.project_id !== proyecto) {
    console.error(`⛔ GUARDA: credencial de "${credencial.project_id}", se ordenó "${proyecto}". Nada se tocó.`);
    process.exit(3);
  }
  if (!getApps().length) initializeApp({ credential: cert(credencial), projectId: proyecto });
  const db = getFirestore();
  const anio = new Date().getFullYear();
  const ahoraIso = new Date().toISOString();

  const cfgSnap = await db.doc('configuracion/series').get();
  const apertura = cfgSnap.exists ? (cfgSnap.data()?.apertura ?? {}) : {};

  console.log(`\nAPERTURA DE SERIES · proyecto ${proyecto} · año ${anio}`);
  console.log(ejecutar ? 'MODO: EJECUCIÓN — se escribirá en los contadores.\n'
                       : 'MODO: DRY-RUN — no se escribe nada. Para ejecutar: CONFIRMO_APERTURA=SI\n');

  const plan = [];
  for (const serie of SERIES) {
    const snap = await db.doc(`counters/${serie}-${anio}`).get();
    const ultimoActual = Number(snap.data()?.ultimo ?? 0);
    const d = decidir(serie, ultimoActual, apertura[serie]);

    /* EN TEXTO PLANO, no en JSON. Quien corra esto el día del arranque va a
       estar mirando la pantalla con el libro de ventanilla al lado: tiene que
       poder leer de un vistazo cuál será el primer número, sin interpretar
       nada. */
    console.log(`── ${serie.toUpperCase()}`);
    console.log(`   El contador está en:      ${ultimoActual}`);
    if (d.accion === 'ABRIR') {
      console.log(`   Se abrirá dejándolo en:   ${d.nuevoUltimo}`);
      console.log(`   ► EL PRIMER ${serie === 'radicados' ? 'RADICADO' : 'NÚMERO'} SERÁ:   ${d.nuevoUltimo + 1}`);
      console.log(`   Autoriza:                 ${apertura[serie].autorizadoPor}`);
      plan.push({ serie, d, cfg: apertura[serie] });
    } else if (d.accion === 'NADA') {
      console.log(`   Sin cambios. ${d.motivo}`);
    } else {
      console.log(`   ⛔ RECHAZADA. ${d.motivo}`);
    }
    console.log('');
  }

  const rechazos = SERIES.filter((s) => decidir(s, 0, apertura[s]).accion === 'RECHAZAR' && apertura[s]);
  if (rechazos.length) {
    console.error(`⛔ Hay ${rechazos.length} serie(s) con configuración rechazada. NADA se escribe (todo-o-nada).`);
    process.exit(4);
  }
  if (!plan.length) { console.log('No hay ninguna serie que abrir.'); process.exit(0); }
  if (!ejecutar) { console.log('DRY-RUN terminado. Revise los números de arriba contra el libro antes de ejecutar.'); process.exit(0); }

  for (const { serie, d, cfg } of plan) {
    await db.doc(`counters/${serie}-${anio}`).set({
      ultimo: d.nuevoUltimo,
      anio,
      actualizadoEn: ahoraIso,
      apertura: {
        veniaDe: d.veniaDe,
        abiertoEn: d.nuevoUltimo + 1,
        fecha: ahoraIso,
        autorizadoPor: cfg.autorizadoPor.trim(),
        ...(cfg.referencia ? { referencia: cfg.referencia } : {}),
        motivoDelSalto: MOTIVO_DEL_SALTO,
      },
    }, { merge: true });
    console.log(`   ABIERTA  ${serie}: ${d.veniaDe} → primer número ${d.nuevoUltimo + 1}`);
  }
  console.log('\n✔ Apertura ejecutada. El salto queda registrado en cada contador con su motivo.');
}
