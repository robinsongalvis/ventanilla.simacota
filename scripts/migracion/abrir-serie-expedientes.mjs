/**
 * scripts/migracion/abrir-serie-expedientes.mjs
 *
 * ABRE la serie legal de expedientes para un año: crea
 * `counters/expedientes-{año}` con el último consecutivo que el LIBRO DE
 * PAPEL ya consumió, de modo que la primera emisión real no duplique un
 * número histórico.
 *
 * ── POR QUÉ EXISTE ────────────────────────────────────────────────────
 * La serie de expedientes no nació digital. Los números del libro de
 * Planeación se importaron a Firestore como `numeroExpediente.numero`, pero
 * el importador tiene PROHIBIDO por diseño (DF-9) escribir en `counters/` y
 * `unicidad_expedientes/`. Quedaron ocupados SIN reserva y SIN haber
 * avanzado la serie. Desde ADR-0031 emitir sin la serie abierta falla
 * (`SerieNoAbiertaError`); este script es el acto de abrirla.
 *
 * ── EL LÍMITE QUE NINGÚN CÓDIGO PUEDE SALVAR ──────────────────────────
 * El insumo es un SNAPSHOT del Excel de Planeación, y ese Excel SIGUE VIVO
 * (lo dice su propia procedencia). Si Planeación asentó números en papel
 * después de la extracción, este script no puede verlos: no están en el
 * snapshot ni en Firestore. Por eso `--ejecutar` exige
 * `--libro-confirmado-el`, la fecha en que alguien CONFIRMÓ con Planeación
 * el último número emitido. El script no puede verificar el mundo; sí puede
 * negarse a escribir sin que conste quién lo miró y cuándo.
 *
 * ── SEGURIDAD ─────────────────────────────────────────────────────────
 *  1. Dry-run por defecto: sin `--ejecutar` no escribe NADA.
 *  2. `--ejecutar` exige además `CONFIRMO_ESCRITURA=si` exacta.
 *  3. `--proyecto` debe coincidir con el service account.
 *  4. `--ultimo` debe coincidir con el máximo del libro.
 *  5. `--libro-confirmado-el` obligatorio y reciente.
 *  6. Solo el año en curso, salvo `--anio-futuro` explícito.
 *  7. Escribe con `create`: nunca pisa una serie abierta.
 *  8. Contrasta contra Firestore y falla CERRADO si el resultado no cuadra.
 *
 * Uso:
 *   node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto <id>
 *   node scripts/migracion/abrir-serie-expedientes.mjs --anio 2026 --proyecto <id> --verificar
 *   CONFIRMO_ESCRITURA=si node scripts/migracion/abrir-serie-expedientes.mjs \
 *     --anio 2026 --proyecto <id> --ultimo 19 --libro-confirmado-el 2026-08-13 --ejecutar
 *
 * Códigos: 0 ok · 1 uso incorrecto · 2 sin credenciales · 3 falta
 * CONFIRMO_ESCRITURA · 4 proyecto equivocado · 5 --ultimo no coincide ·
 * 6 Firestore no cuadra · 7 la serie YA estaba abierta · 8 fallo de
 * escritura (NO quedó abierta) · 9 error inesperado.
 */
import { readFileSync } from 'node:fs';

/** El LIBRO, versionado y sin PII. El plan de importación es un derivado suyo y está en .gitignore. */
const RUTA_LIBRO_POR_DEFECTO = 'scripts/migracion/datos/consecutivo-licencias-snapshot.sanitizado.json';
const PATRON_NUMERO = /^(\d+)-(\d+)-(\d{2})-(\d+)$/;
/** Días tras los cuales la confirmación con Planeación se considera vieja. */
const DIAS_MAX_CONFIRMACION = 7;

/**
 * Consecutivos que el LIBRO consumió en ese año.
 *
 * Acepta las dos formas del insumo: el SNAPSHOT (`registros[].radicado`, que
 * es el libro tal cual) y el PLAN de importación (`expedientes[]` +
 * `cuarentena[]`). Los de cuarentena importan tanto como los demás: están
 * asentados en papel aunque nunca llegaran a Firestore — mirar solo lo
 * importado daría un máximo MENOR y volvería a abrir la puerta al duplicado.
 */
