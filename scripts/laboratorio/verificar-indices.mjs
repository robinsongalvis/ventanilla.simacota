/**
 * scripts/laboratorio/verificar-indices.mjs
 *
 * GATE ESTÁTICO DE ÍNDICES FIRESTORE (A3) — lección del incidente del
 * Reparto: una consulta `.where(...).orderBy(...)` sin índice compuesto
 * declarado rompió una pantalla en producción (FAILED_PRECONDITION)
 * porque ni los tests unitarios ni el emulador exigen índices reales.
 * Este gate lo convierte en un control ejecutable de CI.
 *
 * MECANISMO (mismo estándar que scripts/laboratorio/presupuesto-rendimiento.mjs,
 * ADR-0011: estático, determinista, sin emulador ni servidor):
 *   Escanea `app/` y `lib/` buscando, POR BLOQUE (no solo por línea), cadenas
 *   de consulta Firestore que combinan `.where(campo, ...)` con
 *   `.orderBy(campo)` sobre la MISMA colección — incluyendo el caso, real en
 *   este repo, en que la reasignación (`q = q.where(...)`) ocurre unas
 *   líneas después de construir la consulta base con `.orderBy(...)`
 *   (`app/api/radicados/busqueda-avanzada/route.ts`).
 *
 * REGLA (Firestore): un índice de un solo campo es automático; sirve para
 *   un único `where` o un único `orderBy` aislados. Pero si una consulta
 *   filtra por IGUALDAD/COMPARACIÓN en un campo A y ordena por un campo
 *   B ≠ A, Firestore exige un ÍNDICE COMPUESTO que empiece por A y
 *   contenga B — si no existe, la consulta falla en producción con
 *   FAILED_PRECONDITION (exactamente el incidente del Reparto). Múltiples
 *   `where` de solo-igualdad SIN `orderBy` en campo distinto no requieren
 *   compuesto (Firestore resuelve el AND de igualdades con índices de un
 *   solo campo) — por eso este gate NO los reporta.
 *
 * QUÉ NO CUENTA COMO VIOLACIÓN (falso positivo estructural, no se reporta):
 *   - `where(campoA) + orderBy(campoA)` (mismo campo — rango simple).
 *   - Un único predicado (`where` sin `orderBy`, o `orderBy` sin `where`).
 *
 * QUÉ SE REPORTA COMO ADVERTENCIA (no bloquea, para revisión humana):
 *   - Colección dinámica: `.collection(variable)` en vez de un literal.
 *   - Campo de `where`/`orderBy` dinámico (variable en vez de literal).
 *
 * REGISTRO DE EXCEPCIONES: igual filosofía de deuda declarada que el
 *   presupuesto de rendimiento — un hallazgo real y preexistente se
 *   declara aquí (archivo + colección + campos + motivo) para que el gate
 *   quede VERDE hoy sin ocultar el hallazgo (se imprime igual, marcado
 *   como DEUDA DECLARADA) ni "arreglarlo" sin revisión (no se tocan
 *   índices desde este script). Una violación NUEVA, no registrada,
 *   SIGUE bloqueando el pipeline.
 *
 * Las funciones puras (`encontrarBloques`, `extraerCampos`,
 * `existeIndiceCompuesto`, `construirIndicePorColeccion`, `analizarArchivo`)
 * están exportadas para poder probarlas sin tocar el filesystem — mismo
 * patrón que `scripts/laboratorio/detectar-consecutivos-fantasma.mjs`
 * (funciones puras exportadas + guardia `if (process.argv[1]…)` para que
 * la ejecución con I/O solo ocurra al invocar el script directamente).
 *
 * Uso:
 *   node scripts/laboratorio/verificar-indices.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(process.cwd());
const DIRS_ESCANEO = ['app', 'lib'];
const INDICES_JSON = 'firestore.indexes.json';
const MAX_VENTANA_LINEAS = 80; // tope de líneas de un "bloque" de consulta

/**
 * REGISTRO DE EXCEPCIONES — hallazgos reales y preexistentes (SIMI Jurídico,
 * fuera del alcance de A3) que el gate detecta pero que, por decisión
 * consciente, se difieren en vez de bloquear el PR de este control. NO se
 * añaden índices desde aquí: quedan declarados y visibles para que se
 * resuelvan en Bloque 3 (o se confirme que el índice ya existe en el
 * proyecto de Firebase y falta capturarlo en firestore.indexes.json).
 *
 * Cada entrada exige coincidencia EXACTA de (archivo, colección, campoWhere,
 * campoOrderBy) — no es un bypass a nivel de archivo completo: una
 * violación NUEVA y distinta en un archivo ya listado aquí sigue bloqueando.
 */
