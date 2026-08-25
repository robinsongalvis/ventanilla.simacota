/**
 * scripts/laboratorio/presupuesto-rendimiento.mjs
 *
 * PRESUPUESTO DE RENDIMIENTO — control de regresión de escala (ADR-0011, 2B).
 *
 * Cierra R11 por el lado del CONTROL: falla el pipeline si una consulta a nivel
 * de colección sobre `ventanilla_radicados` lee SIN COTA (sin `limit()`/cursor)
 * en una superficie que debe estar acotada, o si aparece una lectura ilimitada
 * nueva sin clasificar. Es el guardarraíl que impide que una consulta *vuelva*
 * a leer O(N) tras la acotación de 2A (ADR-0010).
 *
 * MECANISMO (preferido por ADR-0011: estático, determinista, mutación-probable):
 *   Análisis estático de fuentes en `app/` y `lib/`. NO requiere emulador
 *   (Java 8 local no lo corre — CI es la compuerta) ni servidor. Es el mismo
 *   estándar de control automatizado que la matriz de aislamiento P-B.
 *
 * QUÉ CUENTA COMO "LECTURA DE COLECCIÓN" (lo que R11 ataca):
 *   - Admin SDK:  `db.collection('ventanilla_radicados')…get()/stream()`
 *   - Client SDK: `query(collection(db,'ventanilla_radicados'), …)` + onSnapshot/getDocs
 *   Se EXCLUYEN por diseño (son O(1), no O(N)):
 *   - `.doc('ventanilla_radicados/…')` / `.collection('ventanilla_radicados').doc(id)`
 *     → lectura de UN documento.
 *   - Subcolección `ventanilla_radicados/{id}/trazabilidad` → acotada por radicado.
 *
 * ACOTAMIENTO: una lectura está acotada si en su ventana de construcción aparece
 *   `limit(` (o cursor `startAfter(`/`startAt(`). Es la señal binaria que atrapa
 *   la mutación primaria (quitar el `limit`). Además, cada superficie ACOTADA
 *   declara su cota numérica esperada (`cotaRegex` + `cotaMax`), de modo que
 *   subir la cota por encima del presupuesto también rompe el control.
 *
 * UMBRAL / PRESUPUESTO (justificación, derivado de la línea base + 2A):
 *   - Línea base O(N) medida: 210 docs/consulta, p95 824 ms, SIN cota
 *     (`docs/auditorias/rendimiento-base-lectura.md`) — el problema a impedir.
 *   - Meta 2A (ADR-0010): lecturas ≤ pageSize (25/50/100) + ventana; el stream
 *     operativo se acota con tope duro `limit(500)` (`useVentanillaRadicados`).
 *   → PRESUPUESTO_INTERACTIVO_DOCS = 500: ninguna lectura INTERACTIVA (stream,
 *     búsqueda) puede declarar una cota mayor. Las lecturas BATCH/segundo plano
 *     (reportes, cron, métricas) admiten hasta TECHO_BATCH_DOCS = 1000, que es
 *     N-independiente igual (no crece con el histórico) — es cota, no O(N).
 *
 * SALIDA: exit 0 dentro de presupuesto (imprime inventario + advertencias);
 *         exit 1 ante cualquier VIOLACIÓN (con reporte accionable).
 *
 * ── AMPLIACIÓN (Roadmap P1.5) — cierre del falso verde de `useSalidas` ──
 * El mecanismo original SOLO barre lecturas de `ventanilla_radicados`. Un
 * `onSnapshot` sin cota sobre OTRA colección (p. ej. `ventanilla_salidas` en
 * `lib/hooks/useSalidas.ts`, hallado en la auditoría P1.5: mismo antipatrón
 * O(N) que R11 pero fuera del radar de este gate) pasaba en VERDE. Se añade
 * un SEGUNDO mecanismo, independiente del primero, enfocado en la superficie
 * de mayor riesgo de este antipatrón — suscripciones en tiempo real de hooks
 * de cliente (`lib/hooks/**`) — sobre CUALQUIER colección:
 *   - Descubre cada `onSnapshot(` en `lib/hooks/**`.
 *   - Identifica la colección asociada (el `collection(...)` literal más
 *     cercano hacia atrás, dentro de la misma ventana de líneas).
 *   - Está ACOTADA si en su ventana de construcción aparece `limit(` (o
 *     cursor `startAfter(`/`startAt(`) — misma señal binaria que el
 *     mecanismo original.
 *   - Toda suscripción descubierta debe estar clasificada en
 *     `REGISTRO_HOOKS` (ACOTADA o DEUDA_DECLARADA) — misma filosofía de
 *     deuda declarada: lo no clasificado bloquea el pipeline.
 * No sustituye el mecanismo de `REGISTRO` (que sigue siendo la fuente de
 * verdad para `ventanilla_radicados`, incluyendo lecturas Admin SDK y
 * `getDocs` fuera de hooks) — lo complementa cerrando el hueco de
 * descubrimiento en `onSnapshot` de hooks para colecciones distintas.
 *
 * Uso:
 *   node scripts/laboratorio/presupuesto-rendimiento.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(process.cwd());
const DIRS_ESCANEO = ['app', 'lib'];
/**
 * Colecciones vigiladas por el mecanismo REGISTRO (lecturas de nivel
 * colección vía Admin/Client SDK). Bloque de endurecimiento pre-reunión
 * (hallazgo QA, ago-2026): el gate original solo vigilaba
 * `ventanilla_radicados`; `expedientes` (motor de licencias, Bloque A) tiene
 * el MISMO riesgo O(N) — bandeja sin `.limit()` — y quedaba fuera del radar.
 * Se añade aquí como una entrada más de este arreglo, no como mecanismo
 * aparte: el patrón de vigilancia (Admin `.collection('x')…get()` / Client
 * `collection(db,'x')`) es idéntico para cualquier colección, solo cambia
 * el nombre literal. Sumar una tercera colección en el futuro es agregar un
 * string aquí, no duplicar el mecanismo.
 */
