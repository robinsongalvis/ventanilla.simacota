/**
 * Barrido transicional del fix de TZ (RS-1, ADR-0026 §A2 deuda #15;
 * `docs/planes/DICTAMEN_TZ_DIA_CIVIL.md`).
 *
 * ENTREGABLE — NO EJECUTAR sin autorización explícita del propietario en
 * modo `--corregir`. El modo por defecto (`--dimensionar`) es SOLO LECTURA
 * y es seguro de correr contra producción para MEDIR el alcance; el modo
 * `--corregir` ESCRIBE en Firestore y por eso exige el flag explícito +
 * `CONFIRMO_ESCRITURA=si` (protocolo autorización→ejecución del proyecto).
 *
 * Qué corrige (y qué NUNCA toca): `atLocalNoon` (`lib/tiempos-radicado.ts`)
 * se corrigió para anclar al día CIVIL de Bogotá en vez de a los getters de
 * TZ del proceso (bug: en un servidor UTC, cualquier radicado/requerimiento
 * emitido después de ~19:00 hora Bogotá calculaba su vencimiento con el día
 * SIGUIENTE, un sesgo SIEMPRE de +1 día, nunca -1). Este script:
 *   (a) `--dimensionar` (default, SOLO LECTURA): recorre radicados NO
 *       cerrados cuyo instante relevante (`control.fechaRadicado`, o
 *       `termino.suspension.fechaRequerimiento` si existe una suspensión)
 *       cae en o después de las 19:00 hora Bogotá, recalcula
 *       `termino.fechaVencimiento` con el algoritmo YA CORREGIDO y reporta
 *       los que difieren del valor almacenado.
 *   (b) `--corregir` (ESCRIBE, requiere autorización): para los candidatos
 *       de (a), sobrescribe SOLO `termino.fechaVencimiento` — el vencimiento
 *       de RESPUESTA DE LA ENTIDAD. JAMÁS toca
 *       `termino.suspension.fechaLimiteSubsanacion` ni ningún otro plazo ya
 *       COMUNICADO AL CIUDADANO (regla del dictamen: CPACA art. 3 num. 4,
 *       C.P. art. 83 — prohibido acortar plazos del ciudadano; el sesgo del
 *       defecto solo pudo alargar esos plazos, nunca acortarlos, así que no
 *       hay urgencia de tocarlos y tocarlos SÍ podría perjudicar). Registra
 *       un evento de trazabilidad por radicado corregido.
 *   Radicados CERRADOS nunca se tocan (Ley 594/2000 art. 19) — ni se leen
 *   para recálculo, ya que este barrido excluye `estadoActual` cerrado.
 *
 * DUPLICACIÓN DELIBERADA de una porción de `lib/tiempos-radicado.ts`: este
 * script corre como Node ESM plano (mismo patrón que
 * `detectar-consecutivos-fantasma.mjs`, sin loader de TypeScript), así que
 * NO puede importar directamente los módulos `.ts` de `lib/`. Se porta aquí
 * el subconjunto MÍNIMO necesario (Pascua, festivos, día hábil, anclaje
 * Bogotá, avance de días hábiles) — NO el catálogo de tipos de solicitud:
 * el barrido reutiliza `termino.diasRespuesta`/`termino.unidad` YA
 * ALMACENADOS en cada radicado, así que no necesita resolver el tipo. Esta
 * duplicación queda protegida por una prueba de EQUIVALENCIA CRUZADA contra
 * las funciones reales de `lib/tiempos-radicado.ts`
 * (`__tests__/barrido-vencimientos-tz.test.ts`), que falla si alguna vez
 * divergen — si el calendario festivo cambia allá, ese test lo detecta
 * aquí.
 *
 * Uso:
 *   FIREBASE_SERVICE_ACCOUNT='<json>' node scripts/laboratorio/barrido-vencimientos-tz.mjs [--dimensionar]
 *   FIREBASE_SERVICE_ACCOUNT='<json>' CONFIRMO_ESCRITURA=si node scripts/laboratorio/barrido-vencimientos-tz.mjs --corregir
 */

const TIMEZONE_COLOMBIA = 'America/Bogota';
const UMBRAL_HORA_BOGOTA = 19; // 19:00 — a partir de aquí el bug podía manifestarse en un proceso UTC

/* ── Subconjunto portado de lib/tiempos-radicado.ts (ver nota de duplicación arriba) ── */

function partesFechaColombia(date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_COLOMBIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const valor = (tipo) => Number(partes.find((p) => p.type === tipo)?.value);
  return { year: valor('year'), month: valor('month'), day: valor('day') };
}