export const REGISTRO_EXCEPCIONES = [
  {
    archivo: 'app/api/simi/juridico/aprobaciones/route.ts',
    coleccion: 'simi_aprobaciones_respuesta',
    campoWhere: 'tenantId',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (cola de aprobaciones por tenant, sin índice declarado)',
  },
  {
    archivo: 'app/api/simi/notificaciones/route.ts',
    coleccion: 'simi_notificaciones',
    campoWhere: 'tenantId',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (notificaciones por tenant+rol[+leida], sin índice declarado)',
  },
  {
    archivo: 'app/api/simi/notificaciones/route.ts',
    coleccion: 'simi_notificaciones',
    campoWhere: 'destinatarioRol',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (notificaciones por tenant+rol[+leida], sin índice declarado)',
  },
  {
    archivo: 'app/api/simi/notificaciones/route.ts',
    coleccion: 'simi_notificaciones',
    campoWhere: 'leida',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (variante "solo no leídas": tenant+rol+leida, sin índice declarado)',
  },
  {
    archivo: 'app/api/simi/reportes/route.ts',
    coleccion: 'simi_aprobaciones_respuesta',
    campoWhere: 'tenantId',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (reporte de aprobaciones/métricas por tenant, sin índice declarado)',
  },
  {
    archivo: 'app/api/simi/reportes/trazabilidad/[radicadoId]/route.ts',
    coleccion: 'simi_borrador_versiones',
    campoWhere: 'radicadoId',
    campoOrderBy: 'version',
    motivo: 'preexistente - revisar en Bloque 3 (historial de versiones del borrador, sin índice declarado)',
  },
  {
    archivo: 'lib/simi-juridico/getOfficialTemplate.ts',
    coleccion: 'plantillas_respuesta',
    campoWhere: 'tenantId',
    campoOrderBy: 'nombre',
    motivo: 'preexistente - revisar en Bloque 3 (listado de plantillas por tenant+estado, sin índice declarado)',
  },
  {
    archivo: 'lib/simi-juridico/getOfficialTemplate.ts',
    coleccion: 'plantillas_respuesta',
    campoWhere: 'estado',
    campoOrderBy: 'nombre',
    motivo: 'preexistente - revisar en Bloque 3 (listado de plantillas por tenant+estado, sin índice declarado)',
  },
  {
    archivo: 'lib/simi-juridico/borradorVersiones.ts',
    coleccion: 'simi_borrador_versiones',
    campoWhere: 'radicadoId',
    campoOrderBy: 'version',
    motivo: 'preexistente - revisar en Bloque 3 (3 consultas de versión de borrador, sin índice declarado)',
  },
  {
    archivo: 'lib/simi-juridico/calculateQualityMetrics.ts',
    coleccion: 'simi_juridico_auditoria',
    campoWhere: 'rol',
    campoOrderBy: 'fechaHora',
    motivo: 'preexistente - revisar en Bloque 3 (auditoría jurídica != rol, sin índice declarado)',
  },
  {
    archivo: 'lib/simi-juridico/calculateQualityMetrics.ts',
    coleccion: 'simi_aprobaciones_respuesta',
    campoWhere: 'tenantId',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (métricas de calidad por tenant, sin índice declarado)',
  },
  {
    archivo: 'lib/simi-juridico/calculateQualityMetrics.ts',
    coleccion: 'simi_rag_consultas',
    campoWhere: 'tenantId',
    campoOrderBy: 'createdAt',
    motivo: 'preexistente - revisar en Bloque 3 (fuentes RAG más usadas por tenant, sin índice declarado)',
  },
];