const COLECCIONES_VIGILADAS = ['ventanilla_radicados', 'expedientes'];
const VENTANA_LINEAS = 20; // líneas alrededor del ref donde buscar la cota

/** Presupuesto (derivado de la línea base + 2A — ver encabezado). */
const PRESUPUESTO_INTERACTIVO_DOCS = 500;
const TECHO_BATCH_DOCS = 1000;

/**
 * REGISTRO — inventario clasificado de lecturas de colección de radicados.
 * Fuente de verdad revisable. Toda lectura de colección descubierta debe estar
 * aquí; una lectura no registrada rompe el control (fuerza clasificación
 * consciente en revisión cruzada).
 *
 * estado:
 *   ACOTADA          — debe llevar cota; el control FALLA si la pierde (mutación).
 *   DEUDA_DECLARADA  — O(N) explícitamente diferida (ADR-0010 §Deuda); permitida,
 *                      pero congelada: una lectura sin cota NUEVA no puede colarse.
 *   PENDIENTE_2A     — R11 core aún sin cursor; NO bloquea (para dar línea base
 *                      verde y evidencia de mutación limpia), pero se reporta
 *                      de forma prominente y su conjunto está congelado. Al
 *                      aterrizar 2A se promueve a ACOTADA y queda enforcada.
 * clase: INTERACTIVA (cota ≤ 500) | BATCH (cota ≤ 1000).
 */