export function consecutivosDelLibro(fuente, anio) {
  const sufijo = String(anio).slice(-2);
  const consecutivos = new Set();
  const registrar = (numero) => {
    const m = PATRON_NUMERO.exec(numero ?? '');
    if (m && m[3] === sufijo) consecutivos.add(Number(m[4]));
  };
  for (const r of fuente.registros ?? []) registrar(r?.radicado);
  for (const e of fuente.expedientes ?? []) registrar(e?.numeroExpediente?.numero);
  for (const c of fuente.cuarentena ?? []) registrar(c?.radicado ?? c?.numero);
  return consecutivos;
}

/**
 * Con qué valor abrir la serie. Los `huecos` NO son números libres: son
 * asientos del libro que no llegaron a Firestore. Se informan para que
 * nadie los tome por reutilizables — renumerar la serie legal está prohibido.
 */
export function planificarApertura(fuente, anio) {
  const consecutivos = consecutivosDelLibro(fuente, anio);
  if (consecutivos.size === 0) {
    return { anio, hayLibro: false, ultimo: 0, ocupados: 0, huecos: [] };
  }
  const maximo = Math.max(...consecutivos);
  const huecos = [];
  for (let i = 1; i <= maximo; i += 1) if (!consecutivos.has(i)) huecos.push(i);
  return { anio, hayLibro: true, ultimo: maximo, ocupados: consecutivos.size, huecos };
}