// ─────────────────────────── índices declarados ───────────────────────────

/**
 * PURA. `{ indexes: [{ collectionGroup, fields: [{fieldPath, order}] }, …] }`
 * (la forma de `firestore.indexes.json`) → Map collectionGroup -> array de
 * índices, cada índice = array ordenado de `{fieldPath, order}`.
 */
export function construirIndicePorColeccion(indicesJson) {
  const porColeccion = new Map();
  for (const idx of indicesJson?.indexes ?? []) {
    const lista = porColeccion.get(idx.collectionGroup) ?? [];
    lista.push(idx.fields ?? []);
    porColeccion.set(idx.collectionGroup, lista);
  }
  return porColeccion;
}

/** Lee y parsea `firestore.indexes.json` del repo (único punto de I/O de este módulo). */
function cargarIndicesDeclarados() {
  const raw = readFileSync(join(RAIZ, INDICES_JSON), 'utf8');
  return construirIndicePorColeccion(JSON.parse(raw));
}

/** PURA. ¿Existe un índice de `coleccion` que empiece por `campoWhere` y contenga `campoOrderBy`? */
export function existeIndiceCompuesto(indicesPorColeccion, coleccion, campoWhere, campoOrderBy) {
  const indices = indicesPorColeccion.get(coleccion) ?? [];
  return indices.some((fields) => {
    if (!fields.length || fields[0].fieldPath !== campoWhere) return false;
    return fields.slice(1).some((f) => f.fieldPath === campoOrderBy);
  });
}

// ─────────────────────────── escaneo de fuentes ───────────────────────────

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