const REGISTRO = [
  {
    archivo: 'lib/hooks/useVentanillaRadicados.ts',
    estado: 'ACOTADA',
    clase: 'INTERACTIVA',
    descripcion: 'Stream operativo de la bandeja (onSnapshot, ventana 180d + tope duro).',
    cotaRegex: /const LIMITE_DOCUMENTOS_STREAM\s*=\s*(\d+)/,
    cotaMax: 500,
    ref: 'ADR-0010 §2 (2A) · stream acotado',
  },
  {
    archivo: 'app/api/interno/resumen-diario/route.ts',
    estado: 'ACOTADA',
    clase: 'INTERACTIVA',
    descripcion: 'Resumen diario del panel (radicados activos).',
    cotaRegex: /\.limit\(\s*(\d+)\s*\)/,
    cotaMax: 250,
    ref: 'ACOTADA de origen',
  },
  {
    archivo: 'app/api/simi/reportes/route.ts',
    estado: 'ACOTADA',
    clase: 'BATCH',
    descripcion: 'Reporte SIMI de vencimientos (CSV).',
    cotaRegex: /\.limit\(\s*(\d+)\s*\)/,
    cotaMax: 500,
    ref: 'ACOTADA de origen',
  },
  {
    archivo: 'lib/server/planillas-security.ts',
    estado: 'ACOTADA',
    clase: 'INTERACTIVA',
    descripcion: 'Pendientes de reparto (planilla del día).',
    cotaRegex: /\.limit\(\s*(\d+)\s*\)/,
    cotaMax: 500,
    ref: 'ACOTADA de origen',
  },
  {
    archivo: 'lib/simi-juridico/predictDeadlineAlerts.ts',
    estado: 'ACOTADA',
    clase: 'BATCH',
    descripcion: 'Alertas predictivas de vencimiento (radicados activos).',
    cotaRegex: /\.limit\(\s*(\d+)\s*\)/,
    cotaMax: 500,
    ref: 'ACOTADA de origen',
  },
  {
    archivo: 'lib/simi-juridico/calculateControlInternoMetrics.ts',
    estado: 'ACOTADA',
    clase: 'BATCH',
    descripcion: 'Métricas de Control Interno (lote de segundo plano).',
    cotaRegex: /\.limit\(\s*(\d+)\s*\)/,
    cotaMax: 1000,
    ref: 'ACOTADA de origen (lote)',
  },
  {
    archivo: 'app/api/radicados/busqueda-avanzada/route.ts',
    estado: 'ACOTADA',
    clase: 'INTERACTIVA',
    descripcion: 'Búsqueda Histórica Avanzada — NÚCLEO de R11, RESUELTO. Escaneo por '
      + 'lotes con cursor (limit+startAfter), techo duro MAX_DOCS_ESCANEADOS '
      + 'independiente de N; reemplaza la lectura incondicional de toda la colección.',
    cotaRegex: /const MAX_DOCS_ESCANEADOS\s*=\s*(\d+)/,
    cotaMax: 500,
    ref: 'ADR-0010 §2.1 · R11 RESUELTO',
  },
  {
    archivo: 'app/api/licencias/radicados-candidatos/route.ts',
    estado: 'ACOTADA',
    clase: 'INTERACTIVA',
    descripcion: 'Selector de radicados candidatos al handoff radicado⇄expediente '
      + '(Bloque A·A4): where por oficinaDestino + limit duro; orden en memoria '
      + 'sobre el lote acotado (sin orderBy para no exigir índice compuesto).',
    cotaRegex: /const LIMITE_CANDIDATOS\s*=\s*(\d+)/,
    cotaMax: 500,
    ref: 'ADR-0011 · Bloque A·A4 (handoff D2)',
  },
  {
    archivo: 'app/api/licencias/expedientes/route.ts',
    estado: 'ACOTADA',
    clase: 'INTERACTIVA',
    descripcion: 'Bandeja de expedientes de licencias del tenant de Planeación: '
      + 'where por tenantId + limit duro; orden en memoria sobre el lote acotado '
      + '(sin orderBy para no exigir el índice compuesto aún no desplegado). '
      + 'Hallazgo QA endurecimiento pre-reunión (ago-2026): la colección '
      + '`expedientes` estaba fuera del radar del gate — COLECCIONES_VIGILADAS '
      + 'se amplió para cubrirla.',
    cotaRegex: /const LIMITE_BANDEJA\s*=\s*(\d+)/,
    cotaMax: 500,
    ref: 'ADR-0011 · endurecimiento pre-reunión (hallazgo QA)',
  },
  {
    archivo: 'app/api/reportes/mipg/excel/route.ts',
    estado: 'DEUDA_DECLARADA',
    clase: 'BATCH',
    descripcion: 'Export MIPG (Excel bajo demanda). Volumen acotado por naturaleza del reporte.',
    ref: 'ADR-0010 §Deuda · PLAN_OLA2 §Deuda #3',
  },
  {
    archivo: 'app/api/ai/copilot/route.ts',
    estado: 'DEUDA_DECLARADA',
    clase: 'BATCH',
    descripcion: 'Contexto del copiloto IA. Contexto limitado por diseño.',
    ref: 'ADR-0010 §Deuda · PLAN_OLA2 §Deuda #3',
  },
  {
    archivo: 'app/api/cron/vencimientos-licencias/route.ts',
    estado: 'ACOTADA',
    clase: 'BATCH',
    descripcion: 'Vigía del término de 45 días hábiles de licencias (Decreto 1077). Lee '
      + 'la colección `expedientes` con techo duro de 1000 documentos y clasifica cada uno '
      + 'en corriendo / suspendido / sin anclar / resuelto. La cota es NUMÉRICA y no por '
      + 'consulta a propósito: el vigía debe ver TODOS los expedientes vivos, incluidos los '
      + 'que NO tienen fecha de vencimiento — filtrar por rango de fecha excluiría justo el '
      + 'caso que este cron existe para detectar (expediente sin término anclado). El volumen '
      + 'esperado es de decenas por año (~45 licencias/año según el consecutivo real de '
      + 'Planeación), muy por debajo del techo.',
    ref: 'ADR-0011 2B · ADR-0033 §4.5 · auditoría del módulo de Licencias (punto D7)',
  },
  {
    archivo: 'app/api/cron/alertas-vencimiento/route.ts',
    estado: 'ACOTADA',
    clase: 'BATCH',
    descripcion: 'Cron de alertas de vencimiento (sin contexto de tenant). DEUDA SALDADA '
      + '(Roadmap P1.4): antes leía toda la colección y filtraba en memoria (HALLAZGO 2B). '
      + 'Ahora consulta acotada por estado activo + rango de fecha de vencimiento '
      + '(where estadoActual in + where termino.fechaVencimiento <= cota + orderBy), más '
      + 'techo duro TECHO_LECTURA_CRON como defensa en profundidad.',
    cotaRegex: /const TECHO_LECTURA_CRON\s*=\s*(\d+)/,
    cotaMax: 1000,
    ref: 'Roadmap P1.4 · antes HALLAZGO 2B (fuera de ADR-0010 §Deuda)',
  },
  {
    archivo: 'app/api/cron/desistimiento-tacito/route.ts',
    estado: 'ACOTADA',
    clase: 'BATCH',
    descripcion: 'Cron de desistimiento tácito C1 (diario, sin contexto de tenant). DEUDA '
      + 'SALDADA (Roadmap P1.4): antes leía toda la colección y filtraba en memoria por '
      + 'EN_SUBSANACION (detectado en el gate R11 del PR-3, stack H3). Ahora consulta '
      + 'acotada por where(estadoActual==EN_SUBSANACION) + techo duro TECHO_LECTURA_CRON.',
    cotaRegex: /const TECHO_LECTURA_CRON\s*=\s*(\d+)/,
    cotaMax: 1000,
    ref: 'Roadmap P1.4 · antes Gate R11 en PR-3 (2026-07-14)',
  },
];

