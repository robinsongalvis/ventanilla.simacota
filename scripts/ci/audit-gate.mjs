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
 * FAIL-CLOSED (nunca pasa por defecto ante lo desconocido — verdad verificada
 * en __tests__/audit-gate.test.ts, incluidos tests a nivel de PROCESO):
 *   - Si `npm audit --json` NO devuelve JSON parseable (sin lockfile / sin red),
 *     el wrapper lanza y el gate sale EXIT 1.
 *   - Si devuelve JSON PARSEABLE pero de ERROR (npm emite `{"error":{…}}` o
 *     `{"message":"…failed…","error":{…}}` cuando el registro está caído, no hay
 *     lockfile, ENOLOCK, etc.) o SIN la forma completa de un reporte v2
 *     (`auditReportVersion`, `metadata.vulnerabilities`, `vulnerabilities`), el
 *     núcleo lo detecta (`validarFormaReporte`) y BLOQUEA: NO lo confunde con un
 *     "árbol limpio". Solo un reporte completo y válido con 0 high/critical pasa.
 *   - Si la extracción de advisories es parcial o los conteos no cuadran con la
 *     metadata (formato inesperado), también bloquea.
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
 *
 * AUDIT_GATE_TODAY (override del 'hoy') SOLO se honra en contexto de test
 * (process.env.VITEST o NODE_ENV==='test'). En ejecución normal/CI se IGNORA y
 * se usa el reloj del sistema, para que un valor inyectado en el entorno no
 * pueda viajar en el tiempo y revivir entradas de allowlist vencidas.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = resolve(process.cwd());
const ALLOWLIST_JSON = 'audit-allowlist.json';
const MAX_DIAS_CADUCIDAD = 90;
const SEVERIDADES_BLOQUEANTES = new Set(['high', 'critical']);
// Tolerancia del guard de conteo (requisito de hardening de extracción parcial):
// `metadata.vulnerabilities.{high,critical}` cuenta NODOS del árbol, igual que
// nosotros; ni la propagación de efectos ni la deduplicación por id afectan a
// ese conteo de nodos (solo a las advisories). Por eso deben coincidir: 0 de
// tolerancia. Cualquier exceso de la metadata sobre los nodos que sí vemos =
// árbol incompleto/formato inesperado → fail-closed.
const TOLERANCIA_CONTEO_NODOS = 0;

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
 * PURA. ¿Estamos en un contexto de TEST? Solo entonces se honra el override del
 * reloj (AUDIT_GATE_TODAY). Vitest fija `process.env.VITEST`; también se acepta
 * `NODE_ENV==='test'`.
 *
 * @param {Record<string, string | undefined>} [env] mapa de variables de entorno.
 */
export function enContextoDeTest(env = process.env) {
  return (env.VITEST !== undefined && env.VITEST !== '') || env.NODE_ENV === 'test';
}

/**
 * Resuelve el 'hoy' del gate.
 *
 * AUDIT_GATE_TODAY (override del reloj) SOLO se honra en contexto de test
 * (`enContextoDeTest`) — permite tests deterministas. En ejecución normal/CI se
 * IGNORA por completo y se usa el reloj del sistema (UTC, día calendario): así
 * un `AUDIT_GATE_TODAY` inyectado en el entorno de CI NO puede viajar en el
 * tiempo para revivir entradas de allowlist vencidas ni adelantar caducidades.
 *
 * En contexto de test, si el override está presente pero MAL FORMADO, lanza —
 * un typo no debe degradar silenciosamente a la hora de pared.
 *
 * @param {Record<string, string | undefined>} [env] mapa de variables de entorno.
 */