/** Días transcurridos entre dos fechas ISO (AAAA-MM-DD), o null si alguna es inválida. */
export function diasDesde(fechaIso, hoyIso) {
  const a = Date.parse(`${fechaIso}T00:00:00Z`);
  const b = Date.parse(`${hoyIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function leerLibro(ruta) {
  const fuente = JSON.parse(readFileSync(ruta, 'utf8'));
  const tieneSnapshot = Array.isArray(fuente.registros);
  const tienePlan = Array.isArray(fuente.expedientes) && Array.isArray(fuente.cuarentena);
  if (!tieneSnapshot && !tienePlan) {
    throw new Error(`"${ruta}" no es ni un snapshot (registros[]) ni un plan (expedientes[]+cuarentena[]).`);
  }
  return fuente;
}

async function conectarFirestore(proyectoEsperado, salir) {
  const { getFirestore } = await import('firebase-admin/firestore');
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return salir(2, 'FIREBASE_SERVICE_ACCOUNT no configurado.');

  const sa = JSON.parse(raw);
  sa.private_key = sa.private_key?.replace(/\\n/g, '\n');
  if (sa.project_id !== proyectoEsperado) {
    return salir(4, [
      `PROYECTO EQUIVOCADO. Se pidió "${proyectoEsperado}" y el service account es de "${sa.project_id}".`,
      'NO se escribió nada. Abrir la serie del proyecto equivocado dejaría el correcto',
      'sin abrir y el otro con una serie que no le toca.',
    ].join('\n'));
  }
  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
  }
  return { db: getFirestore() };
}

/**
 * Contraste contra Firestore. Ignora los expedientes de PRUEBA: la siembra
 * de stage usa el formato legal (`68745-0-26-9001`…) y sin excluirlos el
 * ensayo previo abortaría creyendo que el libro dejó de ser la única fuente.
 */
async function verificarContraFirestore(db, anio) {
  const sufijo = String(anio).slice(-2);
  const snap = await db.collection('expedientes').select('numeroExpediente', 'esPrueba', 'loteVerificacion').get();
  let maximo = 0;
  let delAnio = 0;
  let ignoradosPrueba = 0;
  for (const doc of snap.docs) {
    const d = doc.data() ?? {};
    if (d.esPrueba === true || d.loteVerificacion) { ignoradosPrueba += 1; continue; }
    const m = PATRON_NUMERO.exec(d.numeroExpediente?.numero ?? '');
    if (!m || m[3] !== sufijo) continue;
    delAnio += 1;
    maximo = Math.max(maximo, Number(m[4]));
  }
  return { delAnio, maximo, ignoradosPrueba, totalLeidos: snap.size };
}

async function main() {
  const argv = process.argv.slice(2);
  /** Marca el código de salida y devuelve `null` para cortar el flujo con `return`. */
  const salir = (n, mensaje) => {
    if (mensaje) {
      console.error('══════════════════════════════════════════════════════════════');
      console.error(`⛔ ${mensaje}`);
      console.error('══════════════════════════════════════════════════════════════');
    }
    process.exitCode = n;
    return null;
  };

  // Un flag repetido silenciaría el valor que el operador escribió último —
  // justo el caso que la guarda de `--ultimo` existe para cazar.
  const repetidos = argv.filter((a, i) => a.startsWith('--') && argv.indexOf(a) !== i);
  if (repetidos.length > 0) return salir(1, `Flag repetido: ${[...new Set(repetidos)].join(', ')}. Escribe el comando una sola vez, sin corregir añadiendo al final.`);

  const valor = (flag) => {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    return v === undefined || v.startsWith('--') ? undefined : v;
  };

  const anio = Number(valor('--anio'));
  const proyecto = valor('--proyecto');
  const rutaLibro = valor('--libro') ?? RUTA_LIBRO_POR_DEFECTO;
  const ultimoDeclarado = valor('--ultimo') === undefined ? undefined : Number(valor('--ultimo'));
  const confirmadoEl = valor('--libro-confirmado-el');
  const ejecutar = argv.includes('--ejecutar');
  const soloVerificar = argv.includes('--verificar');
  const permiteAnioFuturo = argv.includes('--anio-futuro');

  if (!Number.isInteger(anio) || anio < 2000) {
    console.error('Uso: node scripts/migracion/abrir-serie-expedientes.mjs --anio <AAAA> --proyecto <id>');
    console.error('       [--libro <ruta>] [--ultimo N] [--libro-confirmado-el AAAA-MM-DD] [--verificar | --ejecutar] [--anio-futuro]');
    return salir(1);
  }
  if (!proyecto) return salir(1, 'Falta --proyecto <id>. Es obligatorio: evita abrir la serie del proyecto equivocado.');

  const anioEnCurso = new Date().getUTCFullYear();
  if (anio < anioEnCurso) {
    return salir(1, [
      `--anio ${anio} es un año CERRADO (en curso: ${anioEnCurso}).`,
      'Abrir la serie de un año pasado no protege de nada y habilita emisiones retroactivas',
      'sobre números del libro. Si de verdad hace falta, es una decisión con ADR, no un flag.',
    ].join('\n'));
  }
  if (anio > anioEnCurso && !permiteAnioFuturo) {
    return salir(1, `--anio ${anio} es futuro. Si es una apertura anticipada deliberada, añade --anio-futuro.`);
  }

  const fuente = leerLibro(rutaLibro);
  const propuesta = planificarApertura(fuente, anio);
  const procedencia = fuente._procedencia ?? {};

  console.log('══════════ Apertura de la serie legal de expedientes (ADR-0031) ══════════');
  console.log(`Año:                ${anio}`);
  console.log(`Proyecto declarado: ${proyecto}`);
  console.log(`Libro (insumo):     ${rutaLibro}`);
  if (procedencia.extraidoEn) console.log(`  extraído el:      ${procedencia.extraidoEn}`);
  console.log('');
  if (!propuesta.hayLibro) {
    console.log('El libro NO tiene números de este año: la serie se abre en 0 y la primera');
    console.log('emisión real será el 0001. Es el caso normal de un año sin histórico.');
  } else {
    console.log(`Consecutivos ocupados en el libro: ${propuesta.ocupados} (máximo ${propuesta.ultimo})`);
    console.log(`→ Abrir en ultimo=${propuesta.ultimo}; la próxima emisión será la ${propuesta.ultimo + 1}.`);
    if (propuesta.huecos.length > 0) {
      console.log('');
      console.log(`⚠ Huecos en el libro: ${propuesta.huecos.join(', ')}`);
      console.log('  NO son números libres: son asientos que no llegaron a Firestore.');
    }
  }
  console.log('');
  console.log('⚠ LÍMITE DEL INSUMO: el Excel de Planeación sigue vivo. Este número refleja');
  console.log('  el snapshot, no necesariamente el libro de hoy. Confírmalo con Planeación.');
  console.log('');

  if (soloVerificar) {
    const conexion = await conectarFirestore(proyecto, salir);
    if (!conexion) return null;
    const ref = conexion.db.doc(`counters/expedientes-${anio}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`counters/expedientes-${anio}: NO EXISTE — la serie NO está abierta.`);
      return salir(1);
    }
    console.log(`counters/expedientes-${anio}: ABIERTA`);
    console.log(JSON.stringify(snap.data(), null, 2));
    return null;
  }

  if (ultimoDeclarado !== undefined && ultimoDeclarado !== propuesta.ultimo) {
    return salir(5, `--ultimo ${ultimoDeclarado} NO coincide con el máximo del libro (${propuesta.ultimo}).\n   O el libro cambió, o hay un error de tecleo: revísalo antes de seguir.`);
  }

  if (!ejecutar) {
    const hoy = new Date().toISOString().slice(0, 10);
    console.log('DRY-RUN (por defecto): NO se escribió nada.');
    console.log('Para ejecutar, tras confirmar el último número con Planeación:');
    console.log(`  CONFIRMO_ESCRITURA=si node scripts/migracion/abrir-serie-expedientes.mjs \\`);
    console.log(`    --anio ${anio} --proyecto ${proyecto} --ultimo ${propuesta.ultimo} --libro-confirmado-el ${hoy} --ejecutar`);
    return null;
  }

  if (process.env.CONFIRMO_ESCRITURA !== 'si') {
    return salir(3, 'REQUIERE AUTORIZACIÓN EXPRESA DEL PROPIETARIO (protocolo).\n   --ejecutar exige CONFIRMO_ESCRITURA=si (exacta). NO se escribió nada.');
  }
  if (ultimoDeclarado === undefined) {
    return salir(1, '--ejecutar exige --ultimo <N> explícito: el valor escrito debe ser una decisión, no un default.');
  }
  if (!confirmadoEl || !/^\d{4}-\d{2}-\d{2}$/.test(confirmadoEl)) {
    return salir(1, [
      '--ejecutar exige --libro-confirmado-el AAAA-MM-DD.',
      'Es la fecha en que alguien CONFIRMÓ con Planeación el último número emitido en papel.',
      'El Excel sigue vivo: ningún código puede comprobar eso, solo una persona.',
    ].join('\n'));
  }
  const antiguedad = diasDesde(confirmadoEl, new Date().toISOString().slice(0, 10));
  if (antiguedad === null || antiguedad < 0) return salir(1, `--libro-confirmado-el ${confirmadoEl} no es una fecha válida o está en el futuro.`);
  if (antiguedad > DIAS_MAX_CONFIRMACION) {
    return salir(1, `La confirmación con Planeación es de hace ${antiguedad} días (máximo ${DIAS_MAX_CONFIRMACION}). Vuelve a confirmar el último número antes de escribir.`);
  }

  const conexion = await conectarFirestore(proyecto, salir);
  if (!conexion) return null;
  const { db } = conexion;

  const contraste = await verificarContraFirestore(db, anio);
  console.log(`Contraste contra Firestore: ${contraste.totalLeidos} leídos · ${contraste.delAnio} del año ${anio} · máximo ${contraste.maximo} · ${contraste.ignoradosPrueba} de prueba ignorados.`);

  // FAIL-CLOSED en las dos direcciones: por encima del libro significa que
  // el libro dejó de ser la única fuente; cero cuando el libro sí tiene
  // números significa que estamos apuntando a la base equivocada.
  if (contraste.maximo > propuesta.ultimo) {
    return salir(6, `Firestore ya tiene el consecutivo ${contraste.maximo}, POR ENCIMA del máximo del libro (${propuesta.ultimo}).\n   Alguien emitió o importó después. El valor debe recalcularse a mano.`);
  }
  if (propuesta.hayLibro && contraste.delAnio === 0) {
    return salir(6, `El libro dice que ${anio} tiene ${propuesta.ocupados} expediente(s), pero Firestore no muestra NINGUNO.\n   Probablemente es la base equivocada, o la importación no está donde se cree. NO se escribió nada.`);
  }

  const ahora = new Date().toISOString();
  /* EL REGISTRO VA ANIDADO BAJO `apertura`, Y CON ESAS GRAFÍAS EXACTAS.
     No es una preferencia de estilo: `verificarCoherenciaConApertura`
     (lib/server/consecutivo-legal.ts) y el cron de auditoría de los lunes
     leen `counters/{serie}-{año}.apertura.abiertoEn`, un NÚMERO. Este script
     escribía `abiertaEn` (una fecha) aplanado en la raíz, así que ambos
     verificadores recibían `undefined` y salían por su primera línea: el
     guard quedaba INERTE justo en `expedientes`, la única serie que exige
     apertura explícita y la única con un libro de papel detrás.

     Es la regla del ADR-0033 §4.6 otra vez — el instrumento que vigila no
     puede filtrar por el campo que falta en el caso que más importa — y
     además había DOS abridores incompatibles del mismo documento
     (`scripts/operacion/abrir-series.mjs` sí lo escribía bien).
     `__tests__/apertura-forma-unica.test.ts` impide que vuelvan a divergir. */
  const marca = {
    ultimo: propuesta.ultimo,
    anio,
    actualizadoEn: ahora,
    apertura: {
      veniaDe: 0,
      abiertoEn: propuesta.ultimo + 1,
      fecha: ahora,
      autorizadoPor: 'scripts/migracion/abrir-serie-expedientes.mjs',
      referencia: `Libro de Planeación confirmado el ${confirmadoEl}`,
      motivoDelSalto: `Apertura explícita de la serie ${anio} (ADR-0031). Último consecutivo del libro de Planeación: ${propuesta.ultimo}, confirmado el ${confirmadoEl}.`,
      libroConfirmadoEl: confirmadoEl,
    },
  };

  const ref = db.doc(`counters/expedientes-${anio}`);
  try {
    // `create`, NUNCA `set`: si el contador ya existe, falla. Pisar una serie
    // abierta podría RETROCEDER el consecutivo y duplicar lo ya emitido.
    //
    // Sobre el guard D9 (`verificarAvanceCounter`): no se invoca porque vive
    // en TypeScript y esto es `.mjs`, pero sobre todo porque valida el AVANCE
    // de una serie viva y esto es la APERTURA de una inexistente (ADR-0031
    // §Relación con el guard D9). Sus invariantes se cumplen igual, y
    // `create` es más estricto que la monotonicidad que el guard comprueba.
    await ref.create(marca);
  } catch (error) {
    // ALREADY_EXISTS (gRPC 6) es un desenlace ESPERADO y benigno. Cualquier
    // otro fallo —permisos, red, timeout— significa que la serie NO quedó
    // abierta, y confundirlos haría que el operador guardara como evidencia
    // de éxito lo que fue un fallo de escritura.
    const yaExistia = error?.code === 6 || /already.?exists/i.test(error?.message ?? '');
    if (yaExistia) {
      return salir(7, `counters/expedientes-${anio} YA EXISTE: la serie ya estaba abierta y no debe tocarse desde aquí.\n   Usa --verificar para ver su contenido.`);
    }
    return salir(8, `FALLO AL ESCRIBIR — la serie NO quedó abierta: ${error?.message ?? error}\n   Revisa permisos y red. Nada cambió.`);
  }

  const verificacion = await ref.get();
  console.log('');
  console.log('✔ Serie abierta. Evidencia:');
  console.log(JSON.stringify({ path: ref.path, escrito: marca, leidoDeVuelta: verificacion.data() }, null, 2));
  return null;
}

if (process.argv[1] && process.argv[1].endsWith('abrir-serie-expedientes.mjs')) {
  main()
    // `process.exitCode` en vez de `process.exit`: con la salida redirigida a
    // un archivo o tubería —que es lo que pide el procedimiento— stdout es
    // asíncrono y `process.exit` truncaría la evidencia.
    .catch((error) => {
      console.error(`[abrir-serie] fallo inesperado — NO se escribió nada: ${error?.stack ?? error}`);
      process.exitCode = 9;
    });
}