/**
 * REGISTRO_HOOKS — inventario clasificado de suscripciones `onSnapshot` en
 * `lib/hooks/**`, sobre CUALQUIER colección (ver "AMPLIACIÓN" en el
 * encabezado). Clave de entrada: (archivo, colección) — un mismo archivo
 * podría en teoría suscribirse a más de una colección; se clasifica cada
 * combinación por separado para no ocultar una nueva sin cota detrás de una
 * ya acotada del mismo archivo.
 *
 * estado:
 *   ACOTADA          — debe llevar `limit()`/cursor; el control FALLA si lo pierde.
 *   DEUDA_DECLARADA  — sin cota, explícitamente diferida y justificada; permitida
 *                      pero congelada (una pérdida de cota en otra suscripción
 *                      nueva del mismo hook no se cuela detrás de esta entrada).
 */
export const REGISTRO_HOOKS = [
  {
    archivo: 'lib/hooks/useVentanillaRadicados.ts',
    coleccion: 'ventanilla_radicados',
    estado: 'ACOTADA',
    descripcion: 'Stream operativo de la bandeja (ventana 180d + limit 500). Ya cubierta '
      + 'también por el REGISTRO de ventanilla_radicados arriba; se repite aquí para que '
      + 'el mecanismo de hooks tenga cobertura completa por sí mismo.',
    ref: 'ADR-0010 §2 (2A) · stream acotado',
  },
  {
    archivo: 'lib/hooks/useSalidas.ts',
    coleccion: 'ventanilla_salidas',
    estado: 'ACOTADA',
    descripcion: 'Libro de salidas (Roadmap P1.5). DEUDA SALDADA: antes onSnapshot + '
      + 'orderBy(fechaSalida) SIN limit/ventana — mismo antipatrón O(N) de R11, fuera del '
      + 'radar del REGISTRO original por ser otra colección. Ahora ventana '
      + 'VENTANA_DIAS_STREAM_SALIDAS (180d) + limit(LIMITE_DOCUMENTOS_STREAM_SALIDAS=500), '
      + 'mismo patrón que useVentanillaRadicados.',
    ref: 'Roadmap P1.5 · antes falso verde del gate original',
  },
  {
    archivo: 'lib/hooks/useRadicados.ts',
    coleccion: 'radicados',
    estado: 'DEUDA_DECLARADA',
    descripcion: 'onSnapshot SIN limit/ventana sobre la colección legacy "radicados" '
      + '(distinta de ventanilla_radicados). Verificado por búsqueda en todo el repo: sin '
      + 'ningún import activo fuera de esta propia definición (solo una mención en '
      + 'comentario de src/types/firestore-schema.ts) — código muerto. Fuera del alcance de '
      + 'este incremento (P1.5 solo pidió acotar useSalidas); se declara para no bloquear '
      + 'el gate sin ocultar el hallazgo. Seguimiento propuesto: eliminar el hook muerto o '
      + 'acotarlo si se reactiva su uso.',
    ref: 'Roadmap P1.5 · hallazgo colateral, seguimiento aparte',
  },
];

