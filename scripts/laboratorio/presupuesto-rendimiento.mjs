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
 * Uso:
 *   node scripts/laboratorio/presupuesto-rendimiento.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(process.cwd());
const DIRS_ESCANEO = ['app', 'lib'];
const COLECCION = 'ventanilla_radicados';
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

// Admin: `.collection('ventanilla_radicados')` NO seguido de `.doc(`.
const RE_ADMIN = new RegExp(`\\.collection\\(\\s*['"]${COLECCION}['"]\\s*\\)(?!\\s*\\.doc\\()`);
// Client: `collection(<handle>, 'ventanilla_radicados')` (nombre = último arg).
const RE_CLIENT = new RegExp(`[^.\\w]collection\\(\\s*[^,]+,\\s*['"]${COLECCION}['"]\\s*\\)`);
const RE_COTA = /(?:^|[^.\w])limit\(|\.limit\(|startAfter\(|startAt\(/;

/** Encuentra las lecturas de colección (list-read) en un archivo. */
function detectarLecturas(rutaAbs, rel) {
  const contenido = readFileSync(rutaAbs, 'utf8');
  const lineas = contenido.split('\n');
  const lecturas = [];
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    const esAdmin = RE_ADMIN.test(linea);
    const esClient = RE_CLIENT.test(linea);
    if (!esAdmin && !esClient) continue;

    const desde = Math.max(0, i - VENTANA_LINEAS);
    const hasta = Math.min(lineas.length, i + VENTANA_LINEAS + 1);
    const ventana = lineas.slice(desde, hasta).join('\n');
    const acotada = RE_COTA.test(ventana);
    lecturas.push({ archivo: rel, linea: i + 1, acotada });
  }
  return lecturas;
}

// ─────────────────────────── validación ───────────────────────────

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

  if (!reg) {
    violaciones.push(
      `SUPERFICIE NO REGISTRADA: ${archivo} (líneas ${lecturas.map((l) => l.linea).join(', ')}) `
      + `lee la colección '${COLECCION}'${algunaSinCota ? ' SIN COTA' : ''}. `
      + `Clasifícala en el REGISTRO de scripts/laboratorio/presupuesto-rendimiento.mjs.`,
    );
    continue;
  }

  if (reg.estado === 'ACOTADA') {
    if (algunaSinCota) {
      violaciones.push(
        `PRESUPUESTO EXCEDIDO (regresión O(N)): ${archivo} declarada ACOTADA pero una lectura de `
        + `'${COLECCION}' perdió su cota (líneas ${lecturas.filter((l) => !l.acotada).map((l) => l.linea).join(', ')}). `
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
      `REGISTRO OBSOLETO: ${reg.archivo} (${reg.estado}) ya no contiene una lectura de colección `
      + `de '${COLECCION}'. Elimínala del REGISTRO.`,
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