// `.collection('literal')` o `.collection(variable)`.
const RE_COLLECTION_LITERAL = /\.collection\(\s*['"]([^'"]+)['"]\s*\)/;
const RE_COLLECTION_DINAMICA = /\.collection\(\s*([A-Za-z_$][\w$.]*)\s*\)/;
// `.where('campo', ...)` — el primer argumento debe ser un literal para poder verificarlo.
const RE_WHERE_LITERAL = /\.where\(\s*['"]([^'"]+)['"]/g;
const RE_WHERE_DINAMICO = /\.where\(\s*(?!['"])/g;
const RE_ORDERBY_LITERAL = /\.orderBy\(\s*['"]([^'"]+)['"]/g;
const RE_ORDERBY_DINAMICO = /\.orderBy\(\s*(?!['"])/g;
/** Anclas de bloque: cualquier `.collection(`. */
const RE_ANCLA = /\.collection\(/;

/**
 * PURA. Encuentra los "bloques de consulta" de un archivo (contenido como
 * string): cada `.collection(...)` es un ancla; el bloque va desde esa línea
 * hasta la línea anterior a la SIGUIENTE ancla (o hasta MAX_VENTANA_LINEAS,
 * lo que ocurra primero). Esto cubre tanto la cadena en una sola sentencia
 * (`.collection(x).where(...).orderBy(...)`) como la reasignación unas
 * líneas después (`let q = db.collection(x).orderBy(...); … q = q.where(...);`),
 * sin mezclar el bloque con la consulta de otra colección más abajo.
 */
export function encontrarBloques(contenido) {
  const lineas = contenido.split('\n');
  const anclas = [];
  for (let i = 0; i < lineas.length; i += 1) {
    if (RE_ANCLA.test(lineas[i])) anclas.push(i);
  }

  return anclas.map((inicio, k) => {
    const siguienteAncla = anclas[k + 1] ?? lineas.length;
    const fin = Math.min(siguienteAncla, inicio + MAX_VENTANA_LINEAS, lineas.length);
    const texto = lineas.slice(inicio, fin).join('\n');
    const primeraLinea = lineas[inicio];

    const litMatch = primeraLinea.match(RE_COLLECTION_LITERAL);
    const dinMatch = !litMatch && primeraLinea.match(RE_COLLECTION_DINAMICA);

    return {
      lineaInicio: inicio + 1,
      coleccion: litMatch ? litMatch[1] : null,
      coleccionDinamica: dinMatch ? dinMatch[1] : null,
      texto,
    };
  });
}

/**
 * PURA. Extrae los campos literales de todas las llamadas `.where(`/`.orderBy(`
 * de un bloque de texto, y si detecta que ALGUNA llamada no pudo resolverse
 * a un literal (variable como argumento), lo marca en `hayDinamico`.
 */
export function extraerCampos(texto, reLiteral, reDinamico) {
  const literales = [...texto.matchAll(reLiteral)].map((m) => m[1]);
  const totalDinamico = [...texto.matchAll(reDinamico)].length;
  // Cada `.where(`/`.orderBy(` cuenta una vez; si el total de ocurrencias
  // dinámicas supera lo que ya capturamos como literal, hay al menos una
  // no resuelta con certeza.
  const dinamicos = Math.max(0, totalDinamico - literales.length);
  return { literales, hayDinamico: dinamicos > 0 };
}

/**
 * PURA. Analiza el contenido (string) de UN archivo y devuelve los hallazgos:
 * violaciones (bloquean), advertencias (no bloquean) y deuda declarada (no
 * bloquea, cubierta por `registroExcepciones`). No toca el filesystem.
 */
export function analizarArchivo(contenido, archivoRel, indicesPorColeccion, registroExcepciones = []) {
  const violaciones = [];
  const advertencias = [];
  const deudaDeclarada = [];
  const exclusionesUsadas = new Set();

  for (const bloque of encontrarBloques(contenido)) {
    const { literales: wheres, hayDinamico: whereDinamico } =
      extraerCampos(bloque.texto, RE_WHERE_LITERAL, RE_WHERE_DINAMICO);
    const { literales: orderBys, hayDinamico: orderByDinamico } =
      extraerCampos(bloque.texto, RE_ORDERBY_LITERAL, RE_ORDERBY_DINAMICO);

    const hayWhere = wheres.length > 0 || whereDinamico;
    const hayOrderBy = orderBys.length > 0 || orderByDinamico;
    if (!hayWhere || !hayOrderBy) continue; // no es un combo where+orderBy

    // Colección no resoluble con certeza → advertencia, no bloquea.
    if (!bloque.coleccion) {
      advertencias.push(
        `COLECCIÓN DINÁMICA: ${archivoRel}:${bloque.lineaInicio} — \`.collection(${bloque.coleccionDinamica ?? '?'})\` `
        + `combina where+orderBy pero la colección no es un literal; no se puede verificar contra ${INDICES_JSON}. Revisión humana.`,
      );
      continue;
    }

    // Campo de where u orderBy no resoluble con certeza → advertencia.
    if (whereDinamico || orderByDinamico) {
      advertencias.push(
        `CAMPO DINÁMICO: ${archivoRel}:${bloque.lineaInicio} — colección '${bloque.coleccion}' combina where+orderBy `
        + `pero al menos un campo no es un literal (variable); no se puede verificar con certeza. Revisión humana.`,
      );
      continue;
    }

    for (const campoOrderBy of new Set(orderBys)) {
      for (const campoWhere of new Set(wheres)) {
        if (campoWhere === campoOrderBy) continue; // mismo campo: rango simple, sin compuesto

        if (existeIndiceCompuesto(indicesPorColeccion, bloque.coleccion, campoWhere, campoOrderBy)) {
          continue; // índice compuesto declarado — OK
        }

        const excepcion = registroExcepciones.find((ex) =>
          ex.archivo === archivoRel && ex.coleccion === bloque.coleccion
          && ex.campoWhere === campoWhere && ex.campoOrderBy === campoOrderBy);

        if (excepcion) {
          exclusionesUsadas.add(excepcion);
          deudaDeclarada.push(
            `${archivoRel}:${bloque.lineaInicio} — '${bloque.coleccion}' where(${campoWhere})+orderBy(${campoOrderBy}) `
            + `[DEUDA DECLARADA: ${excepcion.motivo}]`,
          );
          continue;
        }

        violaciones.push(
          `SIN ÍNDICE COMPUESTO: ${archivoRel}:${bloque.lineaInicio} — colección '${bloque.coleccion}' filtra por `
          + `\`${campoWhere}\` y ordena por \`${campoOrderBy}\` (campos distintos), pero ${INDICES_JSON} no declara `
          + `ningún índice que empiece por '${campoWhere}' y contenga '${campoOrderBy}'. Esto falla en producción `
          + `con FAILED_PRECONDITION (mismo incidente del Reparto). Declara el índice o, si es un falso positivo, `
          + `regístralo en REGISTRO_EXCEPCIONES de scripts/laboratorio/verificar-indices.mjs.`,
        );
      }
    }
  }

  return { violaciones, advertencias, deudaDeclarada, exclusionesUsadas };
}

// ─────────────────────────── ejecución (I/O) ───────────────────────────

async function main() {
  const indicesPorColeccion = cargarIndicesDeclarados();
  const violaciones = [];
  const advertencias = [];
  const deudaDeclarada = [];
  const exclusionesUsadas = new Set();

  for (const dir of DIRS_ESCANEO) {
    for (const rutaAbs of listarFuentes(join(RAIZ, dir))) {
      const rel = rutaAbs.slice(RAIZ.length + 1);
      const contenido = readFileSync(rutaAbs, 'utf8');
      const r = analizarArchivo(contenido, rel, indicesPorColeccion, REGISTRO_EXCEPCIONES);

      violaciones.push(...r.violaciones);
      advertencias.push(...r.advertencias);
      deudaDeclarada.push(...r.deudaDeclarada);
      for (const ex of r.exclusionesUsadas) exclusionesUsadas.add(ex);
    }
  }

  // Higiene del REGISTRO: excepciones que ya no se detectan (el hallazgo se corrigió).
  for (const ex of REGISTRO_EXCEPCIONES) {
    if (!exclusionesUsadas.has(ex)) {
      advertencias.push(
        `EXCEPCIÓN OBSOLETA: ${ex.archivo} ('${ex.coleccion}' where(${ex.campoWhere})+orderBy(${ex.campoOrderBy})) `
        + `ya no se detecta (¿se declaró el índice o cambió la consulta?). Elimínala de REGISTRO_EXCEPCIONES.`,
      );
    }
  }

  console.log('\n══════════ ÍNDICES FIRESTORE — gate de consultas compuestas (A3) ══════════');
  console.log('Regla: where(campoA) + orderBy(campoB), A≠B ⇒ exige índice compuesto que empiece por A y contenga B.\n');

  if (deudaDeclarada.length) {
    console.log('── Deuda declarada (no bloquea — preexistente, ver REGISTRO_EXCEPCIONES) ──');
    for (const d of deudaDeclarada) console.log(`  · ${d}`);
    console.log();
  }

  if (advertencias.length) {
    console.log('── Advertencias (no bloquean — revisión humana) ──');
    for (const a of advertencias) console.log(`  ⚠ ${a}`);
    console.log();
  }

  if (violaciones.length) {
    console.log('── VIOLACIONES (bloquean el pipeline) ──');
    for (const v of violaciones) console.log(`  ⛔ ${v}`);
    console.log(`\n⛔ Gate de índices: ${violaciones.length} violación(es) nueva(s) sin índice ni excepción declarada. Pipeline detenido.`);
    process.exit(1);
  }

  console.log('✔ Gate de índices: sin violaciones nuevas. Toda combinación where+orderBy tiene índice compuesto o deuda declarada.');
  process.exit(0);
}

// Solo ejecuta si se invoca directamente (permite importar las funciones puras en tests).
if (process.argv[1] && process.argv[1].endsWith('verificar-indices.mjs')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