/** Hora (0-23) del instante en la zona America/Bogota. */
export function horaBogota(instante) {
  const date = instante instanceof Date ? instante : new Date(instante);
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_COLOMBIA,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return Number(partes.find((p) => p.type === 'hour')?.value);
}

/** ¿Este instante cae en o después de `UMBRAL_HORA_BOGOTA` hora Bogotá? (candidato al bug). */
export function esCandidatoHoraTardia(instante, umbralHora = UMBRAL_HORA_BOGOTA) {
  if (!instante) return false;
  const hora = horaBogota(instante);
  return Number.isInteger(hora) && hora >= umbralHora;
}

/** Puerto CORREGIDO de `atLocalNoon` — idéntico al de `lib/tiempos-radicado.ts` tras el fix RS-1. */
export function atLocalNoonBogota(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return date;
  const { year, month, day } = partesFechaColombia(date);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function nextMonday(date) {
  const day = date.getDay();
  const delta = day === 1 ? 0 : (8 - day) % 7;
  return addDays(date, delta);
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Idéntico a `festivosColombia` de `lib/tiempos-radicado.ts` (ver nota de duplicación). */
export function festivosColombia(year) {
  const easter = easterSunday(year);
  const fixed = [
    new Date(year, 0, 1, 12),
    new Date(year, 4, 1, 12),
    new Date(year, 6, 20, 12),
    new Date(year, 7, 7, 12),
    new Date(year, 11, 8, 12),
    new Date(year, 11, 25, 12),
  ];
  const movedToMonday = [
    new Date(year, 0, 6, 12),
    new Date(year, 2, 19, 12),
    new Date(year, 5, 29, 12),
    new Date(year, 7, 15, 12),
    new Date(year, 9, 12, 12),
    new Date(year, 10, 1, 12),
    new Date(year, 10, 11, 12),
  ].map(nextMonday);
  const easterBased = [
    addDays(easter, -3),
    addDays(easter, -2),
    nextMonday(addDays(easter, 39)),
    nextMonday(addDays(easter, 60)),
    nextMonday(addDays(easter, 68)),
  ];
  return new Set([...fixed, ...movedToMonday, ...easterBased].map(toDateOnly));
}

function esDiaHabil(date, festivos) {
  return !isWeekend(date) && !festivos.has(toDateOnly(date));
}

function avanzarDiasHabiles(inicio, dias, festivos) {
  let cursor = inicio;
  let pendientes = dias;
  while (pendientes > 0) {
    cursor = addDays(cursor, 1);
    if (esDiaHabil(cursor, festivos)) pendientes -= 1;
  }
  return cursor;
}

/**
 * Recalcula `fechaVencimiento` con el algoritmo CORREGIDO, a partir de los
 * mismos datos que ya trae el radicado (no resuelve el catálogo de tipos).
 */
export function recalcularVencimiento(fechaRadicadoIso, diasRespuesta, unidad, festivosExtra = []) {
  const inicio = atLocalNoonBogota(fechaRadicadoIso);
  if (unidad === 'CALENDARIO') {
    return addDays(inicio, diasRespuesta).toISOString();
  }
  const festivos = new Set([
    ...festivosColombia(inicio.getFullYear()),
    ...festivosColombia(inicio.getFullYear() + 1),
    ...festivosExtra,
  ]);
  return avanzarDiasHabiles(inicio, diasRespuesta, festivos).toISOString();
}

/**
 * Lógica pura de un candidato: dado el radicado (subconjunto de campos) y
 * "ahora" (inyectado, no usado para el recálculo — solo para el reporte),
 * decide si es candidato y, si lo es, si el vencimiento almacenado difiere
 * del recalculado. NO escribe nada — el caller decide qué hacer con esto.
 */
export function evaluarCandidato(radicado) {
  const instanteRelevante = radicado?.termino?.suspension?.fechaRequerimiento
    ?? radicado?.control?.fechaRadicado
    ?? null;
  if (!instanteRelevante) return { esCandidato: false, motivo: 'sin fechaRadicado/fechaRequerimiento' };
  if (!esCandidatoHoraTardia(instanteRelevante)) return { esCandidato: false, motivo: 'hora Bogotá < 19:00' };

  const diasRespuesta = radicado?.termino?.diasRespuesta;
  const unidad = radicado?.termino?.unidad;
  const almacenado = radicado?.termino?.fechaVencimiento;
  if (typeof diasRespuesta !== 'number' || !unidad || !almacenado) {
    return { esCandidato: true, difiere: null, motivo: 'termino incompleto — revisar a mano' };
  }

  const recalculado = recalcularVencimiento(instanteRelevante, diasRespuesta, unidad);
  const difiere = recalculado !== almacenado;
  return {
    esCandidato: true,
    instanteRelevante,
    almacenado,
    recalculado,
    difiere,
  };
}

/* ── Ejecución contra Firestore ────────────────────────────────────────── */

async function main() {
  const modoCorregir = process.argv.includes('--corregir');

  if (modoCorregir && process.env.CONFIRMO_ESCRITURA !== 'si') {
    console.error(
      '[barrido-tz] --corregir exige CONFIRMO_ESCRITURA=si — EJECUCIÓN EN PROD REQUIERE ' +
        'AUTORIZACIÓN EXPLÍCITA DEL PROPIETARIO (protocolo autorización→ejecución). Abortando.',
    );
    process.exit(2);
  }

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

  console.error(
    `[barrido-tz] modo=${modoCorregir ? 'CORREGIR (escribe)' : 'DIMENSIONAR (solo lectura)'} · ` +
      `proyecto=${sa.project_id}`,
  );

  // Radicados NO cerrados — ajustar el criterio de "cerrado" al vigente del
  // dominio (estadoActual) si difiere; aquí se excluyen explícitamente para
  // respetar Ley 594/2000 art. 19 (nunca tocar lo archivado).
  /* ESTADOS DE CIERRE — RÉPLICA de `ESTADOS_CERRADOS` (lib/radicado-estados.ts).
     Este guion ESCRIBE sobre datos legales, así que la lista importa.

     Hasta el 26-ago-2026 traía `ARCHIVADO` y `CERRADO`, que NO existen en
     `EstadoRadicado`, y le faltaba `RECHAZADO`, que sí es cierre: dos guardas
     que nunca protegieron a nadie, y un cierre real desprotegido. El guion
     podía sobrescribir la fecha de vencimiento de un radicado RECHAZADO —
     justo lo que su propia cabecera invoca el art. 19 de la Ley 594/2000 para
     prohibir.

     Se replica porque esto es `.mjs` y el criterio vive en TypeScript. Las
     réplicas se desincronizan calladas, así que
     `__tests__/estados-cierre-barrido-tz.test.ts` la compara contra la
     canónica. `DEVUELTO` NO está a propósito: el dominio lo clasifica como
     ACTIVO, no como cierre. */
  const ESTADOS_CERRADOS = new Set(['RESUELTO', 'RECHAZADO', 'DESISTIDO']);

  const snap = await db.collection('ventanilla_radicados').get();
  const candidatos = [];
  for (const doc of snap.docs) {
    const radicado = doc.data();
    if (ESTADOS_CERRADOS.has(radicado?.estadoActual)) continue;
    const evaluacion = evaluarCandidato(radicado);
    if (evaluacion.esCandidato && evaluacion.difiere) {
      candidatos.push({ id: doc.id, ref: doc.ref, ...evaluacion });
    }
  }

  console.log(JSON.stringify({
    proyecto: sa.project_id,
    generadoEn: new Date().toISOString(),
    modo: modoCorregir ? 'corregir' : 'dimensionar',
    totalRevisados: snap.size,
    candidatos: candidatos.map(({ id, instanteRelevante, almacenado, recalculado }) => (
      { id, instanteRelevante, almacenado, recalculado }
    )),
  }, null, 2));

  if (!modoCorregir) {
    console.error(`[barrido-tz] ${candidatos.length} candidato(s) con diferencia — modo SOLO LECTURA, nada escrito.`);
    process.exit(0);
  }

  // Modo --corregir: escribe SOLO termino.fechaVencimiento + evento de trazabilidad.
  for (const c of candidatos) {
    await db.runTransaction(async (tx) => {
      tx.update(c.ref, { 'termino.fechaVencimiento': c.recalculado, ultimaActualizacion: new Date().toISOString() });
      tx.set(c.ref.collection('trazabilidad').doc(), {
        eventoId: `ev_${c.id}_VENCIMIENTO_CORREGIDO_TZ`,
        fecha: new Date().toISOString(),
        accion: 'VENCIMIENTO_CORREGIDO_TZ',
        actorUid: 'script:barrido-vencimientos-tz',
        actorNombre: 'Barrido transicional TZ (RS-1)',
        nota: `Vencimiento de respuesta recalculado por corrección de anclaje TZ (ADR-0026 §A2 deuda #15, docs/planes/DICTAMEN_TZ_DIA_CIVIL.md). Anterior: ${c.almacenado}. Nuevo: ${c.recalculado}. NO afecta plazos ya comunicados al ciudadano.`,
        metadata: { anterior: c.almacenado, nuevo: c.recalculado },
      });
    });
  }
  console.error(`[barrido-tz] ${candidatos.length} radicado(s) corregido(s) — evento de trazabilidad registrado en cada uno.`);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('barrido-vencimientos-tz.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