export function resolverHoy(env = process.env) {
  const crudo = env.AUDIT_GATE_TODAY;
  if (enContextoDeTest(env) && crudo !== undefined && crudo !== '') {
    if (!esFechaISO(crudo)) {
      throw new Error(`AUDIT_GATE_TODAY inválida: '${crudo}'. Formato esperado YYYY-MM-DD.`);
    }
    return crudo;
  }
  // Fuera de test (o sin override): reloj del sistema. AUDIT_GATE_TODAY se ignora.
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────── validación de FORMA del reporte ───────────────────────────

/**
 * PURA. Valida que `auditJson` tenga la FORMA COMPLETA de un reporte real de
 * `npm audit --json` (formato v2 / npm 7+). Devuelve la lista de motivos por
 * los que NO lo es (array vacío = forma válida).
 *
 * Es la pieza que CIERRA el fail-open: solo un JSON con esta forma —y con 0
 * high/critical— puede considerarse "árbol limpio". Cuando el registro de
 * advisories está caído, no hay lockfile, o npm no pudo auditar, npm emite un
 * JSON PARSEABLE pero de ERROR (p.ej. `{"error":{"code":"ENOLOCK"}}` o
 * `{"message":"...failed...","error":{…}}`), SIN `metadata`/`vulnerabilities`.
 * Sin esta validación ese JSON se confundía con un árbol limpio (EXIT 0) —
 * regresión frente al `npm audit --audit-level=high` crudo, que salía EXIT 1.
 * Cualquier motivo aquí ⇒ el gate BLOQUEA (no se pudo auditar → fail-closed).
 */
export function validarFormaReporte(auditJson) {
  if (typeof auditJson !== 'object' || auditJson === null || Array.isArray(auditJson)) {
    return ['la salida de `npm audit --json` no es un objeto JSON (no se pudo auditar).'];
  }

  const motivos = [];

  // npm emite `error`/`message` a nivel raíz cuando NO pudo auditar (registro
  // caído, sin lockfile, ENOLOCK…). Un reporte real no lleva ninguna de las dos.
  if ('error' in auditJson && auditJson.error !== null && auditJson.error !== undefined) {
    const e = auditJson.error;
    const detalle = typeof e === 'object' ? (e.code ?? e.summary ?? e.message ?? '') : String(e);
    motivos.push(`npm audit devolvió un ERROR (${detalle || 'sin detalle'}) en vez de un reporte — no se pudo auditar.`);
  }
  if (typeof auditJson.message === 'string' && auditJson.message.trim() !== '') {
    motivos.push(`npm audit devolvió un mensaje de fallo ('${auditJson.message.slice(0, 120)}') en vez de un reporte.`);
  }

  if (typeof auditJson.auditReportVersion !== 'number' || !Number.isFinite(auditJson.auditReportVersion)) {
    motivos.push("falta 'auditReportVersion' numérico (no parece un reporte de `npm audit --json` v2).");
  }

  const vulns = auditJson.vulnerabilities;
  if (typeof vulns !== 'object' || vulns === null || Array.isArray(vulns)) {
    motivos.push("falta el objeto 'vulnerabilities'.");
  }

  const meta = auditJson.metadata;
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    motivos.push("falta el objeto 'metadata'.");
  } else {
    const mv = meta.vulnerabilities;
    if (typeof mv !== 'object' || mv === null || Array.isArray(mv)) {
      motivos.push("falta el objeto 'metadata.vulnerabilities' con los conteos por severidad.");
    } else {
      for (const campo of ['high', 'critical', 'total']) {
        if (typeof mv[campo] !== 'number' || !Number.isFinite(mv[campo])) {
          motivos.push(`'metadata.vulnerabilities.${campo}' no es un número (forma inesperada).`);
        }
      }
    }
  }

  return motivos;
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
  const vulnerabilities = (auditJson && typeof auditJson.vulnerabilities === 'object'
    && auditJson.vulnerabilities !== null && !Array.isArray(auditJson.vulnerabilities))
    ? auditJson.vulnerabilities
    : {};
  const porClave = new Map();

  // Conteos para los guards de fail-closed (ver abajo):
  //  - nodosAltosContados: nodos que el PROPIO npm marca high/critical.
  //  - nodosAltosPerdidos: nodos high/critical con via-OBJETOS (datos de
  //    advisory) de los que NO salió ninguna advisory alta → deriva de formato.
  let nodosAltosContados = 0;
  const nodosAltosPerdidos = [];

  for (const [nombreNodo, nodo] of Object.entries(vulnerabilities)) {
    const sevNodo = String(nodo?.severity ?? '').toLowerCase();
    const esNodoAlto = SEVERIDADES_BLOQUEANTES.has(sevNodo);
    if (esNodoAlto) nodosAltosContados += 1;

    const via = Array.isArray(nodo?.via) ? nodo.via : [];
    let objetosEnVia = 0;
    let objetosAltosExtraidos = 0;

    for (const v of via) {
      if (typeof v !== 'object' || v === null) continue; // string = referencia a otro nodo (efecto)
      objetosEnVia += 1;
      const sev = String(v.severity ?? '').toLowerCase();
      if (!SEVERIDADES_BLOQUEANTES.has(sev)) continue;
      objetosAltosExtraidos += 1;
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

    // Guard de EXTRACCIÓN PARCIAL (por nodo): el nodo es high/critical y trae
    // via-OBJETOS (datos estructurados de advisory), pero NINGUNO se clasificó
    // high/critical. Es deriva de formato: había una advisory que describir y no
    // la pudimos leer. (Un nodo cuyo `via` son solo referencias string es un
    // efecto legítimo — la advisory vive en el nodo referenciado, no se pierde.)
    if (esNodoAlto && objetosEnVia > 0 && objetosAltosExtraidos === 0) {
      nodosAltosPerdidos.push(nombreNodo);
    }
  }

  const advisories = [...porClave.values()];

  const meta = (auditJson && typeof auditJson.metadata === 'object' && auditJson.metadata !== null
    && typeof auditJson.metadata.vulnerabilities === 'object' && auditJson.metadata.vulnerabilities !== null)
    ? auditJson.metadata.vulnerabilities
    : {};
  const totalAltasMeta = (Number(meta.high) || 0) + (Number(meta.critical) || 0);

  const nodosAltosSinId = [];

  // Guard A (pérdida TOTAL): npm reporta high/critical en metadata pero no
  // extrajimos NINGUNA advisory del árbol. Formato inesperado → no pasar.
  if (totalAltasMeta > 0 && advisories.length === 0) {
    nodosAltosSinId.push(
      `metadata reporta ${totalAltasMeta} advisory(es) high/critical pero no se extrajo ninguna del árbol `
      + '`vulnerabilities` (¿cambió el formato de `npm audit --json`?)',
    );
  }

  // Guard B (pérdida PARCIAL, por nodo): nodos high/critical con datos de
  // advisory ilegibles. Cierra el fail-open latente de extracción parcial: antes
  // el gate solo disparaba si se extraían 0 advisories; si extraía algunas pero
  // no todas, podía pasar.
  for (const nombre of nodosAltosPerdidos) {
    nodosAltosSinId.push(
      `el nodo '${nombre}' es high/critical y trae datos de advisory, pero no se pudo extraer ninguna `
      + 'advisory alta de él (¿cambió el formato de `npm audit --json`?)',
    );
  }

  // Guard C (INTEGRIDAD DE CONTEO): la metadata dice que hay más paquetes
  // high/critical de los que aparecen como nodos en el árbol que parseamos.
  // metadata cuenta NODOS igual que nosotros (la dedup por id y la propagación
  // de efectos afectan a las advisories, NO a este conteo de nodos), así que un
  // exceso más allá de la tolerancia = árbol incompleto → fail-closed.
  if (totalAltasMeta - nodosAltosContados > TOLERANCIA_CONTEO_NODOS) {
    nodosAltosSinId.push(
      `metadata reporta ${totalAltasMeta} paquete(s) high/critical pero el árbol \`vulnerabilities\` solo `
      + `contiene ${nodosAltosContados} nodo(s) de esa severidad (árbol incompleto o formato inesperado).`,
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
 *   - fail-closed de FORMA: el JSON no es un reporte de `npm audit --json`
 *     completo y válido (JSON de error/`message`, sin `metadata`/
 *     `vulnerabilities`, sin `auditReportVersion`…). Solo un reporte con la
 *     forma completa y 0 high/critical cuenta como "árbol limpio", o
 *   - hay ≥1 advisory high/critical NO cubierta por una entrada vigente, o
 *   - alguna entrada de la allowlist está MAL FORMADA (requisito 3), o
 *   - alguna entrada de la allowlist está VENCIDA (caducidad < hoy), o
 *   - fail-closed de EXTRACCIÓN: npm reporta high/critical pero no se extrajo
 *     advisory alguna (total), o la extracción fue parcial, o los conteos no
 *     cuadran con la metadata.
 * PASA (exitCode 0) si el reporte tiene forma válida y todas las high/critical
 * están cubiertas por entradas vigentes y bien formadas (o no hay ninguna).
 *
 * @returns {{ ok:boolean, exitCode:0|1, bloqueantes:Array, cubiertas:Array,
 *   entradasVencidas:Array, entradasInvalidas:Array, entradasVigentes:Array,
 *   formaInvalida:string[], failClosed:string[], resumen:string }}
 */
export function evaluarAuditGate(auditJson, allowlist, hoy) {
  if (!esFechaISO(hoy)) {
    throw new Error(`evaluarAuditGate: 'hoy' inválida ('${hoy}'). Formato esperado YYYY-MM-DD.`);
  }

  // 0) FAIL-CLOSED DE FORMA (cierra el fail-open): antes de interpretar nada,
  //    exige que `auditJson` sea un reporte de `npm audit --json` COMPLETO y
  //    válido. Un JSON de error de npm ({error}/{message}) o truncado NO es un
  //    árbol limpio: bloquea. No se pudo auditar → fail-closed.
  const formaInvalida = validarFormaReporte(auditJson);

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

  const ok = formaInvalida.length === 0
    && bloqueantes.length === 0
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
    formaInvalida,
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

  if (resultado.formaInvalida?.length) {
    L.push('── NO SE PUDO AUDITAR — FAIL-CLOSED (la salida no es un reporte válido de npm audit) ──');
    for (const m of resultado.formaInvalida) L.push(`  ⛔ ${m}`);
    L.push('  (registro de advisories caído, sin lockfile, o formato inesperado → el gate BLOQUEA;');
    L.push('   nunca se interpreta como "árbol limpio".)');
    L.push('');
  }

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
  } else if (resultado.formaInvalida?.length) {
    L.push(
      '⛔ Gate de auditoría: no se pudo auditar (la salida de `npm audit --json` no es un reporte válido). '
      + 'Fail-closed: se bloquea en vez de pasar por defecto ante lo desconocido.',
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