// ─────────────────────────── escaneo ───────────────────────────

/** Recorre recursivamente un dir devolviendo rutas .ts/.tsx (sin tests). */
function listarFuentes(dir) {
  const out = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entradas) {
    const ruta = join(dir, e);
    const st = statSync(ruta);
    if (st.isDirectory()) {
      if (e === 'node_modules' || e === '__tests__' || e === '.next') continue;
      out.push(...listarFuentes(ruta));
    } else if (/\.tsx?$/.test(e) && !/\.(test|spec)\.tsx?$/.test(e)) {
      out.push(ruta);
    }
  }
  return out;
}

// Alternativa de nombres literales vigilados — ver COLECCIONES_VIGILADAS.
const ALTERNATIVA_COLECCIONES = COLECCIONES_VIGILADAS.join('|');
// Admin: `.collection('ventanilla_radicados'|'expedientes')` NO seguido de `.doc(`.
const RE_ADMIN = new RegExp(`\\.collection\\(\\s*['"](${ALTERNATIVA_COLECCIONES})['"]\\s*\\)(?!\\s*\\.doc\\()`);
// Client: `collection(<handle>, 'ventanilla_radicados'|'expedientes')` (nombre = último arg).
const RE_CLIENT = new RegExp(`[^.\\w]collection\\(\\s*[^,]+,\\s*['"](${ALTERNATIVA_COLECCIONES})['"]\\s*\\)`);
const RE_COTA = /(?:^|[^.\w])limit\(|\.limit\(|startAfter\(|startAt\(/;

/** Encuentra las lecturas de colección (list-read) en un archivo, para cualquiera de las COLECCIONES_VIGILADAS. */
function detectarLecturas(rutaAbs, rel) {
  const contenido = readFileSync(rutaAbs, 'utf8');
  const lineas = contenido.split('\n');
  const lecturas = [];
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    const mAdmin = linea.match(RE_ADMIN);
    const mClient = linea.match(RE_CLIENT);
    const m = mAdmin || mClient;
    if (!m) continue;
    const coleccion = m[1];

    const desde = Math.max(0, i - VENTANA_LINEAS);
    const hasta = Math.min(lineas.length, i + VENTANA_LINEAS + 1);
    const ventana = lineas.slice(desde, hasta).join('\n');
    const acotada = RE_COTA.test(ventana);
    lecturas.push({ archivo: rel, linea: i + 1, acotada, coleccion });
  }
  return lecturas;
}

// ───────────────── descubrimiento: onSnapshot en lib/hooks/** ─────────────────

const DIR_HOOKS = join(RAIZ, 'lib', 'hooks');
/** Ventana hacia atrás para asociar un `onSnapshot` con su `limit()`/cursor y
 * su `collection(...)`: las suscripciones de este repo construyen las
 * constraints (where/orderBy/limit) en un arreglo ANTES de `query(...)`, así
 * que la cota puede quedar más arriba que la propia línea de `collection(`.
 * 60 líneas cubre con margen el patrón real (useVentanillaRadicados/useSalidas
 * usan <40 líneas entre el inicio del useEffect y el onSnapshot). */
const VENTANA_LINEAS_ONSNAPSHOT = 60;
const RE_ONSNAPSHOT = /onSnapshot\(/;
// Cliente: `collection(<handle>, 'nombre')`.
const RE_COLECCION_CLIENTE_GENERICA = /collection\(\s*[^,]+,\s*['"]([^'"]+)['"]\s*\)/;
// Admin (por si algún hook lo usara): `.collection('nombre')`.
const RE_COLECCION_ADMIN_GENERICA = /\.collection\(\s*['"]([^'"]+)['"]\s*\)/;

/**
 * PURA. Encuentra las suscripciones `onSnapshot` en el contenido (string) de
 * un archivo bajo `lib/hooks/**`, con la colección asociada (si se puede
 * resolver a un literal) y si están acotadas (limit/cursor) en su ventana de
 * construcción. Exportada para probarla sin tocar el filesystem — mismo
 * patrón que `verificar-indices.mjs`.
 */
export function detectarSuscripcionesOnSnapshotEnContenido(contenido, rel) {
  const lineas = contenido.split('\n');
  const hallazgos = [];
  for (let i = 0; i < lineas.length; i += 1) {
    if (!RE_ONSNAPSHOT.test(lineas[i])) continue;

    const desde = Math.max(0, i - VENTANA_LINEAS_ONSNAPSHOT);
    const hasta = Math.min(lineas.length, i + 3);
    const ventana = lineas.slice(desde, hasta).join('\n');
    const acotada = RE_COTA.test(ventana);

    // Colección asociada: el `collection(...)` literal más cercano, buscando
    // hacia atrás desde la propia línea de onSnapshot.
    let coleccion = null;
    for (let j = i; j >= desde; j -= 1) {
      const m = lineas[j].match(RE_COLECCION_CLIENTE_GENERICA) || lineas[j].match(RE_COLECCION_ADMIN_GENERICA);
      if (m) { coleccion = m[1]; break; }
    }

    hallazgos.push({ archivo: rel, linea: i + 1, coleccion, acotada });
  }
  return hallazgos;
}

/** Envoltorio de I/O: lee el archivo y delega en la función pura. */
function detectarSuscripcionesOnSnapshot(rutaAbs, rel) {
  return detectarSuscripcionesOnSnapshotEnContenido(readFileSync(rutaAbs, 'utf8'), rel);
}

/** Clave de agrupación: archivo + colección (colección `null` si no se pudo resolver a literal). */
export const claveHook = (archivo, coleccion) => `${archivo}::${coleccion ?? '(colección dinámica)'}`;

// ─────────────────────────── validación + reporte (I/O) ───────────────────────────

async function main() {
  const violaciones = [];
  const advertencias = [];

  // 1. Descubrir todas las lecturas de colección.
  const descubiertas = [];
  for (const dir of DIRS_ESCANEO) {
    for (const rutaAbs of listarFuentes(join(RAIZ, dir))) {
      const rel = rutaAbs.slice(RAIZ.length + 1);
      descubiertas.push(...detectarLecturas(rutaAbs, rel));
    }
  }

  const porArchivo = new Map();
  for (const l of descubiertas) {
    if (!porArchivo.has(l.archivo)) porArchivo.set(l.archivo, []);
    porArchivo.get(l.archivo).push(l);
  }
  const registroPorArchivo = new Map(REGISTRO.map((r) => [r.archivo, r]));

  // 2. Toda superficie descubierta debe estar registrada y cumplir su estado.
  for (const [archivo, lecturas] of porArchivo) {
    const reg = registroPorArchivo.get(archivo);
    const algunaSinCota = lecturas.some((l) => !l.acotada);

    const colecciones = [...new Set(lecturas.map((l) => l.coleccion))].join("', '");

    if (!reg) {
      violaciones.push(
        `SUPERFICIE NO REGISTRADA: ${archivo} (líneas ${lecturas.map((l) => l.linea).join(', ')}) `
        + `lee la colección '${colecciones}'${algunaSinCota ? ' SIN COTA' : ''}. `
        + `Clasifícala en el REGISTRO de scripts/laboratorio/presupuesto-rendimiento.mjs.`,
      );
      continue;
    }

    if (reg.estado === 'ACOTADA') {
      if (algunaSinCota) {
        violaciones.push(
          `PRESUPUESTO EXCEDIDO (regresión O(N)): ${archivo} declarada ACOTADA pero una lectura de `
          + `'${colecciones}' perdió su cota (líneas ${lecturas.filter((l) => !l.acotada).map((l) => l.linea).join(', ')}). `
          + `Restablece limit()/cursor.`,
        );
      }
      // Verificación de la cota numérica declarada.
      const contenido = readFileSync(join(RAIZ, archivo), 'utf8');
      const m = contenido.match(reg.cotaRegex);
      if (!m) {
        violaciones.push(
          `PRESUPUESTO: ${archivo} ACOTADA pero no se pudo verificar la cota declarada `
          + `(${reg.cotaRegex}). ¿Cambió la forma de la cota? Actualiza el REGISTRO.`,
        );
      } else {
        const valor = Number(m[1]);
        const techo = reg.clase === 'INTERACTIVA' ? PRESUPUESTO_INTERACTIVO_DOCS : TECHO_BATCH_DOCS;
        if (valor > reg.cotaMax || valor > techo) {
          violaciones.push(
            `PRESUPUESTO EXCEDIDO: ${archivo} declara cota ${valor} > permitido `
            + `(cotaMax ${reg.cotaMax}, techo ${reg.clase} ${techo}).`,
          );
        }
      }
    } else if (reg.estado === 'PENDIENTE_2A') {
      if (algunaSinCota) {
        advertencias.push(
          `PENDIENTE 2A (R11 ABIERTO): ${archivo} — ${reg.descripcion} [${reg.ref}]. `
          + `El control NO lo bloquea aún; promuévelo a ACOTADA cuando 2A aterrice el cursor.`,
        );
      } else {
        advertencias.push(
          `2A ATERRIZÓ: ${archivo} ya está acotada. Promuévela de PENDIENTE_2A a ACOTADA en el REGISTRO `
          + `para enforzar la regresión de forma permanente.`,
        );
      }
    } else if (reg.estado === 'DEUDA_DECLARADA') {
      if (!algunaSinCota) {
        advertencias.push(
          `DEUDA SALDADA: ${archivo} ya está acotada. Reclasifícala como ACOTADA en el REGISTRO.`,
        );
      }
      // Deuda explícita: permitida, no viola.
    }
  }

  // 3. Entradas del registro que ya no se descubren (higiene del registro).
  for (const reg of REGISTRO) {
    if (!porArchivo.has(reg.archivo)) {
      advertencias.push(
        `REGISTRO OBSOLETO: ${reg.archivo} (${reg.estado}) ya no contiene una lectura de ninguna `
        + `de las colecciones vigiladas (${COLECCIONES_VIGILADAS.join(', ')}). Elimínala del REGISTRO.`,
      );
    }
  }

  // 4. Segundo mecanismo (Roadmap P1.5): onSnapshot de lib/hooks/**, cualquier
  //    colección — ver "AMPLIACIÓN" en el encabezado del archivo.
  const descubiertasHooks = [];
  for (const rutaAbs of listarFuentes(DIR_HOOKS)) {
    const rel = rutaAbs.slice(RAIZ.length + 1);
    descubiertasHooks.push(...detectarSuscripcionesOnSnapshot(rutaAbs, rel));
  }

  const porClaveHook = new Map();
  for (const h of descubiertasHooks) {
    const clave = claveHook(h.archivo, h.coleccion);
    if (!porClaveHook.has(clave)) porClaveHook.set(clave, []);
    porClaveHook.get(clave).push(h);
  }
  const registroHooksPorClave = new Map(
    REGISTRO_HOOKS.map((r) => [claveHook(r.archivo, r.coleccion), r]),
  );

  for (const [clave, hallazgos] of porClaveHook) {
    const reg = registroHooksPorClave.get(clave);
    const algunaSinCota = hallazgos.some((h) => !h.acotada);
    const lineas = hallazgos.map((h) => h.linea).join(', ');

    if (!reg) {
      violaciones.push(
        `SUSCRIPCIÓN onSnapshot NO REGISTRADA (hooks): ${clave} (líneas ${lineas})`
        + `${algunaSinCota ? ' SIN COTA (limit/cursor)' : ''}. `
        + `Clasifícala en REGISTRO_HOOKS de scripts/laboratorio/presupuesto-rendimiento.mjs.`,
      );
      continue;
    }

    if (reg.estado === 'ACOTADA' && algunaSinCota) {
      violaciones.push(
        `PRESUPUESTO EXCEDIDO (hooks, regresión O(N)): ${reg.archivo} declarada ACOTADA para `
        + `'${reg.coleccion}' pero su onSnapshot perdió la cota (líneas `
        + `${hallazgos.filter((h) => !h.acotada).map((h) => h.linea).join(', ')}). Restablece limit()/cursor.`,
      );
    } else if (reg.estado === 'DEUDA_DECLARADA' && !algunaSinCota) {
      advertencias.push(
        `DEUDA SALDADA (hooks): ${reg.archivo} ('${reg.coleccion}') ya está acotada. `
        + `Reclasifícala como ACOTADA en REGISTRO_HOOKS.`,
      );
    }
  }

  // Higiene de REGISTRO_HOOKS: entradas que ya no se descubren.
  for (const reg of REGISTRO_HOOKS) {
    if (!porClaveHook.has(claveHook(reg.archivo, reg.coleccion))) {
      advertencias.push(
        `REGISTRO_HOOKS OBSOLETO: ${reg.archivo} ('${reg.coleccion}') ya no tiene una suscripción `
        + `onSnapshot detectada. Elimínala de REGISTRO_HOOKS.`,
      );
    }
  }

  // ─────────────────────────── reporte ───────────────────────────

  console.log('\n══════════ PRESUPUESTO DE RENDIMIENTO — lectura de radicados (ADR-0011, 2B) ══════════');
  console.log(`Presupuesto INTERACTIVO: ≤ ${PRESUPUESTO_INTERACTIVO_DOCS} docs/consulta · Techo BATCH: ≤ ${TECHO_BATCH_DOCS} docs`);
  console.log(`Superficies de lectura de colección descubiertas: ${porArchivo.size}\n`);

  const orden = { ACOTADA: 0, PENDIENTE_2A: 1, DEUDA_DECLARADA: 2 };
  for (const reg of [...REGISTRO].sort((a, b) => orden[a.estado] - orden[b.estado])) {
    const lecturas = porArchivo.get(reg.archivo) || [];
    const cota = lecturas.length ? (lecturas.every((l) => l.acotada) ? 'ACOTADA' : 'SIN-COTA') : '—';
    const marca = reg.estado === 'ACOTADA' ? '✔' : reg.estado === 'PENDIENTE_2A' ? '⚠' : '·';
    console.log(`  ${marca} [${reg.estado}/${reg.clase}] ${reg.archivo} → ${cota}`);
  }

  console.log(`\n── onSnapshot en lib/hooks/** (cualquier colección, Roadmap P1.5) — ${porClaveHook.size} suscripción(es) ──`);
  for (const reg of [...REGISTRO_HOOKS].sort((a, b) => orden[a.estado] - orden[b.estado])) {
    const hallazgos = porClaveHook.get(claveHook(reg.archivo, reg.coleccion)) || [];
    const cota = hallazgos.length ? (hallazgos.every((h) => h.acotada) ? 'ACOTADA' : 'SIN-COTA') : '—';
    const marca = reg.estado === 'ACOTADA' ? '✔' : '·';
    console.log(`  ${marca} [${reg.estado}] ${reg.archivo} ('${reg.coleccion}') → ${cota}`);
  }

  if (advertencias.length) {
    console.log('\n── Advertencias (no bloquean) ──');
    for (const a of advertencias) console.log(`  ⚠ ${a}`);
  }

  if (violaciones.length) {
    console.log('\n── VIOLACIONES (bloquean el pipeline) ──');
    for (const v of violaciones) console.log(`  ⛔ ${v}`);
    console.log(`\n⛔ Presupuesto de rendimiento: ${violaciones.length} violación(es). Pipeline detenido.`);
    process.exit(1);
  }

  console.log('\n✔ Presupuesto de rendimiento: sin violaciones. Todas las lecturas acotadas están dentro de cota.');
  process.exit(0);
}

// Solo ejecuta si se invoca directamente (permite importar las funciones puras en tests).
if (process.argv[1] && process.argv[1].endsWith('presupuesto-rendimiento.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
