/**
 * scripts/ci/audit-gate.mjs
 *
 * GATE DE AUDITORÍA GOBERNADO (ADR-0028) — reemplaza el `npm audit
 * --audit-level=high` CRUDO del paso `id: audit` de `.github/workflows/ci.yml`.
 *
 * PROBLEMA QUE RESUELVE: `npm audit --audit-level=high` a secas se pudre solo:
 * cada advisory NUEVA publicada sobre una transitiva sin fix upstream — sobre
 * un lockfile inmóvil — bloquea TODA la integración a `main` (branch
 * protection, enforce_admins=true), incluidos los PR de Dependabot. Pasó con
 * #139 (23-jul) y con #146/#147. Es un hard-deadlock: una sola transitiva sin
 * parche corta la organización entera.
 *
 * QUÉ HACE ESTE GATE (sin debilitar la seguridad — 4 invariantes DUROS):
 *   1. FALLA (exit 1) ante CUALQUIER advisory high/critical que NO esté
 *      explícitamente en `audit-allowlist.json`.
 *   2. La allowlist arranca VACÍA (el Hito 1, #147, ya remedió las 5 advisories
 *      vigentes). No se allowlista deuda existente.
 *   3. Cada entrada de allowlist EXIGE: advisory-id (GHSA/CVE), paquete,
 *      justificación, evaluación de alcanzabilidad, fecha de alta, fecha de
 *      caducidad (máx 90 días desde el alta) y responsable. Una entrada VENCIDA
 *      (caducidad < hoy) o MAL FORMADA hace FALLAR el gate — fuerza a revisarla;
 *      una excepción no se puede olvidar abierta para siempre.
 *   4. Una entrada cubre EXACTAMENTE el advisory-id que declara. Una advisory
 *      NUEVA sobre el MISMO paquete (otro id) NO queda cubierta y bloquea.
 *
 * Este gate NO relaja el `--audit-level=high`: sigue bloqueando ante cualquier
 * advisory high/critical nueva. Solo permite declarar, con caducidad y dueño,
 * una excepción puntual y auditable para una transitiva sin fix upstream, para
 * romper el hard-deadlock sin abrir la puerta a deuda silenciosa.
 *
 * PATRÓN (igual estándar que scripts/laboratorio/*.mjs, ADR-0011/0013):
 * dependency-free (solo Node nativo — añadir una dep a un gate de dependencias
 * amplía la superficie que el propio gate vigila), funciones puras exportadas
 * para tests sin red ni filesystem, y guardia `if (process.argv[1]…)` para que
 * la ejecución con I/O (npm audit + lectura de allowlist) solo ocurra al
 * invocarlo directamente.
 *
 * Uso:
 *   node scripts/ci/audit-gate.mjs         # corre `npm audit --json` real
 *   npm run audit:gate                     # idem, vía package.json
 *   AUDIT_GATE_TODAY=2026-08-05 node scripts/ci/audit-gate.mjs   # 'hoy' fijo
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = resolve(process.cwd());
const ALLOWLIST_JSON = 'audit-allowlist.json';
const MAX_DIAS_CADUCIDAD = 90;
const SEVERIDADES_BLOQUEANTES = new Set(['high', 'critical']);

// ─────────────────────────── utilidades de fecha ───────────────────────────

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** PURA. ¿`s` es una fecha calendario válida en formato YYYY-MM-DD? */
export function esFechaISO(s) {
  if (typeof s !== 'string' || !RE_FECHA_ISO.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** PURA. Días calendario entre dos fechas ISO (b - a). Asume ambas válidas. */
export function diasEntre(a, b) {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Resuelve el 'hoy' del gate: de AUDIT_GATE_TODAY si está presente (para
 * testear de forma determinista), si no del reloj del sistema (UTC, día
 * calendario). Si la env var está presente pero MAL FORMADA, lanza — un typo
 * en CI no debe degradar silenciosamente a la hora de pared.
 *
 * @param {Record<string, string | undefined>} [env] mapa de variables de entorno.
 */
export function resolverHoy(env = process.env) {
  const crudo = env.AUDIT_GATE_TODAY;
  if (crudo !== undefined && crudo !== '') {
    if (!esFechaISO(crudo)) {
      throw new Error(`AUDIT_GATE_TODAY inválida: '${crudo}'. Formato esperado YYYY-MM-DD.`);
    }
    return crudo;
  }
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────── extracción de advisories ───────────────────────────

const RE_GHSA = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i;
const RE_CVE = /CVE-\d{4}-\d{3,}/i;

/**
 * PURA. Reúne los identificadores portables de una entrada `via` (objeto) de
 * `npm audit --json`: GHSA (de la url), CVE (de url/título) y el `source`
 * numérico como string. Devuelve un array sin duplicados, en minúsculas para
 * GHSA/CVE (el match será case-insensitive).
 */
export function idsDeVia(via) {
  const ids = new Set();
  const campos = [via?.url, via?.title, via?.name].filter((x) => typeof x === 'string');
  for (const campo of campos) {
    const ghsa = campo.match(RE_GHSA);
    if (ghsa) ids.add(ghsa[0].toUpperCase());
    const cve = campo.match(RE_CVE);
    if (cve) ids.add(cve[0].toUpperCase());
  }
  if (via?.source !== undefined && via?.source !== null) ids.add(String(via.source));
  return [...ids];
}

/**
 * PURA. Extrae de la salida JSON de `npm audit --json` (formato v2 / npm 7+)
 * la lista de advisories high/critical, deduplicadas por su conjunto de ids.
 * El modelo es CENTRADO EN LA ADVISORY (no en el paquete): cada objeto de un
 * array `via` con severidad high/critical es una advisory a evaluar, sin
 * importar en qué nodo del grafo aparezca. Esto captura toda advisory raíz
 * (`npm audit --audit-level=high` bloquea porque existe al menos una), y
 * permite la cobertura por advisory-id EXACTO del requisito 4.
 *
 * Devuelve también `nodosAltosSinId`: nombres de paquetes cuyo nodo el propio
 * npm marca high/critical pero de los que NO se pudo extraer ninguna advisory
 * con id (formato inesperado). Se usa para fallar en cerrado (fail-closed).
 */
export function extraerAdvisoriesAltas(auditJson) {
  const vulnerabilities = auditJson?.vulnerabilities ?? {};
  const porClave = new Map();

  for (const [nombreNodo, nodo] of Object.entries(vulnerabilities)) {
    const via = Array.isArray(nodo?.via) ? nodo.via : [];
    for (const v of via) {
      if (typeof v !== 'object' || v === null) continue; // string = referencia a otro nodo
      const sev = String(v.severity ?? '').toLowerCase();
      if (!SEVERIDADES_BLOQUEANTES.has(sev)) continue;
      const ids = idsDeVia(v);
      const clave = ids.length ? ids.slice().sort().join('|') : `sinid:${v.name ?? nombreNodo}:${v.title ?? ''}`;
      if (!porClave.has(clave)) {
        porClave.set(clave, {
          paquete: v.name ?? nombreNodo,
          severidad: sev,
          ids,
          titulo: v.title ?? '(sin título)',
          url: v.url ?? '',
        });
      }
    }
  }

  const advisories = [...porClave.values()];

  // Fail-closed: si npm reporta high/critical a nivel de metadata pero no
  // logramos extraer NINGUNA advisory, algo cambió en el formato. No pasar.
  const meta = auditJson?.metadata?.vulnerabilities ?? {};
  const totalAltasMeta = (Number(meta.high) || 0) + (Number(meta.critical) || 0);
  const nodosAltosSinId = [];
  if (totalAltasMeta > 0 && advisories.length === 0) {
    nodosAltosSinId.push(
      `metadata reporta ${totalAltasMeta} advisory(es) high/critical pero no se extrajo ninguna del árbol `
      + `\`vulnerabilities\` (¿cambió el formato de \`npm audit --json\`?)`,
    );
  }

  return { advisories, nodosAltosSinId };
}

// ─────────────────────────── validación de la allowlist ───────────────────────────

const CAMPOS_REQUERIDOS = [
  ['advisory', 'advisory-id (GHSA/CVE)'],
  ['paquete', 'paquete afectado'],
  ['justificacion', 'justificación de por qué se excepciona'],
  ['alcanzabilidad', 'evaluación de alcanzabilidad (¿el código llega a la ruta vulnerable?)'],
  ['fechaAlta', 'fecha de alta (YYYY-MM-DD)'],
  ['caducidad', 'fecha de caducidad (YYYY-MM-DD, máx 90 días desde el alta)'],
  ['responsable', 'responsable que asume la excepción'],
];

/**
 * PURA. Valida el ESQUEMA de una entrada de allowlist (requisito 3). Devuelve
 * la lista de errores (vacía = válida). No evalúa caducidad contra 'hoy' — eso
 * es `entradaVencida`; aquí solo la coherencia estructural, incluida la regla
 * dura de máximo 90 días entre alta y caducidad.
 */
export function validarEntrada(entrada, indice = 0) {
  const errores = [];
  const etiqueta = `allowlist[${indice}]${entrada?.advisory ? ` (${entrada.advisory})` : ''}`;

  if (typeof entrada !== 'object' || entrada === null) {
    return [`${etiqueta}: no es un objeto.`];
  }

  for (const [campo, descripcion] of CAMPOS_REQUERIDOS) {
    const valor = entrada[campo];
    if (typeof valor !== 'string' || valor.trim() === '') {
      errores.push(`${etiqueta}: falta el campo obligatorio '${campo}' (${descripcion}).`);
    }
  }

  // Coherencia de fechas (solo si ambas están bien formadas).
  const { fechaAlta, caducidad } = entrada;
  if (esFechaISO(fechaAlta) && esFechaISO(caducidad)) {
    const dias = diasEntre(fechaAlta, caducidad);
    if (dias < 0) {
      errores.push(`${etiqueta}: la caducidad (${caducidad}) es anterior al alta (${fechaAlta}).`);
    } else if (dias > MAX_DIAS_CADUCIDAD) {
      errores.push(
        `${etiqueta}: la caducidad (${caducidad}) excede el máximo de ${MAX_DIAS_CADUCIDAD} días desde el alta `
        + `(${fechaAlta}); son ${dias} días. Acorta la ventana o renuévala.`,
      );
    }
  } else {
    if (fechaAlta !== undefined && !esFechaISO(fechaAlta)) {
      errores.push(`${etiqueta}: 'fechaAlta' no es una fecha YYYY-MM-DD válida ('${fechaAlta}').`);
    }
    if (caducidad !== undefined && !esFechaISO(caducidad)) {
      errores.push(`${etiqueta}: 'caducidad' no es una fecha YYYY-MM-DD válida ('${caducidad}').`);
    }
  }

  return errores;
}

/** PURA. ¿La entrada está vencida respecto a `hoy`? (caducidad < hoy). */
export function entradaVencida(entrada, hoy) {
  return esFechaISO(entrada?.caducidad) && entrada.caducidad < hoy;
}

/** PURA. ¿La entrada `entrada` cubre la `advisory`? Coincidencia por id EXACTO. */
export function entradaCubreAdvisory(entrada, advisory) {
  const declarado = String(entrada?.advisory ?? '').toUpperCase();
  if (!declarado) return false;
  return advisory.ids.some((id) => id.toUpperCase() === declarado);
}

/** PURA. Normaliza la allowlist cargada (array directo u objeto con `exceptions`). */
export function normalizarAllowlist(allowlist) {
  if (Array.isArray(allowlist)) return allowlist;
  if (allowlist && Array.isArray(allowlist.exceptions)) return allowlist.exceptions;
  return [];
}

// ─────────────────────────── evaluación (núcleo puro) ───────────────────────────

/**
 * PURA — el corazón del gate. Dado el JSON de `npm audit --json`, la allowlist
 * (array u objeto con `exceptions`) y la fecha `hoy` (YYYY-MM-DD), decide el
 * veredicto SIN tocar red ni filesystem.
 *
 * FALLA (exitCode 1) si:
 *   - hay ≥1 advisory high/critical NO cubierta por una entrada vigente, o
 *   - alguna entrada de la allowlist está MAL FORMADA (requisito 3), o
 *   - alguna entrada de la allowlist está VENCIDA (caducidad < hoy), o
 *   - fail-closed: npm reporta high/critical pero no se extrajo advisory alguna.
 * PASA (exitCode 0) si todas las high/critical están cubiertas por entradas
 * vigentes y bien formadas (o si no hay ninguna advisory alta).
 *
 * @returns {{ ok:boolean, exitCode:0|1, bloqueantes:Array, cubiertas:Array,
 *   entradasVencidas:Array, entradasInvalidas:Array, entradasVigentes:Array,
 *   failClosed:string[], resumen:string }}
 */
export function evaluarAuditGate(auditJson, allowlist, hoy) {
  if (!esFechaISO(hoy)) {
    throw new Error(`evaluarAuditGate: 'hoy' inválida ('${hoy}'). Formato esperado YYYY-MM-DD.`);
  }

  const entradas = normalizarAllowlist(allowlist);

  // 1) Validación estructural + caducidad de TODAS las entradas (requisito 3).
  //    Una entrada mal formada o vencida hace fallar el gate aunque su advisory
  //    ya no esté presente en el árbol — fuerza la limpieza; no se olvida.
  const entradasInvalidas = [];
  const entradasVencidas = [];
  const entradasVigentes = [];
  entradas.forEach((entrada, i) => {
    const errores = validarEntrada(entrada, i);
    if (errores.length) {
      entradasInvalidas.push({ entrada, errores });
      return; // una entrada inválida no puede además "cubrir" nada
    }
    if (entradaVencida(entrada, hoy)) {
      entradasVencidas.push(entrada);
    } else {
      entradasVigentes.push(entrada);
    }
  });

  // 2) Extraer advisories high/critical del árbol y clasificarlas.
  const { advisories, nodosAltosSinId } = extraerAdvisoriesAltas(auditJson);
  const bloqueantes = [];
  const cubiertas = [];
  for (const advisory of advisories) {
    // Solo una entrada VIGENTE y bien formada puede cubrir (por id exacto).
    const cubridora = entradasVigentes.find((e) => entradaCubreAdvisory(e, advisory));
    if (cubridora) {
      cubiertas.push({ advisory, entrada: cubridora });
    } else {
      bloqueantes.push(advisory);
    }
  }

  const failClosed = nodosAltosSinId;

  const ok = bloqueantes.length === 0
    && entradasInvalidas.length === 0
    && entradasVencidas.length === 0
    && failClosed.length === 0;

  const resultado = {
    ok,
    exitCode: ok ? 0 : 1,
    bloqueantes,
    cubiertas,
    entradasVencidas,
    entradasInvalidas,
    entradasVigentes,
    failClosed,
    resumen: '',
  };
  resultado.resumen = formatearResumen(resultado, hoy);
  return resultado;
}

// ─────────────────────────── presentación ───────────────────────────

/** PURA. Construye el resumen legible del veredicto. */
export function formatearResumen(resultado, hoy) {
  const L = [];
  L.push('══════════ GATE DE AUDITORÍA GOBERNADO (ADR-0028) ══════════');
  L.push(`Fecha de evaluación (hoy): ${hoy}`);
  L.push('Regla: toda advisory high/critical bloquea salvo excepción vigente y bien formada (id exacto).');
  L.push('');

  if (resultado.entradasInvalidas.length) {
    L.push('── ENTRADAS DE ALLOWLIST MAL FORMADAS (bloquean — requisito 3) ──');
    for (const { errores } of resultado.entradasInvalidas) {
      for (const e of errores) L.push(`  ⛔ ${e}`);
    }
    L.push('');
  }

  if (resultado.entradasVencidas.length) {
    L.push('── ENTRADAS DE ALLOWLIST VENCIDAS (bloquean — revísalas o retíralas) ──');
    for (const e of resultado.entradasVencidas) {
      L.push(`  ⛔ ${e.advisory} (${e.paquete}) — caducó ${e.caducidad}, responsable ${e.responsable}.`);
    }
    L.push('');
  }

  if (resultado.cubiertas.length) {
    L.push('── Advisories high/critical EXCEPTUADAS (vigentes) ──');
    for (const { advisory, entrada } of resultado.cubiertas) {
      L.push(
        `  ✓ ${advisory.ids.join(' / ') || '(sin id)'} [${advisory.severidad}] ${advisory.paquete} — `
        + `excepción vigente hasta ${entrada.caducidad} (${entrada.responsable}). Motivo: ${entrada.justificacion}`,
      );
    }
    L.push('');
  }

  if (resultado.failClosed.length) {
    L.push('── FAIL-CLOSED (formato inesperado — no se puede garantizar el análisis) ──');
    for (const f of resultado.failClosed) L.push(`  ⛔ ${f}`);
    L.push('');
  }

  if (resultado.bloqueantes.length) {
    L.push('── ADVISORIES HIGH/CRITICAL NO EXCEPTUADAS (bloquean el pipeline) ──');
    for (const a of resultado.bloqueantes) {
      L.push(`  ⛔ ${a.ids.join(' / ') || '(sin id)'} [${a.severidad}] ${a.paquete} — ${a.titulo}`);
      if (a.url) L.push(`       ${a.url}`);
    }
    L.push('');
    L.push(
      `⛔ Gate de auditoría: ${resultado.bloqueantes.length} advisory(es) high/critical sin excepción vigente. `
      + 'Remedia la dependencia (preferido) o, si es una transitiva sin fix upstream y no alcanzable, '
      + `declara una excepción en ${ALLOWLIST_JSON} (con visto de Seguridad y caducidad ≤ ${MAX_DIAS_CADUCIDAD} días).`,
    );
  } else if (resultado.ok) {
    const n = resultado.cubiertas.length;
    L.push(
      n === 0
        ? '✔ Gate de auditoría: 0 advisories high/critical. Árbol limpio.'
        : `✔ Gate de auditoría: sin advisories no exceptuadas (${n} excepción(es) vigente(s) aplicada(s)).`,
    );
  } else {
    L.push('⛔ Gate de auditoría: bloqueado (ver entradas mal formadas/vencidas o fail-closed arriba).');
  }

  return L.join('\n');
}

// ─────────────────────────── ejecución (I/O) ───────────────────────────

/** Lee y parsea `audit-allowlist.json` del repo. Ausente = allowlist vacía. */
function cargarAllowlist() {
  try {
    const raw = readFileSync(join(RAIZ, ALLOWLIST_JSON), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err && err.code === 'ENOENT') return { exceptions: [] };
    throw new Error(`No se pudo leer/parsear ${ALLOWLIST_JSON}: ${err.message}`);
  }
}

/**
 * Corre `npm audit --json` y devuelve el objeto parseado. npm sale con código
 * ≠0 cuando hay vulnerabilidades pero IGUAL imprime el JSON en stdout, por eso
 * usamos spawnSync (no lanza) y parseamos stdout pase lo que pase.
 */
function correrNpmAudit() {
  const res = spawnSync('npm', ['audit', '--json'], {
    cwd: RAIZ,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) {
    throw new Error(`No se pudo ejecutar 'npm audit --json': ${res.error.message}`);
  }
  const salida = res.stdout || '';
  try {
    return JSON.parse(salida);
  } catch {
    const err = (res.stderr || '').trim().slice(0, 500);
    throw new Error(
      `'npm audit --json' no devolvió JSON parseable (¿sin lockfile o sin red?). stderr: ${err || '(vacío)'}`,
    );
  }
}

function main() {
  let hoy;
  let auditJson;
  let allowlist;
  try {
    hoy = resolverHoy();
    auditJson = correrNpmAudit();
    allowlist = cargarAllowlist();
  } catch (err) {
    // Fail-closed: cualquier problema de entorno bloquea, no pasa por defecto.
    console.error(`⛔ Gate de auditoría: error de entorno — ${err.message}`);
    process.exit(1);
  }

  const resultado = evaluarAuditGate(auditJson, allowlist, hoy);
  console.log(resultado.resumen);
  process.exit(resultado.exitCode);
}

// Solo ejecuta con I/O si se invoca directamente (permite importar puras en tests).
if (process.argv[1] && process.argv[1].endsWith('audit-gate.mjs')) {
  main();
}
